import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { pool } from '../config/db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDir = path.resolve(__dirname, '../../migrations');

async function runMigrations() {
  console.log('[MIGRATION] Starting database migration runner...');
  const client = await pool.connect();

  try {
    // 1. Ensure schema_migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Read all .sql files in migrations dir
    if (!fs.existsSync(migrationsDir)) {
      console.log('[MIGRATION] No migrations directory found. Skipping.');
      return;
    }

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    // 3. Get applied migrations
    const { rows: appliedRows } = await client.query<{ name: string }>(
      'SELECT name FROM schema_migrations'
    );
    const appliedSet = new Set(appliedRows.map((r) => r.name));

    // 4. Run pending migrations in order
    let count = 0;
    for (const file of migrationFiles) {
      if (appliedSet.has(file)) {
        continue;
      }

      console.log(`[MIGRATION] Applying: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      const startTime = Date.now();
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (name) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        console.log(`[MIGRATION] Applied ${file} in ${Date.now() - startTime}ms`);
        count++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[MIGRATION ERROR] Failed to apply ${file}:`, err);
        throw err;
      }
    }

    console.log(`[MIGRATION] Finished. ${count} new migration(s) applied.`);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error('[MIGRATION FATAL ERROR]', err);
  process.exit(1);
});
