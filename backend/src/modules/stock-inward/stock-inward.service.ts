import { withTransaction, lockMedicines, query } from '../../config/db.js';
import { BusinessRuleError, NotFoundError } from '../../errors/app-error.js';
import { parseGs1 } from '../../utils/gtin.js';
import { todayIst } from '../../utils/dates.js';
import { toPaise, fromPaise, addGst } from '../../utils/money.js';
import { applyLedgerEntry } from '../stock-ledger/stock-ledger.service.js';
import { LEDGER_ENTRY_TYPE } from '../../enums/ledger-entry-type.enum.js';
import type { AuthenticatedUser } from '../../types/express.js';
import type { InwardStockInput } from './stock-inward.validation.js';

export interface MedicineSuggestion {
  medicineId: number;
  name: string;
  company: string;
  packSize: string;
  gstRate: number;
}

export interface MatchedMedicineInfo {
  medicineId: number;
  name: string;
  company: string;
  packSize: string;
  gstRate: number;
  saltsText?: string;
}

export interface MatchedBatchInfo {
  batchId: number;
  batchNumber: string;
  expiryDate: string;
  mrp: string;
  sellingPrice: string;
  purchaseRate: string;
  quantityOnHand: number;
}

export interface ResolveScanResult {
  gtin?: string;
  batchNumber?: string;
  expiryDate?: string;
  mrp?: string;
  parsedGs1?: {
    gtin?: string;
    batchNumber?: string;
    expiryDate?: string;
    serialNumber?: string;
  };
  matchedMedicine?: MatchedMedicineInfo;
  matchedBatch?: MatchedBatchInfo;
  medicineSuggestions: MedicineSuggestion[];
}

export interface InwardStockResult {
  batch: {
    batchId: number;
    medicineId: number;
    batchNumber: string;
    expiryDate: string;
    mrp: string;
    sellingPrice: string;
    purchaseRate: string;
    quantityOnHand: number;
    status: string;
    gtin: string | null;
  };
  ledgerEntry: {
    entryId: number;
    balanceAfter: number;
  };
  batchCreated: boolean;
}

/**
 * Pre-resolves raw barcode/QR/DataMatrix or OCR scan payload.
 */
