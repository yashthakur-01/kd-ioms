import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';
import { pool, query, withTransaction } from '../config/db.js';

dotenv.config();

const medicineRowSchema = z.object({
  name: z.string().min(2, 'Medicine name must be at least 2 characters'),
  company: z.string().min(2, 'Manufacturer company must be at least 2 characters'),
  pack_size: z.string().min(1, 'Pack size is required'),
  mrp: z.coerce.number().positive('MRP must be greater than zero'),
  gst_rate: z.coerce.number().refine((val) => [0, 5, 12, 18, 28].includes(val), {
    message: 'GST rate must be one of [0, 5, 12, 18, 28]',
  }),
  hsn_code: z.string().optional().default(''),
  salts: z.string().optional().default(''),
});

export type MedicineRow = z.infer<typeof medicineRowSchema>;

export interface MedicineImportSummary {
  totalRows: number;
  validInserts: number;
  errorsCount: number;
  insertedCount: number;
  details: Array<{
    line: number;
    medicineName: string;
    company: string;
    status: 'VALID' | 'ERROR' | 'INSERTED';
    errors?: string[];
  }>;
}

export function parseCsvRows(content: string): Array<Record<string, string>> {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCsvLineTokens(lines[0]).map((h) => h.toLowerCase().trim());
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const tokens = parseCsvLineTokens(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = tokens[idx] !== undefined ? tokens[idx].trim() : '';
    });
    rows.push(row);
  }

  return rows;
}

export function parseCsvLineTokens(line: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      tokens.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  tokens.push(current.trim());
  return tokens;
}

export async function importMedicinesFromCsv(
  filePath: string,
  dryRun: boolean = false
): Promise<MedicineImportSummary> {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`CSV file not found: ${resolvedPath}`);
  }

  const rawContent = fs.readFileSync(resolvedPath, 'utf8');
  const rawRows = parseCsvRows(rawContent);

  if (rawRows.length === 0) {
    throw new Error('CSV file contains no data rows');
  }

  // Pre-load all salts to resolve names to IDs
  const { rows: saltRows } = await query<{ salt_id: number; salt_name: string }>(
    'SELECT salt_id, salt_name FROM salts'
  );
  const saltMap = new Map<string, number>();
  saltRows.forEach((s) => saltMap.set(s.salt_name.toLowerCase().trim(), s.salt_id));

  const summary: MedicineImportSummary = {
    totalRows: rawRows.length,
    validInserts: 0,
    errorsCount: 0,
    insertedCount: 0,
    details: [],
  };

  const validatedItems: Array<{
    data: MedicineRow;
    saltIds: number[];
    line: number;
  }> = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const lineNum = i + 2; // +1 for 0-index, +1 for header
    const parseResult = medicineRowSchema.safeParse(row);

    if (!parseResult.success) {
      summary.errorsCount++;
      summary.details.push({
        line: lineNum,
        medicineName: row['name'] || 'Unknown',
        company: row['company'] || 'Unknown',
        status: 'ERROR',
        errors: parseResult.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`),
      });
      continue;
    }

    const medData = parseResult.data;
    const saltNames = medData.salts
      ? medData.salts.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
      : [];

    const saltIds: number[] = [];
    const unknownSalts: string[] = [];

    for (const name of saltNames) {
      const id = saltMap.get(name.toLowerCase());
      if (id !== undefined) {
        saltIds.push(id);
      } else {
        unknownSalts.push(name);
      }
    }

    if (unknownSalts.length > 0) {
      summary.errorsCount++;
      summary.details.push({
        line: lineNum,
        medicineName: medData.name,
        company: medData.company,
        status: 'ERROR',
        errors: [`Unknown salt(s): ${unknownSalts.join(', ')} — please import salts first.`],
      });
      continue;
    }

    summary.validInserts++;
    summary.details.push({
      line: lineNum,
      medicineName: medData.name,
      company: medData.company,
      status: 'VALID',
    });

    validatedItems.push({
      data: medData,
      saltIds,
      line: lineNum,
    });
  }

  if (!dryRun && validatedItems.length > 0) {
    await withTransaction(async (client) => {
      for (const item of validatedItems) {
        const { data, saltIds } = item;
        const { rows: medRows } = await client.query<{ medicine_id: number }>(
          `INSERT INTO medicines (name, company, pack_size, mrp, gst_rate, hsn_code, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
           RETURNING medicine_id;`,
          [data.name, data.company, data.pack_size, data.mrp, data.gst_rate, data.hsn_code]
        );

        const medicineId = medRows[0].medicine_id;

        for (const saltId of saltIds) {
          await client.query(
            `INSERT INTO medicine_salts (medicine_id, salt_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING;`,
            [medicineId, saltId]
          );
        }
      }
    });
    summary.insertedCount = validatedItems.length;
  }

  return summary;
}

if (process.argv[1]?.endsWith('import-medicines.ts') || process.argv[1]?.endsWith('import-medicines.js')) {
  const filePath = process.argv[2] || 'data/medicines-template.csv';
  const isDryRun = process.argv.includes('--dry-run');

  console.log(`Starting Medicine Master Import [Dry-Run: ${isDryRun}] from ${filePath}...`);
  importMedicinesFromCsv(filePath, isDryRun)
    .then((summary) => {
      console.log('\n--- Medicine Import Summary ---');
      console.log(`Total Rows:       ${summary.totalRows}`);
      console.log(`Valid Candidates: ${summary.validInserts}`);
      console.log(`Errors / Skipped: ${summary.errorsCount}`);
      console.log(`Actual Inserts:   ${summary.insertedCount}`);
      process.exit(summary.errorsCount === 0 ? 0 : 1);
    })
    .catch((err) => {
      console.error('Import failed:', err);
      process.exit(1);
    })
    .finally(() => pool.end());
}
