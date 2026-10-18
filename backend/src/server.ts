import { app } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import { logger } from './config/logger.js';

const PORT = env.PORT;

const server = app.listen(PORT, () => {
  logger.info(`[KD-IOMS SERVER] Listening on port ${PORT} in ${env.NODE_ENV} mode`);
});

// Graceful shutdown handling
function gracefulShutdown(signal: string) {
  logger.info(`[KD-IOMS SERVER] Received ${signal}. Draining connections and shutting down gracefully...`);

  server.close(async () => {
    logger.info('[KD-IOMS SERVER] HTTP server closed.');
    try {
      await pool.end();
      logger.info('[KD-IOMS SERVER] PostgreSQL pool closed successfully.');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, '[KD-IOMS SERVER ERROR] Error closing database pool.');
      process.exit(1);
    }
  });

  // Force close if graceful drain takes too long
  setTimeout(() => {
    logger.error('[KD-IOMS SERVER] Forceful shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