export async function resolveScan(payload: string): Promise<ResolveScanResult> {
  const parsed = parseGs1(payload);
  const medicineSuggestions: MedicineSuggestion[] = [];
  let matchedMedicine: MatchedMedicineInfo | undefined = undefined;
  let matchedBatch: MatchedBatchInfo | undefined = undefined;

  // 1. Look up by GTIN if present
  if (parsed.gtin) {
    const res = await query<{
      medicine_id: number;
      name: string;
      company: string;
      pack_size: string;
      gst_rate: string | number;
      salts_text: string;
      batch_id: number;
      batch_number: string;
      expiry_date: string | Date;
      mrp: string | number;
      selling_price: string | number;
      purchase_rate: string | number;
      quantity_on_hand: number;
    }>(
      `SELECT 
         m.medicine_id, m.name, m.company, m.pack_size, m.gst_rate, m.salts_text,
         b.batch_id, b.batch_number, b.expiry_date, b.mrp, b.selling_price, b.purchase_rate, b.quantity_on_hand
       FROM batches b
       JOIN medicines m ON b.medicine_id = m.medicine_id
       WHERE b.gtin = $1 AND m.is_active = TRUE
       ORDER BY b.expiry_date DESC, b.created_at DESC
       LIMIT 5`,
      [parsed.gtin]
    );

    for (const row of res.rows) {
      if (!matchedMedicine) {
        matchedMedicine = {
          medicineId: row.medicine_id,
          name: row.name,
          company: row.company,
          packSize: row.pack_size,
          gstRate: typeof row.gst_rate === 'string' ? parseFloat(row.gst_rate) : row.gst_rate,
          saltsText: row.salts_text,
        };
        matchedBatch = {
          batchId: row.batch_id,
          batchNumber: row.batch_number,
          expiryDate: row.expiry_date instanceof Date ? row.expiry_date.toISOString().slice(0, 10) : String(row.expiry_date).slice(0, 10),
          mrp: String(row.mrp),
          sellingPrice: String(row.selling_price),
          purchaseRate: String(row.purchase_rate),
          quantityOnHand: row.quantity_on_hand,
        };
      }

      if (!medicineSuggestions.some((m) => m.medicineId === row.medicine_id)) {
        medicineSuggestions.push({
          medicineId: row.medicine_id,
          name: row.name,
          company: row.company,
          packSize: row.pack_size,
          gstRate: typeof row.gst_rate === 'string' ? parseFloat(row.gst_rate) : row.gst_rate,
        });
      }
    }
  }

  // 2. If no match by GTIN, but batchNumber is present, look up by batch number
  if (!matchedMedicine && parsed.batchNumber) {
    const res = await query<{
      medicine_id: number;
      name: string;
      company: string;
      pack_size: string;
      gst_rate: string | number;
      salts_text: string;
      batch_id: number;
      batch_number: string;
      expiry_date: string | Date;
      mrp: string | number;
      selling_price: string | number;
      purchase_rate: string | number;
      quantity_on_hand: number;
    }>(
      `SELECT 
         m.medicine_id, m.name, m.company, m.pack_size, m.gst_rate, m.salts_text,
         b.batch_id, b.batch_number, b.expiry_date, b.mrp, b.selling_price, b.purchase_rate, b.quantity_on_hand
       FROM batches b
       JOIN medicines m ON b.medicine_id = m.medicine_id
       WHERE UPPER(TRIM(b.batch_number)) = UPPER(TRIM($1)) AND m.is_active = TRUE
       ORDER BY b.created_at DESC
       LIMIT 5`,
      [parsed.batchNumber]
    );

    if (res.rows.length > 0) {
      const row = res.rows[0];
      matchedMedicine = {
        medicineId: row.medicine_id,
        name: row.name,
        company: row.company,
        packSize: row.pack_size,
        gstRate: typeof row.gst_rate === 'string' ? parseFloat(row.gst_rate) : row.gst_rate,
        saltsText: row.salts_text,
      };
      matchedBatch = {
        batchId: row.batch_id,
        batchNumber: row.batch_number,
        expiryDate: row.expiry_date instanceof Date ? row.expiry_date.toISOString().slice(0, 10) : String(row.expiry_date).slice(0, 10),
        mrp: String(row.mrp),
        sellingPrice: String(row.selling_price),
        purchaseRate: String(row.purchase_rate),
        quantityOnHand: row.quantity_on_hand,
      };

      for (const r of res.rows) {
        if (!medicineSuggestions.some((m) => m.medicineId === r.medicine_id)) {
          medicineSuggestions.push({
            medicineId: r.medicine_id,
            name: r.name,
            company: r.company,
            packSize: r.pack_size,
            gstRate: typeof r.gst_rate === 'string' ? parseFloat(r.gst_rate) : r.gst_rate,
          });
        }
      }
    }
  }

  return {
    gtin: parsed.gtin,
    batchNumber: parsed.batchNumber,
    expiryDate: parsed.expiryDate,
    mrp: parsed.mrp,
    parsedGs1: {
      gtin: parsed.gtin,
      batchNumber: parsed.batchNumber,
      expiryDate: parsed.expiryDate,
      serialNumber: parsed.serial,
    },
    matchedMedicine,
    matchedBatch,
    medicineSuggestions,
  };
}

/**
 * Receives stock inward, creates or tops up a batch, and writes an append-only ledger row.
 */
