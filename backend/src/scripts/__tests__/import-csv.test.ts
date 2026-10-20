import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsvLines, importSaltsFromCsv } from '../import-salts.js';
import { parseCsvRows, parseCsvLineTokens, importMedicinesFromCsv } from '../import-medicines.js';
import * as db from '../../config/db.js';

describe('Master Data CSV Import Tests (Plan 11-04)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('CSV Parsing Primitives', () => {
    it('splits raw lines and ignores empty rows', () => {
      const sample = "Paracetamol\n\nAmoxicillin\r\nIbuprofen\n";
      const lines = parseCsvLines(sample);
      expect(lines).toEqual(['Paracetamol', 'Amoxicillin', 'Ibuprofen']);
    });

    it('parses comma-separated tokens honoring quotes', () => {
      const line = 'Crocin 650,GSK,15 Tablets,33.50,12,"Paracetamol, Caffeine"';
      const tokens = parseCsvLineTokens(line);
      expect(tokens.length).toBe(6);
      expect(tokens[0]).toBe('Crocin 650');
      expect(tokens[5]).toBe('Paracetamol, Caffeine');
    });

    it('extracts structured objects from CSV content with headers', () => {
      const content = `name,company,pack_size,mrp,gst_rate,hsn_code,salts
Crocin 650,GSK,15 Tablets,33.50,12,30049099,Paracetamol`;
      const rows = parseCsvRows(content);
      expect(rows.length).toBe(1);
      expect(rows[0]['name']).toBe('Crocin 650');
      expect(rows[0]['mrp']).toBe('33.50');
    });
  });

  describe('Salt Master CSV Import', () => {
    it('validates template in dry-run mode without modifying database', async () => {
      vi.spyOn(db, 'query').mockResolvedValue({
        rows: [{ salt_id: 1, salt_name: 'Paracetamol' }],
        rowCount: 1,
      });

      const templatePath = fileURLToPath(new URL('../../../data/salts-template.csv', import.meta.url));
      const summary = await importSaltsFromCsv(templatePath, true);

      expect(summary.totalRows).toBeGreaterThan(0);
      expect(summary.insertedCount).toBe(0); // Dry-run
      expect(summary.duplicatesSkipped).toBe(1); // Paracetamol already exists
      expect(summary.validInserts).toBeGreaterThan(0);
    });

    it('inserts non-duplicate salts in live mode inside a transaction', async () => {
      vi.spyOn(db, 'query').mockResolvedValue({ rows: [], rowCount: 0 });

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      };
      vi.spyOn(db.pool, 'connect').mockResolvedValue(mockClient as any);

      const templatePath = fileURLToPath(new URL('../../../data/salts-template.csv', import.meta.url));
      const summary = await importSaltsFromCsv(templatePath, false);

      expect(summary.insertedCount).toBe(summary.validInserts);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });
  });

  describe('Medicine Master CSV Import', () => {
    it('validates medicines and resolves associated salts', async () => {
      // Mock salt lookup returning known salts
      vi.spyOn(db, 'query').mockImplementation(async (sql: string) => {
        if (typeof sql === 'string' && sql.includes('FROM salts')) {
          return {
            rows: [
              { salt_id: 1, salt_name: 'Paracetamol' },
              { salt_id: 2, salt_name: 'Amoxicillin' },
              { salt_id: 3, salt_name: 'Ibuprofen' },
              { salt_id: 4, salt_name: 'Pantoprazole' },
              { salt_id: 5, salt_name: 'Azithromycin' },
            ],
            rowCount: 5,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const templatePath = fileURLToPath(new URL('../../../data/medicines-template.csv', import.meta.url));
      const summary = await importMedicinesFromCsv(templatePath, true);

      expect(summary.totalRows).toBe(5);
      expect(summary.errorsCount).toBe(0);
      expect(summary.validInserts).toBe(5);
      expect(summary.insertedCount).toBe(0); // Dry run
    });

    it('flags row error when referenced salt is unknown in database', async () => {
      // Return empty salts table
      vi.spyOn(db, 'query').mockResolvedValue({ rows: [], rowCount: 0 });

      const templatePath = fileURLToPath(new URL('../../../data/medicines-template.csv', import.meta.url));
      const summary = await importMedicinesFromCsv(templatePath, true);

      expect(summary.errorsCount).toBeGreaterThan(0);
      expect(summary.validInserts).toBe(0);
      expect(summary.details[0].status).toBe('ERROR');
      expect(summary.details[0].errors?.[0]).toContain('Unknown salt');
    });
  });
});
