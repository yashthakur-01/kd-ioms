import { describe, it, expect, vi, beforeEach } from 'vitest';
import { profileQuery, PROFILE_QUERIES } from '../profile-queries.js';
import * as db from '../../config/db.js';

describe('Database Performance Profiling Tests (Plan 11-02)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('defines 4 critical production queries for profiling', () => {
    expect(PROFILE_QUERIES.length).toBe(4);
    const names = PROFILE_QUERIES.map((q) => q.name);
    expect(names).toContain('Catalog Autocomplete / Search (v_catalog)');
    expect(names).toContain('Retailer Orders History with Joins');
    expect(names).toContain('FEFO Batch Allocation Lookup');
    expect(names).toContain('Stock Ledger History Lookup');
  });

  it('profiles a query and extracts plan metrics with index scan detection', async () => {
    const mockPlan = [
      {
        Plan: {
          'Node Type': 'Index Scan',
          'Relation Name': 'batches',
          'Index Name': 'idx_batches_sellable',
          'Startup Cost': 0.15,
          'Total Cost': 8.17,
          'Plan Rows': 5,
        },
        'Planning Time': 0.145,
        'Execution Time': 0.285,
      },
    ];

    vi.spyOn(db, 'query').mockResolvedValue({
      rows: [{ 'QUERY PLAN': mockPlan }],
      rowCount: 1,
    });

    const result = await profileQuery('FEFO Test', 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT * FROM batches');

    expect(result.name).toBe('FEFO Test');
    expect(result.planningTimeMs).toBe(0.145);
    expect(result.executionTimeMs).toBe(0.285);
    expect(result.totalTimeMs).toBe(0.43);
    expect(result.usesIndexScan).toBe(true);
    expect(result.rawPlan.length).toBeGreaterThan(0);
  });

  it('detects sequential scans when index is not utilized in query plan', async () => {
    const mockPlan = [
      {
        Plan: {
          'Node Type': 'Seq Scan',
          'Relation Name': 'medicines',
          'Startup Cost': 0.0,
          'Total Cost': 120.5,
          'Plan Rows': 1000,
        },
        'Planning Time': 0.08,
        'Execution Time': 1.15,
      },
    ];

    vi.spyOn(db, 'query').mockResolvedValue({
      rows: [{ 'QUERY PLAN': mockPlan }],
      rowCount: 1,
    });

    const result = await profileQuery('Unindexed Scan', 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT * FROM medicines');

    expect(result.usesIndexScan).toBe(false);
    expect(result.totalTimeMs).toBe(1.23);
  });
});
