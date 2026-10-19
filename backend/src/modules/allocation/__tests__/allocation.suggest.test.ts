import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as db from '../../../config/db.js';
import { allocationService } from '../allocation.service.js';
import { ConflictError, NotFoundError } from '../../../errors/app-error.js';
import { ERROR_CODES } from '../../../constants/error-codes.js';

describe('AllocationService - FEFO Pick Suggestions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('throws NotFoundError when order does not exist', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('FROM orders')) {
        return { rows: [], rowCount: 0 } as any;
      }
      return { rows: [], rowCount: 0 } as any;
    });

    await expect(allocationService.suggest(999)).rejects.toThrow(NotFoundError);
  });

  it('throws ConflictError with INVALID_STATE_TRANSITION when order is not PLACED', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('FROM orders')) {
        return {
          rows: [{ order_id: 1, order_number: 'ORD-000001', status: 'APPROVED' }],
          rowCount: 1,
        } as any;
      }
      return { rows: [], rowCount: 0 } as any;
    });

    await expect(allocationService.suggest(1)).rejects.toThrow(ConflictError);
  });

  it('generates FEFO ordered suggestions and calculates greedy suggestedQty', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('FROM orders')) {
        return {
          rows: [{ order_id: 10, order_number: 'ORD-000010', status: 'PLACED' }],
          rowCount: 1,
        } as any;
      }

      if (sql.includes('FROM order_items')) {
        return {
          rows: [
            {
              order_item_id: 101,
              medicine_id: 50,
              requested_quantity: 15,
              quoted_price_incl_gst: '120.00',
              medicine_name: 'Paracetamol 650mg',
              company: 'GSK',
              pack_size: '10 Tablets',
            },
          ],
          rowCount: 1,
        } as any;
      }

      if (sql.includes('FROM batches')) {
        return {
          rows: [
            // Earliest expiring batch (FEFO) with 10 on hand, within quote -> suggestedQty = 10
            {
              batch_id: 1,
              batch_number: 'BATCH-EARLY',
              expiry_date: '2026-11-30',
              mrp: '130.00',
              selling_price: '100.00',
              gst_rate: '12.00',
              quantity_on_hand: 10,
              price_incl_gst: '112.00',
            },
            // Second expiring batch with 20 on hand, within quote -> suggestedQty = 5 (completing 15)
            {
              batch_id: 2,
              batch_number: 'BATCH-MID',
              expiry_date: '2027-01-31',
              mrp: '130.00',
              selling_price: '100.00',
              gst_rate: '12.00',
              quantity_on_hand: 20,
              price_incl_gst: '112.00',
            },
            // Third expiring batch -> suggestedQty = 0 (needed fulfilled)
            {
              batch_id: 3,
              batch_number: 'BATCH-LATE',
              expiry_date: '2027-05-31',
              mrp: '130.00',
              selling_price: '100.00',
              gst_rate: '12.00',
              quantity_on_hand: 50,
              price_incl_gst: '112.00',
            },
          ],
          rowCount: 3,
        } as any;
      }

      return { rows: [], rowCount: 0 } as any;
    });

    const res = await allocationService.suggest(10);
    expect(res.orderId).toBe(10);
    expect(res.orderNumber).toBe('ORD-000010');
    expect(res.items.length).toBe(1);

    const item = res.items[0];
    expect(item.orderItemId).toBe(101);
    expect(item.requestedQuantity).toBe(15);
    expect(item.suggestions.length).toBe(3);

    // Verify FEFO suggestions
    expect(item.suggestions[0].batchNumber).toBe('BATCH-EARLY');
    expect(item.suggestions[0].withinQuote).toBe(true);
    expect(item.suggestions[0].suggestedQty).toBe(10);

    expect(item.suggestions[1].batchNumber).toBe('BATCH-MID');
    expect(item.suggestions[1].withinQuote).toBe(true);
    expect(item.suggestions[1].suggestedQty).toBe(5);

    expect(item.suggestions[2].batchNumber).toBe('BATCH-LATE');
    expect(item.suggestions[2].withinQuote).toBe(true);
    expect(item.suggestions[2].suggestedQty).toBe(0);
  });

  it('marks batches exceeding quoted ceiling as withinQuote: false and skips them for suggestedQty', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('FROM orders')) {
        return {
          rows: [{ order_id: 11, order_number: 'ORD-000011', status: 'PLACED' }],
          rowCount: 1,
        } as any;
      }

      if (sql.includes('FROM order_items')) {
        return {
          rows: [
            {
              order_item_id: 102,
              medicine_id: 55,
              requested_quantity: 10,
              quoted_price_incl_gst: '100.00', // Quoted 100.00
              medicine_name: 'Amoxicillin',
              company: 'Abbott',
              pack_size: '10 Capsules',
            },
          ],
          rowCount: 1,
        } as any;
      }

      if (sql.includes('FROM batches')) {
        return {
          rows: [
            // Earliest expiring batch has price 112.00 > quote 100.00!
            {
              batch_id: 1,
              batch_number: 'EXPENSIVE-BATCH',
              expiry_date: '2026-12-31',
              mrp: '130.00',
              selling_price: '100.00',
              gst_rate: '12.00',
              quantity_on_hand: 50,
              price_incl_gst: '112.00',
            },
            // Second batch has price 90.00 <= quote 100.00 -> should be suggested!
            {
              batch_id: 2,
              batch_number: 'AFFORDABLE-BATCH',
              expiry_date: '2027-02-28',
              mrp: '110.00',
              selling_price: '80.00',
              gst_rate: '12.00',
              quantity_on_hand: 8,
              price_incl_gst: '89.60',
            },
          ],
          rowCount: 2,
        } as any;
      }

      return { rows: [], rowCount: 0 } as any;
    });

    const res = await allocationService.suggest(11);
    const item = res.items[0];

    // Batch 1 exceeds quote
    expect(item.suggestions[0].batchNumber).toBe('EXPENSIVE-BATCH');
    expect(item.suggestions[0].withinQuote).toBe(false);
    expect(item.suggestions[0].suggestedQty).toBe(0);

    // Batch 2 within quote
    expect(item.suggestions[1].batchNumber).toBe('AFFORDABLE-BATCH');
    expect(item.suggestions[1].withinQuote).toBe(true);
    expect(item.suggestions[1].suggestedQty).toBe(8); // Available stock is 8, so capped at 8
  });
});
