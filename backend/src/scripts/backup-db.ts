import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { pool, query } from '../config/db.js';

dotenv.config();

export interface BackupResult {
  sqlPath: string;
  sha256Path: string;
  metaPath: string;
  sha256: string;
  fileSizeBytes: number;
  tableCounts: Record<string, number>;
  timestamp: string;
}

export async function createDatabaseBackup(outputDir: string = 'backups', keepCount: number = 7): Promise<BackupResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resolvedDir = path.resolve(process.cwd(), outputDir);

  if (!fs.existsSync(resolvedDir)) {
    fs.mkdirSync(resolvedDir, { recursive: true });
  }

  const baseFilename = `kd_ioms_backup_${timestamp}`;
  const sqlPath = path.join(resolvedDir, `${baseFilename}.sql`);
  const sha256Path = path.join(resolvedDir, `${baseFilename}.sha256`);
  const metaPath = path.join(resolvedDir, `${baseFilename}.meta.json`);

  // Query all user tables in public schema
  const { rows: tableRows } = await query<{ table_name: string }>(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name ASC;
  `);

  const tableCounts: Record<string, number> = {};
  const sqlChunks: string[] = [
    `-- KD-IOMS Automated Database Backup`,
    `-- Generated: ${new Date().toISOString()}`,
    `-- Database: PostgreSQL`,
    `BEGIN;`,
  ];

  for (const { table_name } of tableRows) {
    const { rows: countRows } = await query(`SELECT COUNT(*)::int AS cnt FROM "${table_name}"`);
    const count = countRows[0]?.cnt ?? 0;
    tableCounts[table_name] = count;

    // Fetch records
    const { rows: dataRows } = await query(`SELECT * FROM "${table_name}"`);
    if (dataRows.length > 0) {
      sqlChunks.push(`\n-- Table: ${table_name} (${count} rows)`);
      for (const row of dataRows) {
        const columns = Object.keys(row).map((k) => `"${k}"`).join(', ');
        const values = Object.values(row).map((val) => {
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'number' || typeof val === 'boolean') return String(val);
          if (val instanceof Date) return `'${val.toISOString()}'`;
          if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
          return `'${String(val).replace(/'/g, "''")}'`;
        }).join(', ');
        sqlChunks.push(`INSERT INTO "${table_name}" (${columns}) VALUES (${values}) ON CONFLICT DO NOTHING;`);
      }
    }
  }

  sqlChunks.push(`\nCOMMIT;`);
  const fullSql = sqlChunks.join('\n');

  // Write SQL file
  fs.writeFileSync(sqlPath, fullSql, 'utf8');

  // Calculate SHA-256
  const hash = crypto.createHash('sha256').update(fullSql).digest('hex');
  fs.writeFileSync(sha256Path, `${hash}  ${path.basename(sqlPath)}\n`, 'utf8');

  // Write Metadata
  const stats = fs.statSync(sqlPath);
  const metadata = {
    backupName: baseFilename,
    timestamp: new Date().toISOString(),
    sha256: hash,
    fileSizeBytes: stats.size,
    tablesCount: tableRows.length,
    tableRowCounts: tableCounts,
  };
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf8');

  // Prune older backups if keepCount specified
  pruneBackups(resolvedDir, keepCount);

  return {
    sqlPath,
    sha256Path,
    metaPath,
    sha256: hash,
    fileSizeBytes: stats.size,
    tableCounts,
    timestamp,
  };
}

export function pruneBackups(dir: string, keep: number): void {
  if (keep <= 0 || !fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir)
    .filter((f) => f.startsWith('kd_ioms_backup_') && f.endsWith('.sql'))
    .sort();

  if (files.length > keep) {
    const toRemove = files.slice(0, files.length - keep);
    for (const file of toRemove) {
      const base = file.replace(/\.sql$/, '');
      for (const ext of ['.sql', '.sha256', '.meta.json']) {
        const target = path.join(dir, `${base}${ext}`);
        if (fs.existsSync(target)) {
          fs.unlinkSync(target);
        }
      }
    }
  }
}

if (process.argv[1]?.endsWith('backup-db.ts') || process.argv[1]?.endsWith('backup-db.js')) {
  console.log('Initiating database backup...');
  createDatabaseBackup()
    .then((result) => {
      console.log(`✓ Backup created successfully: ${result.sqlPath}`);
      console.log(`  SHA-256: ${result.sha256}`);
      console.log(`  Size: ${(result.fileSizeBytes / 1024).toFixed(2)} KB`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal backup error:', err);
      process.exit(1);
    })
    .finally(() => pool.end());
}
