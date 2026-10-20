import dotenv from 'dotenv';
import { pool, query } from '../config/db.js';

dotenv.config();

export interface QueryProfileResult {
  name: string;
  query: string;
  params: unknown[];
  planningTimeMs: number;
  executionTimeMs: number;
  totalTimeMs: number;
  rawPlan: string[];
  usesIndexScan: boolean;
}

export const PROFILE_QUERIES = [
  {
    name: 'Catalog Autocomplete / Search (v_catalog)',
    sql: `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT medicine_id, name, company, pack_size, salts_text, max_mrp, max_price_incl_gst, in_stock
      FROM v_catalog
      WHERE in_stock = true
        AND (name ILIKE $1 OR salts_text ILIKE $1)
      ORDER BY name ASC
      LIMIT 20 OFFSET 0;
    `,
    params: ['%para%'],
  },
  {
    name: 'Retailer Orders History with Joins',
    sql: `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT o.order_id, o.order_number, o.status, o.total_amount, o.created_at, r.pharmacy_name
      FROM orders o
      JOIN retailers r ON o.retailer_id = r.retailer_id
      WHERE o.retailer_id = $1
      ORDER BY o.created_at DESC
      LIMIT 50;
    `,
    params: [1],
  },
  {
    name: 'FEFO Batch Allocation Lookup',
    sql: `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT batch_id, batch_number, expiry_date, mrp, selling_price, quantity_on_hand
      FROM batches
      WHERE medicine_id = $1
        AND status = 'ACTIVE'
        AND expiry_date >= CURRENT_DATE
        AND quantity_on_hand > 0
      ORDER BY expiry_date ASC, batch_id ASC;
    `,
    params: [1],
  },
  {
    name: 'Stock Ledger History Lookup',
    sql: `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT entry_id, batch_id, movement_type, quantity_delta, balance_after, created_at
      FROM stock_ledger_entries
      WHERE batch_id = $1
      ORDER BY created_at DESC
      LIMIT 100;
    `,
    params: [1],
  },
];

export async function profileQuery(name: string, sql: string, params: unknown[] = []): Promise<QueryProfileResult> {
  const result = await query(sql, params);
  const planData = result.rows[0]['QUERY PLAN'][0];

  const planningTimeMs = planData['Planning Time'] || 0;
  const executionTimeMs = planData['Execution Time'] || 0;
  const totalTimeMs = Number((planningTimeMs + executionTimeMs).toFixed(3));

  const planText = JSON.stringify(planData, null, 2);
  const usesIndexScan = planText.includes('Index Scan') || planText.includes('Bitmap Index Scan') || planText.includes('Index Only Scan');

  return {
    name,
    query: sql,
    params,
    planningTimeMs,
    executionTimeMs,
    totalTimeMs,
    rawPlan: [planText],
    usesIndexScan,
  };
}

export async function runAllProfiles(): Promise<QueryProfileResult[]> {
  const results: QueryProfileResult[] = [];
  console.log('--- Starting KD-IOMS Database Query Profiler ---');

  for (const item of PROFILE_QUERIES) {
    try {
      const res = await profileQuery(item.name, item.sql, item.params);
      results.push(res);
      console.log(`✓ ${res.name}: Total ${res.totalTimeMs}ms (Planning: ${res.planningTimeMs}ms, Exec: ${res.executionTimeMs}ms) | Index Scan: ${res.usesIndexScan}`);
    } catch (err: any) {
      console.warn(`! Query profile failed for "${item.name}":`, err.message);
    }
  }

  return results;
}

// Direct execution CLI entrypoint
if (process.argv[1]?.endsWith('profile-queries.ts') || process.argv[1]?.endsWith('profile-queries.js')) {
  runAllProfiles()
    .then((results) => {
      console.log(`\nCompleted profiling ${results.length} queries successfully.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal profiling error:', err);
      process.exit(1);
    })
    .finally(() => pool.end());
}
