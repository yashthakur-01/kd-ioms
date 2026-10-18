import { describe, it, expect, vi, beforeEach } from 'vitest';
import type pg from 'pg';
import { applyLedgerEntry } from '../stock-ledger.service.js';
import { LEDGER_ENTRY_TYPE } from '../../../enums/ledger-entry-type.enum.js';

describe('Stock Ledger Service (applyLedgerEntry)', () => {
  let mockClient: pg.PoolClient;
  let mockQuery: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockQuery = vi.fn();
    mockClient = {
      query: mockQuery,
    } as unknown as pg.PoolClient;
  });

  it('rejects zero delta with VALIDATION_ERROR', async () => {
    await expect(
      applyLedgerEntry(mockClient, {
        batchId: 1,
        type: LEDGER_ENTRY_TYPE.INWARD,
        delta: 0,
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Ledger delta cannot be zero',
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('rejects negative delta for INWARD entry type', async () => {
    await expect(
      applyLedgerEntry(mockClient, {
        batchId: 1,
        type: LEDGER_ENTRY_TYPE.INWARD,
        delta: -10,
      })
    ).rejects.toMatchObject({
      code: 'INVALID_LEDGER_SIGN',
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('rejects positive delta for OUTWARD entry type', async () => {
    await expect(
      applyLedgerEntry(mockClient, {
        batchId: 1,
        type: LEDGER_ENTRY_TYPE.OUTWARD,
        delta: 10,
      })
    ).rejects.toMatchObject({
      code: 'INVALID_LEDGER_SIGN',
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND when batch does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // batch SELECT FOR UPDATE

    await expect(
      applyLedgerEntry(mockClient, {
        batchId: 999,
        type: LEDGER_ENTRY_TYPE.INWARD,
        delta: 20,
      })
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Batch with ID 999 does not exist',
    });
  });

  it('throws INSUFFICIENT_STOCK when resulting balance is negative', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          batch_id: 1,
          quantity_on_hand: 5,
          status: 'ACTIVE',
          expiry_date: '2027-01-01',
        },
      ],
    });

    await expect(
      applyLedgerEntry(mockClient, {
        batchId: 1,
        type: LEDGER_ENTRY_TYPE.OUTWARD,
        delta: -10,
      })
    ).rejects.toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      message: 'Stock balance cannot be negative',
      httpStatus: 422,
    });

    // Should NOT have issued UPDATE or INSERT
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('successfully processes INWARD, updates batch quantity, and logs ledger entry', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            batch_id: 10,
            quantity_on_hand: 50,
            status: 'ACTIVE',
            expiry_date: '2027-05-15',
          },
        ],
      }) // 1. SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [] }) // 2. UPDATE batches
      .mockResolvedValueOnce({ rows: [{ entry_id: 101 }] }); // 3. INSERT INTO stock_ledger_entries

    const result = await applyLedgerEntry(mockClient, {
      batchId: 10,
      type: LEDGER_ENTRY_TYPE.INWARD,
      delta: 25,
      supplierName: 'Acme Pharma Corp',
      userId: '11111111-1111-4111-a111-111111111111',
    });

    expect(result).toEqual({
      entryId: 101,
      balanceAfter: 75,
    });

    // Verify lock query
    expect(mockQuery).toHaveBeenNthCalledWith(
      1,
      'SELECT batch_id, quantity_on_hand, status, expiry_date FROM batches WHERE batch_id = $1 FOR UPDATE',
      [10]
    );

    // Verify update query
    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      'UPDATE batches SET quantity_on_hand = $1, updated_at = NOW() WHERE batch_id = $2',
      [75, 10]
    );

    // Verify insert ledger query
    expect(mockQuery).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('INSERT INTO stock_ledger_entries'),
      [
        10,
        LEDGER_ENTRY_TYPE.INWARD,
        25,
        75,
        null,
        'Acme Pharma Corp',
        null,
        null,
        '11111111-1111-4111-a111-111111111111',
      ]
    );
  });

  it('successfully processes OUTWARD decrementing balance', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            batch_id: 20,
            quantity_on_hand: 100,
            status: 'ACTIVE',
            expiry_date: '2027-10-31',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ entry_id: 202 }] });

    const result = await applyLedgerEntry(mockClient, {
      batchId: 20,
      type: LEDGER_ENTRY_TYPE.OUTWARD,
      delta: -40,
      orderId: 55,
      orderItemId: 110,
    });

    expect(result).toEqual({
      entryId: 202,
      balanceAfter: 60,
    });

    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      'UPDATE batches SET quantity_on_hand = $1, updated_at = NOW() WHERE batch_id = $2',
      [60, 20]
    );
  });

  it('allows CORRECTION in both positive and negative directions', async () => {
    // 1. Positive correction
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ batch_id: 5, quantity_on_hand: 10, status: 'ACTIVE', expiry_date: '2026-12-31' }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ entry_id: 301 }] });

    const resPositive = await applyLedgerEntry(mockClient, {
      batchId: 5,
      type: LEDGER_ENTRY_TYPE.CORRECTION,
      delta: 3,
      reason: 'Audit surplus found',
    });
    expect(resPositive.balanceAfter).toBe(13);

    // 2. Negative correction
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ batch_id: 5, quantity_on_hand: 13, status: 'ACTIVE', expiry_date: '2026-12-31' }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ entry_id: 302 }] });

    const resNegative = await applyLedgerEntry(mockClient, {
      batchId: 5,
      type: LEDGER_ENTRY_TYPE.CORRECTION,
      delta: -2,
      reason: 'Broken vial during count',
    });
    expect(resNegative.balanceAfter).toBe(11);
  });
});
