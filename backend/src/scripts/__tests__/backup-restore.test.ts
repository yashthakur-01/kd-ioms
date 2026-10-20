import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createDatabaseBackup, pruneBackups } from '../backup-db.js';
import { verifyBackupChecksum, verifyRestoreDryRun } from '../verify-restore.js';
import { pingHealth } from '../keep-warm.js';
import * as db from '../../config/db.js';

describe('Disaster Recovery, Backups & Observability Tests (Plan 11-03)', () => {
  const testOutputDir = path.resolve(process.cwd(), 'backups-test');

  beforeEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  it('generates SQL dump, SHA-256 hash, and metadata with correct values', async () => {
    // Mock DB queries for table listings and row extraction
    vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('information_schema.tables')) {
        return {
          rows: [{ table_name: 'medicines' }, { table_name: 'salts' }],
          rowCount: 2,
        };
      }
      if (typeof sql === 'string' && sql.includes('COUNT(*)')) {
        return {
          rows: [{ cnt: 2 }],
          rowCount: 1,
        };
      }
      if (typeof sql === 'string' && sql.includes('SELECT * FROM "medicines"')) {
        return {
          rows: [
            { medicine_id: 1, name: 'Paracetamol 500mg', mrp: '35.00' },
            { medicine_id: 2, name: 'Amoxicillin 250mg', mrp: '70.00' },
          ],
          rowCount: 2,
        };
      }
      if (typeof sql === 'string' && sql.includes('SELECT * FROM "salts"')) {
        return {
          rows: [{ salt_id: 1, salt_name: 'Paracetamol' }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const backup = await createDatabaseBackup('backups-test', 5);

    expect(fs.existsSync(backup.sqlPath)).toBe(true);
    expect(fs.existsSync(backup.sha256Path)).toBe(true);
    expect(fs.existsSync(backup.metaPath)).toBe(true);

    const check = verifyBackupChecksum(backup.sqlPath);
    expect(check.matches).toBe(true);
    expect(check.hash).toBe(backup.sha256);

    const report = await verifyRestoreDryRun(backup.sqlPath);
    expect(report.isValid).toBe(true);
    expect(report.tablesVerified).toBe(2);
    expect(report.statementCount).toBeGreaterThan(0);
  });

  it('detects tampering when SQL file content is modified', async () => {
    vi.spyOn(db, 'query').mockResolvedValue({
      rows: [{ table_name: 'salts' }],
      rowCount: 1,
    });

    const backup = await createDatabaseBackup('backups-test', 5);

    // Tamper with SQL file
    fs.appendFileSync(backup.sqlPath, '\n-- Unauthorized appended comment\n');

    const check = verifyBackupChecksum(backup.sqlPath);
    expect(check.matches).toBe(false);
  });

  it('prunes older backups exceeding keepCount limit', () => {
    fs.mkdirSync(testOutputDir, { recursive: true });

    // Create 4 fake backups
    for (let i = 1; i <= 4; i++) {
      const base = `kd_ioms_backup_2026-10-${10 + i}-00-00-00`;
      fs.writeFileSync(path.join(testOutputDir, `${base}.sql`), 'DUMP');
      fs.writeFileSync(path.join(testOutputDir, `${base}.sha256`), 'HASH');
      fs.writeFileSync(path.join(testOutputDir, `${base}.meta.json`), '{}');
    }

    pruneBackups(testOutputDir, 2);

    const remaining = fs.readdirSync(testOutputDir).filter((f) => f.endsWith('.sql'));
    expect(remaining.length).toBe(2);
    expect(remaining).toContain('kd_ioms_backup_2026-10-13-00-00-00.sql');
    expect(remaining).toContain('kd_ioms_backup_2026-10-14-00-00-00.sql');
  });

  it('pings health endpoint and records latency', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
    });
    global.fetch = fetchMock as any;

    const result = await pingHealth('http://localhost:5000/api/v1/health');
    expect(result.status).toBe(200);
    expect(result.ok).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
