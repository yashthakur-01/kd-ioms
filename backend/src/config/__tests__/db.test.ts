import { describe, it, expect, vi } from 'vitest';
import { lockMedicines, lockBatches, withTransaction, pool } from '../db.js';

describe('Database Configuration & Transaction Utilities', () => {
  it('lockMedicines deduplicates and sorts medicine IDs in ascending order', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };

    await lockMedicines(mockClient as any, [42, 5, 19, 5, 100]);

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY medicine_id ASC FOR UPDATE'),
      [[5, 19, 42, 100]]
    );
  });

  it('lockBatches deduplicates and sorts batch IDs in ascending order', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };

    await lockBatches(mockClient as any, [300, 10, 85, 10]);

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY batch_id ASC FOR UPDATE'),
      [[10, 85, 300]]
    );
  });

  it('withTransaction executes BEGIN, commit, and releases client on success', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({}),
      release: vi.fn(),
    };
    vi.spyOn(pool, 'connect').mockResolvedValue(mockClient as any);

    const result = await withTransaction(async (client) => {
      await client.query('SELECT 1');
      return 'SUCCESS';
    });

    expect(result).toBe('SUCCESS');
    expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mockClient.query).toHaveBeenNthCalledWith(2, 'SELECT 1');
    expect(mockClient.query).toHaveBeenNthCalledWith(3, 'COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('withTransaction executes ROLLBACK and releases client on error', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({}),
      release: vi.fn(),
    };
    vi.spyOn(pool, 'connect').mockResolvedValue(mockClient as any);

    await expect(
      withTransaction(async () => {
        throw new Error('Transaction simulated failure');
      })
    ).rejects.toThrow();

    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalled();
  });
});
