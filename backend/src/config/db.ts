import pg from 'pg';
import { mapDbError } from '../utils/db-error-map.js';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

const isProduction = process.env.NODE_ENV === 'production';
const isRemoteSupabase = connectionString.includes('supabase.co') || connectionString.includes('pooler.supabase.com');

export const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: isProduction || isRemoteSupabase ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  console.error('[DATABASE POOL ERROR]', err);
});

export interface QueryResult<T extends pg.QueryResultRow = any> {
  rows: T[];
  rowCount: number | null;
}

export async function query<T extends pg.QueryResultRow = any>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (duration > 500) {
      console.warn(`[SLOW QUERY] ${duration}ms: ${text.slice(0, 150)}`);
    }
    return {
      rows: res.rows,
      rowCount: res.rowCount,
    };
  } catch (err) {
    throw mapDbError(err);
  }
}

export interface TransactionOptions {
  retries?: number;
}

export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
  { retries = 2 }: TransactionOptions = {}
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err: any) {
      await client.query('ROLLBACK');
      const isRetryable = ['40001', '40P01'].includes(err?.code);
      if (isRetryable && attempt < retries) {
        console.warn(`[TRANSACTION RETRY] Attempt ${attempt + 1}/${retries} on code ${err.code}`);
        continue;
      }
      throw mapDbError(err);
    } finally {
      client.release();
    }
  }
}

export async function lockMedicines(client: pg.PoolClient, medicineIds: number[]): Promise<void> {
  if (!medicineIds.length) return;
  const sortedIds = [...new Set(medicineIds)].sort((a, b) => a - b);
  await client.query(
    'SELECT medicine_id FROM medicines WHERE medicine_id = ANY($1::int[]) ORDER BY medicine_id ASC FOR UPDATE',
    [sortedIds]
  );
}

export async function lockBatches(client: pg.PoolClient, batchIds: number[]): Promise<void> {
  if (!batchIds.length) return;
  const sortedIds = [...new Set(batchIds)].sort((a, b) => a - b);
  await client.query(
    'SELECT batch_id FROM batches WHERE batch_id = ANY($1::int[]) ORDER BY batch_id ASC FOR UPDATE',
    [sortedIds]
  );
}
