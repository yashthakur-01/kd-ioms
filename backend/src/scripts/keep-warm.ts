import dotenv from 'dotenv';
import { logger } from '../config/logger.js';

dotenv.config();

const TARGET_URL = process.env.KEEP_WARM_URL || `http://localhost:${process.env.PORT || 5000}/api/v1/health`;
const INTERVAL_MS = Number(process.env.KEEP_WARM_INTERVAL_MS) || 10 * 60 * 1000; // 10 minutes default

export async function pingHealth(url: string = TARGET_URL): Promise<{ status: number; durationMs: number; ok: boolean }> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'KD-IOMS-KeepWarm/1.0' },
    });
    const durationMs = Date.now() - start;
    const ok = res.status === 200;

    logger.info({ url, status: res.status, durationMs, ok }, '[KEEP-WARM] Health ping response');
    return { status: res.status, durationMs, ok };
  } catch (err: any) {
    const durationMs = Date.now() - start;
    logger.warn({ url, durationMs, error: err.message }, '[KEEP-WARM ERROR] Health ping failed');
    return { status: 0, durationMs, ok: false };
  }
}

export function startKeepWarmLoop(url: string = TARGET_URL, intervalMs: number = INTERVAL_MS): NodeJS.Timeout {
  logger.info({ url, intervalMs }, '[KEEP-WARM] Starting periodic keep-warm loop');
  // Initial ping
  pingHealth(url).catch(() => {});

  const timer = setInterval(() => {
    pingHealth(url).catch(() => {});
  }, intervalMs);

  timer.unref();
  return timer;
}

if (process.argv[1]?.endsWith('keep-warm.ts') || process.argv[1]?.endsWith('keep-warm.js')) {
  console.log(`Pinging keep-warm health check at ${TARGET_URL}...`);
  pingHealth().then((result) => {
    console.log(`Completed keep-warm ping in ${result.durationMs}ms with status: ${result.status} (ok: ${result.ok})`);
    process.exit(result.ok ? 0 : 1);
  });
}
