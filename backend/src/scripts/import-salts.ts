import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { pool, query, withTransaction } from '../config/db.js';

dotenv.config();

export interface SaltImportSummary {
  totalRows: number;
  validInserts: number;
  duplicatesSkipped: number;
  similarWarnings: number;
  insertedCount: number;
  details: Array<{
    line: number;
    saltName: string;
    status: 'INSERT' | 'DUPLICATE' | 'SIMILAR_WARNING' | 'INVALID';
    matchedWith?: string;
    error?: string;
  }>;
}

export function parseCsvLines(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export async function importSaltsFromCsv(
  filePath: string,
  dryRun: boolean = false
): Promise<SaltImportSummary> {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`CSV file not found: ${resolvedPath}`);
  }

  const rawContent = fs.readFileSync(resolvedPath, 'utf8');
  const lines = parseCsvLines(rawContent);

  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  // Header verification (skip header if 'salt_name')
  let startIndex = 0;
  if (lines[0].toLowerCase().includes('salt_name')) {
    startIndex = 1;
  }

  // Fetch all existing salts
  const { rows: existingSalts } = await query<{ salt_id: number; salt_name: string }>(
    'SELECT salt_id, salt_name FROM salts ORDER BY salt_name ASC'
  );

  const existingMap = new Map<string, string>();
  for (const s of existingSalts) {
    existingMap.set(s.salt_name.toLowerCase().trim(), s.salt_name);
  }

  const summary: SaltImportSummary = {
    totalRows: lines.length - startIndex,
    validInserts: 0,
    duplicatesSkipped: 0,
    similarWarnings: 0,
    insertedCount: 0,
    details: [],
  };

  const toInsert: string[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const rawName = lines[i].replace(/^["']|["']$/g, '').trim();
    const lineNum = i + 1;

    if (!rawName || rawName.length < 2) {
      summary.details.push({
        line: lineNum,
        saltName: rawName,
        status: 'INVALID',
        error: 'Salt name must be at least 2 characters',
      });
      continue;
    }

    const lower = rawName.toLowerCase();
    if (existingMap.has(lower) || toInsert.map((s) => s.toLowerCase()).includes(lower)) {
      summary.duplicatesSkipped++;
      summary.details.push({
        line: lineNum,
        saltName: rawName,
        status: 'DUPLICATE',
        matchedWith: existingMap.get(lower) || rawName,
      });
      continue;
    }

    toInsert.push(rawName);
    summary.validInserts++;
    summary.details.push({
      line: lineNum,
      saltName: rawName,
      status: 'INSERT',
    });
  }

  if (!dryRun && toInsert.length > 0) {
    await withTransaction(async (client) => {
      for (const salt of toInsert) {
        await client.query(
          'INSERT INTO salts (salt_name, created_at, updated_at) VALUES ($1, NOW(), NOW())',
          [salt]
        );
      }
    });
    summary.insertedCount = toInsert.length;
  }

  return summary;
}

if (process.argv[1]?.endsWith('import-salts.ts') || process.argv[1]?.endsWith('import-salts.js')) {
  const filePath = process.argv[2] || 'data/salts-template.csv';
  const isDryRun = process.argv.includes('--dry-run');

  console.log(`Starting Salt Master Import [Dry-Run: ${isDryRun}] from ${filePath}...`);
  importSaltsFromCsv(filePath, isDryRun)
    .then((summary) => {
      console.log('\n--- Salt Import Summary ---');
      console.log(`Total Processed:  ${summary.totalRows}`);
      console.log(`Valid Candidates: ${summary.validInserts}`);
      console.log(`Duplicates:       ${summary.duplicatesSkipped}`);
      console.log(`Actual Inserts:   ${summary.insertedCount}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Import failed:', err);
      process.exit(1);
    })
    .finally(() => pool.end());
}
