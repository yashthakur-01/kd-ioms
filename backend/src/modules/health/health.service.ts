import { query, pool } from '../../config/db.js';
import { AppError } from '../../errors/app-error.js';
import { ERROR_CODES } from '../../constants/error-codes.js';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  db: 'up' | 'down';
  version: string;
  uptimeSeconds: number;
  pool?: {
    total: number;
    idle: number;
    waiting: number;
  };
  memory?: {
    rssMb: number;
    heapUsedMb: number;
  };
}

const startTime = Date.now();

export async function checkHealth(): Promise<HealthStatus> {
  try {
    const res = await query('SELECT 1 AS check');
    if (!res.rows.length) {
      throw new Error('Database check query returned no rows');
    }

    const mem = process.memoryUsage();

    return {
      status: 'ok',
      db: 'up',
      version: '1.0.0',
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      pool: {
        total: pool.totalCount ?? 0,
        idle: pool.idleCount ?? 0,
        waiting: pool.waitingCount ?? 0,
      },
      memory: {
        rssMb: Number((mem.rss / (1024 * 1024)).toFixed(2)),
        heapUsedMb: Number((mem.heapUsed / (1024 * 1024)).toFixed(2)),
      },
    };
  } catch (err) {
    throw new AppError({
      code: ERROR_CODES.DB_DOWN,
      httpStatus: 503,
      message: 'Database service is currently unreachable',
      cause: err,
    });
  }
}