export async function inwardStock(
  payload: InwardStockInput,
  user: AuthenticatedUser
): Promise<InwardStockResult> {
  return withTransaction(async (client) => {
    // 1. Lock medicine by primary key to prevent concurrent conflicts
    await lockMedicines(client, [payload.medicineId]);

    // 2. Fetch and verify medicine
    const medRes = await client.query<{
      medicine_id: number;
      name: string;
      company: string;
      pack_size: string;
      gst_rate: string | number;
      is_active: boolean;
    }>(
      `SELECT medicine_id, name, company, pack_size, gst_rate, is_active
       FROM medicines
       WHERE medicine_id = $1`,
      [payload.medicineId]
    );

    if (medRes.rows.length === 0 || !medRes.rows[0]!.is_active) {
      throw new NotFoundError({
        code: 'NOT_FOUND',
        message: `Medicine with ID ${payload.medicineId} not found or is inactive`,
        details: { medicineId: payload.medicineId },
      });
    }

    const medicine = medRes.rows[0]!;
    const gstRate = typeof medicine.gst_rate === 'string' ? parseFloat(medicine.gst_rate) : medicine.gst_rate;

    // 3. Expiry date check: must be today or in the future
    const today = todayIst();
    if (payload.expiryDate < today) {
      throw new BusinessRuleError({
        code: 'EXPIRY_IN_PAST',
        message: `Cannot inward batch with past expiry date: ${payload.expiryDate} (Today IST: ${today})`,
        details: { expiryDate: payload.expiryDate, today },
      });
    }

    // 4. Selling price incl. GST cannot exceed MRP
    const sellingPricePaise = toPaise(payload.sellingPrice);
    const effectivePricePaise = addGst(sellingPricePaise, gstRate);
    const mrpPaise = toPaise(payload.mrp);

    if (effectivePricePaise > mrpPaise) {
      throw new BusinessRuleError({
        code: 'PRICE_EXCEEDS_MRP',
        message: `Selling price inclusive of GST (${fromPaise(effectivePricePaise)}) cannot exceed MRP (${payload.mrp})`,
        details: {
          sellingPrice: payload.sellingPrice,
          gstRate,
          effectivePriceInclGst: fromPaise(effectivePricePaise),
          mrp: payload.mrp,
        },
      });
    }

    // 5. GTIN conflict check: cannot assign GTIN to a different medicine
    if (payload.gtin) {
      const gtinConflict = await client.query<{ medicine_id: number }>(
        `SELECT medicine_id FROM batches WHERE gtin = $1 AND medicine_id != $2 LIMIT 1`,
        [payload.gtin, payload.medicineId]
      );

      if (gtinConflict.rows.length > 0) {
        throw new BusinessRuleError({
          code: 'BATCH_MEDICINE_MISMATCH',
          message: `GTIN ${payload.gtin} is already associated with medicine ID ${gtinConflict.rows[0]!.medicine_id}`,
          details: { gtin: payload.gtin, conflictingMedicineId: gtinConflict.rows[0]!.medicine_id },
        });
      }
    }

    // 6. Find existing batch by identity (medicine_id, batch_number, expiry_date, mrp)
    const existingBatchRes = await client.query<{
      batch_id: number;
      medicine_id: number;
      batch_number: string;
      expiry_date: string;
      mrp: string;
      selling_price: string;
      purchase_rate: string;
      quantity_on_hand: number;
      status: string;
      gtin: string | null;
    }>(
      `SELECT batch_id, medicine_id, batch_number, expiry_date::text, mrp::text, selling_price::text, purchase_rate::text, quantity_on_hand, status, gtin
       FROM batches
       WHERE medicine_id = $1 AND batch_number = $2 AND expiry_date = $3 AND mrp = $4
       FOR UPDATE`,
      [payload.medicineId, payload.batchNumber, payload.expiryDate, payload.mrp]
    );

    let batchId: number;
    let batchCreated = false;

    if (existingBatchRes.rows.length > 0) {
      // Existing batch found -> top up
      batchId = existingBatchRes.rows[0]!.batch_id;
      batchCreated = false;
    } else {
      // New batch -> insert row
      const insertRes = await client.query<{ batch_id: number }>(
        `INSERT INTO batches (
          medicine_id,
          batch_number,
          expiry_date,
          mrp,
          selling_price,
          purchase_rate,
          quantity_on_hand,
          status,
          gtin,
          created_by,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 0, 'ACTIVE', $7, $8, NOW(), NOW())
        RETURNING batch_id`,
        [
          payload.medicineId,
          payload.batchNumber,
          payload.expiryDate,
          payload.mrp,
          payload.sellingPrice,
          payload.purchaseRate,
          payload.gtin || null,
          user.userId,
        ]
      );
      batchId = insertRes.rows[0]!.batch_id;
      batchCreated = true;
    }

    // 7. Apply ledger entry for inward quantity
    const ledgerResult = await applyLedgerEntry(client, {
      batchId,
      type: LEDGER_ENTRY_TYPE.INWARD,
      delta: payload.quantity,
      supplierName: payload.supplierName,
      userId: user.userId,
    });

    // 8. Fetch final batch details
    const finalBatchRes = await client.query<{
      batch_id: number;
      medicine_id: number;
      batch_number: string;
      expiry_date: string;
      mrp: string;
      selling_price: string;
      purchase_rate: string;
      quantity_on_hand: number;
      status: string;
      gtin: string | null;
    }>(
      `SELECT batch_id, medicine_id, batch_number, expiry_date::text, mrp::text, selling_price::text, purchase_rate::text, quantity_on_hand, status, gtin
       FROM batches
       WHERE batch_id = $1`,
      [batchId]
    );

    const finalRow = finalBatchRes.rows[0]!;

    return {
      batch: {
        batchId: finalRow.batch_id,
        medicineId: finalRow.medicine_id,
        batchNumber: finalRow.batch_number,
        expiryDate: finalRow.expiry_date,
        mrp: finalRow.mrp,
        sellingPrice: finalRow.selling_price,
        purchaseRate: finalRow.purchase_rate,
        quantityOnHand: finalRow.quantity_on_hand,
        status: finalRow.status,
        gtin: finalRow.gtin,
      },
      ledgerEntry: ledgerResult,
      batchCreated,
    };
  });
}
