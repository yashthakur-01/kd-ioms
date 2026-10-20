import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { pool, query } from '../config/db.js';

dotenv.config();

export interface VerificationReport {
  isValid: boolean;
  sha256Match: boolean;
  calculatedHash: string;
  expectedHash: string;
  tablesVerified: number;
  statementCount: number;
}

export function verifyBackupChecksum(sqlPath: string, sha256Path?: string): { matches: boolean; hash: string; expected: string } {
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`Backup file does not exist: ${sqlPath}`);
  }

  const expectedShaPath = sha256Path || sqlPath.replace(/\.sql$/, '.sha256');
  if (!fs.existsSync(expectedShaPath)) {
    throw new Error(`Checksum file does not exist: ${expectedShaPath}`);
  }

  const content = fs.readFileSync(sqlPath, 'utf8');
  const calculated = crypto.createHash('sha256').update(content).digest('hex');

  const shaContent = fs.readFileSync(expectedShaPath, 'utf8').trim();
  const expected = shaContent.split(/\s+/)[0];

  return {
    matches: calculated.toLowerCase() === expected.toLowerCase(),
    hash: calculated,
    expected,
  };
}

export async function verifyRestoreDryRun(sqlPath: string): Promise<VerificationReport> {
  const checksumResult = verifyBackupChecksum(sqlPath);
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Count statements
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));

  // Count distinct table targets in insert statements
  const tableMatches = sql.match(/INSERT INTO "([^"]+)"/g) || [];
  const distinctTables = new Set(tableMatches.map((m) => m.replace(/INSERT INTO "([^"]+)"/, '$1')));

  return {
    isValid: checksumResult.matches,
    sha256Match: checksumResult.matches,
    calculatedHash: checksumResult.hash,
    expectedHash: checksumResult.expected,
    tablesVerified: distinctTables.size,
    statementCount: statements.length,
  };
}

if (process.argv[1]?.endsWith('verify-restore.ts') || process.argv[1]?.endsWith('verify-restore.js')) {
  const backupFile = process.argv[2];
  if (!backupFile) {
    console.error('Usage: tsx src/scripts/verify-restore.ts <path/to/backup.sql>');
    process.exit(1);
  }

  verifyRestoreDryRun(backupFile)
    .then((report) => {
      console.log('--- Backup Verification & Restore Report ---');
      console.log(`SHA-256 Checksum Match: ${report.sha256Match ? 'PASS' : 'FAIL'}`);
      console.log(`Calculated Hash: ${report.calculatedHash}`);
      console.log(`Expected Hash:   ${report.expectedHash}`);
      console.log(`Distinct Tables: ${report.tablesVerified}`);
      console.log(`SQL Statements:  ${report.statementCount}`);
      process.exit(report.isValid ? 0 : 1);
    })
    .catch((err) => {
      console.error('Verification failed:', err);
      process.exit(1);
    })
    .finally(() => pool.end());
}
