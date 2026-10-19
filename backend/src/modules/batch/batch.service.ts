import { query, withTransaction } from '../../config/db.js';
import { NotFoundError, ConflictError, BusinessRuleError, ValidationError } from '../../errors/app-error.js';
import { todayIst } from '../../utils/dates.js';
import { toPaise, addGst, fromPaise } from '../../utils/money.js';
import { applyLedgerEntry } from '../stock-ledger/stock-ledger.service.js';
import type {
  ListBatchesQuery,
  UpdateBatchInput,
  AdjustBatchInput,
  ListLedgerQuery,
} from './batch.validation.js';

export interface BatchItem {
  batchId: number;
  medicineId: number;
  medicineName: string;
  medicineCompany: string;
  medicinePackSize: string;
  gstRate: number;
  batchNumber: string;
  expiryDate: string;
  mrp: string;
  sellingPrice: string;
  purchaseRate: string;
  priceInclGst: string;
  quantityOnHand: number;
  status: string;
  gtin: string | null;
  daysLeft: number;
  expiryAlertDismissedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BatchDetail {
  batch: BatchItem;
  ledgerEntries: Array<{
    entryId: number;
    batchId: number;
    type: string;
    delta: number;
    balanceAfter: number;
    reason: string | null;
    supplierName: string | null;
    orderId: number | null;
    orderItemId: number | null;
    createdAt: string;
    createdBy: string | null;
    createdByName: string | null;
    createdByUsername: string | null;
  }>;
}

export interface LedgerItem {
  entryId: number;
  batchId: number;
  batchNumber: string;
  expiryDate: string;
  mrp: string;
  sellingPrice: string;
  medicineId: number;
  medicineName: string;
  medicineCompany: string;
  type: string;
  delta: number;
  balanceAfter: number;
  reason: string | null;
  supplierName: string | null;
  orderId: number | null;
  orderItemId: number | null;
  createdAt: string;
  createdBy: string | null;
  createdByName: string | null;
  createdByUsername: string | null;
}

interface RawBatchRow {
  batch_id: number;
  medicine_id: number;
  batch_number: string;
  expiry_date: string;
  mrp: string | number;
  selling_price: string | number;
  purchase_rate: string | number;
  quantity_on_hand: number;
  status: string;
  gtin: string | null;
  expiry_alert_dismissed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  medicine_name: string;
  medicine_company: string;
  medicine_pack_size: string;
  gst_rate: string | number;
  days_left: number;
  price_incl_gst: string | number;
  full_count?: string | number;
}

interface RawLedgerRow {
  entry_id: number;
  batch_id: number;
  type: string;
  delta: number;
  balance_after: number;
  reason: string | null;
  supplier_name: string | null;
  order_id: number | null;
  order_item_id: number | null;
  created_at: string;
  created_by: string | null;
  created_by_name: string | null;
  created_by_username: string | null;
}

interface RawLedgerListRow extends RawLedgerRow {
  batch_number: string;
  expiry_date: string;
  mrp: string | number;
  selling_price: string | number;
  medicine_id: number;
  medicine_name: string;
  medicine_company: string;
  full_count: string | number;
}

function formatDateString(val: unknown): string {
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'string') {
    return val.slice(0, 10);
  }
  return String(val);
}

export async function listBatches(queryParam: ListBatchesQuery): Promise<{
  rows: BatchItem[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const page = queryParam.page || 1;
  const pageSize = queryParam.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (queryParam.medicineId) {
    params.push(queryParam.medicineId);
    conditions.push(`b.medicine_id = $${params.length}`);
  }

  if (queryParam.status) {
    params.push(queryParam.status);
    conditions.push(`b.status = $${params.length}`);
  }

  if (queryParam.inStock === true) {
    conditions.push(`b.quantity_on_hand > 0`);
  } else if (queryParam.inStock === false) {
    conditions.push(`b.quantity_on_hand = 0`);
  }

  if (queryParam.expiry === 'NEAR') {
    conditions.push(`b.expiry_date >= CURRENT_DATE AND b.expiry_date <= (CURRENT_DATE + INTERVAL '90 days')`);
  } else if (queryParam.expiry === 'EXPIRED') {
    conditions.push(`b.expiry_date < CURRENT_DATE`);
  }

  if (queryParam.q) {
    params.push(`%${queryParam.q}%`);
    conditions.push(`(b.batch_number ILIKE $${params.length} OR m.name ILIKE $${params.length})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  let orderBy = 'ORDER BY b.expiry_date ASC, b.batch_id ASC';
  if (queryParam.sort === '-expiryDate') {
    orderBy = 'ORDER BY b.expiry_date DESC, b.batch_id DESC';
  } else if (queryParam.sort === 'createdAt') {
    orderBy = 'ORDER BY b.created_at ASC, b.batch_id ASC';
  } else if (queryParam.sort === '-createdAt') {
    orderBy = 'ORDER BY b.created_at DESC, b.batch_id DESC';
  } else if (queryParam.sort === 'batchNumber') {
    orderBy = 'ORDER BY b.batch_number ASC, b.batch_id ASC';
  } else if (queryParam.sort === '-batchNumber') {
    orderBy = 'ORDER BY b.batch_number DESC, b.batch_id DESC';
  }

  params.push(pageSize);
  const limitPlaceholder = `$${params.length}`;
  params.push(offset);
  const offsetPlaceholder = `$${params.length}`;

  const sql = `
    SELECT 
      b.batch_id,
      b.medicine_id,
      b.batch_number,
      TO_CHAR(b.expiry_date, 'YYYY-MM-DD') as expiry_date,
      b.mrp,
      b.selling_price,
      b.purchase_rate,
      b.quantity_on_hand,
      b.status,
      b.gtin,
      b.expiry_alert_dismissed_at,
      b.created_by,
      b.created_at,
      b.updated_at,
      m.name as medicine_name,
      m.company as medicine_company,
      m.pack_size as medicine_pack_size,
      m.gst_rate,
      (b.expiry_date - CURRENT_DATE)::int as days_left,
      ROUND(b.selling_price * (1.0 + (m.gst_rate / 100.0)), 2) as price_incl_gst,
      COUNT(*) OVER() AS full_count
    FROM batches b
    JOIN medicines m ON b.medicine_id = m.medicine_id
    ${whereClause}
    ${orderBy}
    LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
  `;

  const result = await query<RawBatchRow>(sql, params);

  const totalItems = result.rows.length > 0 ? parseInt(String(result.rows[0]!.full_count), 10) : 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  const rows: BatchItem[] = result.rows.map((r: RawBatchRow) => ({
    batchId: r.batch_id,
    medicineId: r.medicine_id,
    medicineName: r.medicine_name,
    medicineCompany: r.medicine_company,
    medicinePackSize: r.medicine_pack_size,
    gstRate: typeof r.gst_rate === 'string' ? parseFloat(r.gst_rate) : Number(r.gst_rate),
    batchNumber: r.batch_number,
    expiryDate: formatDateString(r.expiry_date),
    mrp: Number(r.mrp).toFixed(2),
    sellingPrice: Number(r.selling_price).toFixed(2),
    purchaseRate: Number(r.purchase_rate).toFixed(2),
    priceInclGst: Number(r.price_incl_gst).toFixed(2),
    quantityOnHand: r.quantity_on_hand,
    status: r.status,
    gtin: r.gtin,
    daysLeft: parseInt(String(r.days_left), 10),
    expiryAlertDismissedAt: r.expiry_alert_dismissed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  return { rows, totalItems, page, pageSize, totalPages };
}

export async function getBatchById(batchId: number): Promise<BatchDetail> {
  const batchSql = `
    SELECT 
      b.batch_id,
      b.medicine_id,
      b.batch_number,
      TO_CHAR(b.expiry_date, 'YYYY-MM-DD') as expiry_date,
      b.mrp,
      b.selling_price,
      b.purchase_rate,
      b.quantity_on_hand,
      b.status,
      b.gtin,
      b.expiry_alert_dismissed_at,
      b.created_by,
      b.created_at,
      b.updated_at,
      m.name as medicine_name,
      m.company as medicine_company,
      m.pack_size as medicine_pack_size,
      m.gst_rate,
      (b.expiry_date - CURRENT_DATE)::int as days_left,
      ROUND(b.selling_price * (1.0 + (m.gst_rate / 100.0)), 2) as price_incl_gst
    FROM batches b
    JOIN medicines m ON b.medicine_id = m.medicine_id
    WHERE b.batch_id = $1
  `;

  const batchRes = await query<RawBatchRow>(batchSql, [batchId]);

  if (batchRes.rows.length === 0) {
    throw new NotFoundError({
      code: 'NOT_FOUND',
      message: `Batch with ID ${batchId} not found`,
    });
  }

  const r = batchRes.rows[0]!;
  const batch: BatchItem = {
    batchId: r.batch_id,
    medicineId: r.medicine_id,
    medicineName: r.medicine_name,
    medicineCompany: r.medicine_company,
    medicinePackSize: r.medicine_pack_size,
    gstRate: typeof r.gst_rate === 'string' ? parseFloat(r.gst_rate) : Number(r.gst_rate),
    batchNumber: r.batch_number,
    expiryDate: formatDateString(r.expiry_date),
    mrp: Number(r.mrp).toFixed(2),
    sellingPrice: Number(r.selling_price).toFixed(2),
    purchaseRate: Number(r.purchase_rate).toFixed(2),
    priceInclGst: Number(r.price_incl_gst).toFixed(2),
    quantityOnHand: r.quantity_on_hand,
    status: r.status,
    gtin: r.gtin,
    daysLeft: parseInt(String(r.days_left), 10),
    expiryAlertDismissedAt: r.expiry_alert_dismissed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };

  const ledgerSql = `
    SELECT 
      sle.entry_id,
      sle.batch_id,
      sle.type,
      sle.delta,
      sle.balance_after,
      sle.reason,
      sle.supplier_name,
      sle.order_id,
      sle.order_item_id,
      sle.created_at,
      sle.created_by,
      u.full_name as created_by_name,
      u.username as created_by_username
    FROM stock_ledger_entries sle
    LEFT JOIN users u ON sle.created_by = u.id
    WHERE sle.batch_id = $1
    ORDER BY sle.created_at DESC, sle.entry_id DESC
    LIMIT 20
  `;

  const ledgerRes = await query<RawLedgerRow>(ledgerSql, [batchId]);

  const ledgerEntries = ledgerRes.rows.map((row: RawLedgerRow) => ({
    entryId: row.entry_id,
    batchId: row.batch_id,
    type: row.type,
    delta: row.delta,
    balanceAfter: row.balance_after,
    reason: row.reason,
    supplierName: row.supplier_name,
    orderId: row.order_id,
    orderItemId: row.order_item_id,
    createdAt: row.created_at,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdByUsername: row.created_by_username,
  }));

  return { batch, ledgerEntries };
}

export async function updateBatch(
  batchId: number,
  input: UpdateBatchInput
): Promise<BatchItem> {
  return withTransaction(async (client) => {
    const existing = await client.query<{
      batch_id: number;
      mrp: string | number;
      gst_rate: string | number;
    }>(
      `SELECT b.batch_id, b.mrp, m.gst_rate
       FROM batches b
       JOIN medicines m ON b.medicine_id = m.medicine_id
       WHERE b.batch_id = $1 FOR UPDATE`,
      [batchId]
    );

    if (existing.rows.length === 0) {
      throw new NotFoundError({
        code: 'NOT_FOUND',
        message: `Batch with ID ${batchId} not found`,
      });
    }

    const current = existing.rows[0]!;
    const gstRate = typeof current.gst_rate === 'string' ? parseFloat(current.gst_rate) : Number(current.gst_rate);
    const mrpPaise = toPaise(current.mrp);

    if (input.sellingPrice !== undefined) {
      const sellingPricePaise = toPaise(input.sellingPrice);
      const effectivePricePaise = addGst(sellingPricePaise, gstRate);

      if (effectivePricePaise > mrpPaise) {
        throw new BusinessRuleError({
          code: 'PRICE_EXCEEDS_MRP',
          message: `Selling price inclusive of GST (${fromPaise(effectivePricePaise)}) cannot exceed MRP (${Number(current.mrp).toFixed(2)})`,
          details: {
            sellingPrice: input.sellingPrice,
            gstRate,
            effectivePriceInclGst: fromPaise(effectivePricePaise),
            mrp: Number(current.mrp).toFixed(2),
          },
        });
      }

      if (sellingPricePaise > mrpPaise) {
        throw new BusinessRuleError({
          code: 'PRICE_EXCEEDS_MRP',
          message: `Selling price (${input.sellingPrice}) cannot exceed MRP (${Number(current.mrp).toFixed(2)})`,
        });
      }
    }

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [batchId];

    if (input.sellingPrice !== undefined) {
      params.push(input.sellingPrice);
      setClauses.push(`selling_price = $${params.length}`);
    }

    if (input.status !== undefined) {
      params.push(input.status);
      setClauses.push(`status = $${params.length}`);
    }

    await client.query(
      `UPDATE batches SET ${setClauses.join(', ')} WHERE batch_id = $1`,
      params
    );

    const updatedRes = await client.query<RawBatchRow>(
      `SELECT 
        b.batch_id,
        b.medicine_id,
        b.batch_number,
        TO_CHAR(b.expiry_date, 'YYYY-MM-DD') as expiry_date,
        b.mrp,
        b.selling_price,
        b.purchase_rate,
        b.quantity_on_hand,
        b.status,
        b.gtin,
        b.expiry_alert_dismissed_at,
        b.created_by,
        b.created_at,
        b.updated_at,
        m.name as medicine_name,
        m.company as medicine_company,
        m.pack_size as medicine_pack_size,
        m.gst_rate,
        (b.expiry_date - CURRENT_DATE)::int as days_left,
        ROUND(b.selling_price * (1.0 + (m.gst_rate / 100.0)), 2) as price_incl_gst
      FROM batches b
      JOIN medicines m ON b.medicine_id = m.medicine_id
      WHERE b.batch_id = $1`,
      [batchId]
    );

    const r = updatedRes.rows[0]!;
    return {
      batchId: r.batch_id,
      medicineId: r.medicine_id,
      medicineName: r.medicine_name,
      medicineCompany: r.medicine_company,
      medicinePackSize: r.medicine_pack_size,
      gstRate: typeof r.gst_rate === 'string' ? parseFloat(r.gst_rate) : Number(r.gst_rate),
      batchNumber: r.batch_number,
      expiryDate: formatDateString(r.expiry_date),
      mrp: Number(r.mrp).toFixed(2),
      sellingPrice: Number(r.selling_price).toFixed(2),
      purchaseRate: Number(r.purchase_rate).toFixed(2),
      priceInclGst: Number(r.price_incl_gst).toFixed(2),
      quantityOnHand: r.quantity_on_hand,
      status: r.status,
      gtin: r.gtin,
      daysLeft: parseInt(String(r.days_left), 10),
      expiryAlertDismissedAt: r.expiry_alert_dismissed_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
}

export async function adjustBatch(
  batchId: number,
  input: AdjustBatchInput,
  actor: { userId: string }
): Promise<{
  batch: BatchItem;
  ledgerEntry: {
    entryId: number;
    batchId: number;
    type: string;
    delta: number;
    balanceAfter: number;
    reason: string | null;
  };
}> {
  return withTransaction(async (client) => {
    const existing = await client.query<{
      batch_id: number;
      expiry_date: string;
      quantity_on_hand: number;
    }>(
      `SELECT batch_id, TO_CHAR(expiry_date, 'YYYY-MM-DD') as expiry_date, quantity_on_hand
       FROM batches
       WHERE batch_id = $1 FOR UPDATE`,
      [batchId]
    );

    if (existing.rows.length === 0) {
      throw new NotFoundError({
        code: 'NOT_FOUND',
        message: `Batch with ID ${batchId} not found`,
      });
    }

    const currentBatch = existing.rows[0]!;
    const expiryStr = formatDateString(currentBatch.expiry_date);
    const today = todayIst();

    if (input.type === 'EXPIRY_WRITEOFF') {
      if (expiryStr >= today) {
        throw new ConflictError({
          code: 'INVALID_STATE_TRANSITION',
          message: 'Cannot perform expiry write-off on an unexpired batch',
          details: { expiryDate: expiryStr, today },
        });
      }
    }

    let delta: number;
    if (input.type === 'EXPIRY_WRITEOFF' || input.type === 'DAMAGE') {
      delta = input.quantity > 0 ? -input.quantity : input.quantity;
    } else {
      delta = input.quantity;
    }

    const ledger = await applyLedgerEntry(client, {
      batchId,
      type: input.type,
      delta,
      reason: input.reason,
      userId: actor.userId,
    });

    const updatedRes = await client.query<RawBatchRow>(
      `SELECT 
        b.batch_id,
        b.medicine_id,
        b.batch_number,
        TO_CHAR(b.expiry_date, 'YYYY-MM-DD') as expiry_date,
        b.mrp,
        b.selling_price,
        b.purchase_rate,
        b.quantity_on_hand,
        b.status,
        b.gtin,
        b.expiry_alert_dismissed_at,
        b.created_by,
        b.created_at,
        b.updated_at,
        m.name as medicine_name,
        m.company as medicine_company,
        m.pack_size as medicine_pack_size,
        m.gst_rate,
        (b.expiry_date - CURRENT_DATE)::int as days_left,
        ROUND(b.selling_price * (1.0 + (m.gst_rate / 100.0)), 2) as price_incl_gst
      FROM batches b
      JOIN medicines m ON b.medicine_id = m.medicine_id
      WHERE b.batch_id = $1`,
      [batchId]
    );

    const r = updatedRes.rows[0]!;
    const batch: BatchItem = {
      batchId: r.batch_id,
      medicineId: r.medicine_id,
      medicineName: r.medicine_name,
      medicineCompany: r.medicine_company,
      medicinePackSize: r.medicine_pack_size,
      gstRate: typeof r.gst_rate === 'string' ? parseFloat(r.gst_rate) : Number(r.gst_rate),
      batchNumber: r.batch_number,
      expiryDate: formatDateString(r.expiry_date),
      mrp: Number(r.mrp).toFixed(2),
      sellingPrice: Number(r.selling_price).toFixed(2),
      purchaseRate: Number(r.purchase_rate).toFixed(2),
      priceInclGst: Number(r.price_incl_gst).toFixed(2),
      quantityOnHand: r.quantity_on_hand,
      status: r.status,
      gtin: r.gtin,
      daysLeft: parseInt(String(r.days_left), 10),
      expiryAlertDismissedAt: r.expiry_alert_dismissed_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };

    return {
      batch,
      ledgerEntry: {
        entryId: ledger.entryId,
        batchId,
        type: input.type,
        delta,
        balanceAfter: ledger.balanceAfter,
        reason: input.reason,
      },
    };
  });
}

export async function listLedger(queryParam: ListLedgerQuery): Promise<{
  rows: LedgerItem[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const page = queryParam.page || 1;
  const pageSize = queryParam.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (queryParam.batchId) {
    params.push(queryParam.batchId);
    conditions.push(`sle.batch_id = $${params.length}`);
  }

  if (queryParam.medicineId) {
    params.push(queryParam.medicineId);
    conditions.push(`b.medicine_id = $${params.length}`);
  }

  if (queryParam.type) {
    params.push(queryParam.type);
    conditions.push(`sle.type = $${params.length}`);
  }

  if (queryParam.from) {
    params.push(queryParam.from);
    conditions.push(`sle.created_at >= $${params.length}::timestamptz`);
  }

  if (queryParam.to) {
    params.push(`${queryParam.to} 23:59:59.999Z`);
    conditions.push(`sle.created_at <= $${params.length}::timestamptz`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(pageSize);
  const limitPlaceholder = `$${params.length}`;
  params.push(offset);
  const offsetPlaceholder = `$${params.length}`;

  const sql = `
    SELECT 
      sle.entry_id,
      sle.batch_id,
      sle.type,
      sle.delta,
      sle.balance_after,
      sle.reason,
      sle.supplier_name,
      sle.order_id,
      sle.order_item_id,
      sle.created_at,
      sle.created_by,
      b.batch_number,
      TO_CHAR(b.expiry_date, 'YYYY-MM-DD') as expiry_date,
      b.mrp,
      b.selling_price,
      m.medicine_id,
      m.name as medicine_name,
      m.company as medicine_company,
      u.full_name as created_by_name,
      u.username as created_by_username,
      COUNT(*) OVER() AS full_count
    FROM stock_ledger_entries sle
    JOIN batches b ON sle.batch_id = b.batch_id
    JOIN medicines m ON b.medicine_id = m.medicine_id
    LEFT JOIN users u ON sle.created_by = u.id
    ${whereClause}
    ORDER BY sle.created_at DESC, sle.entry_id DESC
    LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
  `;

  const result = await query<RawLedgerListRow>(sql, params);

  const totalItems = result.rows.length > 0 ? parseInt(String(result.rows[0]!.full_count), 10) : 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  const rows: LedgerItem[] = result.rows.map((r: RawLedgerListRow) => ({
    entryId: r.entry_id,
    batchId: r.batch_id,
    batchNumber: r.batch_number,
    expiryDate: formatDateString(r.expiry_date),
    mrp: Number(r.mrp).toFixed(2),
    sellingPrice: Number(r.selling_price).toFixed(2),
    medicineId: r.medicine_id,
    medicineName: r.medicine_name,
    medicineCompany: r.medicine_company,
    type: r.type,
    delta: r.delta,
    balanceAfter: r.balance_after,
    reason: r.reason,
    supplierName: r.supplier_name,
    orderId: r.order_id,
    orderItemId: r.order_item_id,
    createdAt: r.created_at,
    createdBy: r.created_by,
    createdByName: r.created_by_name,
    createdByUsername: r.created_by_username,
  }));

  return { rows, totalItems, page, pageSize, totalPages };
}

export async function removeExpired(
  batchId: number,
  actor: { userId: string },
  input?: { reason?: string }
): Promise<{
  batchId: number;
  removedQuantity: number;
  balanceAfter: number;
  entryId: number;
}> {
  return withTransaction(async (client) => {
    const existing = await client.query<{
      batch_id: number;
      expiry_date: string;
      quantity_on_hand: number;
    }>(
      `SELECT batch_id, TO_CHAR(expiry_date, 'YYYY-MM-DD') as expiry_date, quantity_on_hand
       FROM batches
       WHERE batch_id = $1 FOR UPDATE`,
      [batchId]
    );

    if (existing.rows.length === 0) {
      throw new NotFoundError({
        code: 'NOT_FOUND',
        message: `Batch with ID ${batchId} not found`,
      });
    }

    const currentBatch = existing.rows[0]!;
    const expiryStr = formatDateString(currentBatch.expiry_date);
    const today = todayIst();

    if (expiryStr >= today) {
      throw new ConflictError({
        code: 'INVALID_STATE_TRANSITION',
        message: 'Cannot perform expiry write-off on an unexpired batch',
        details: { expiryDate: expiryStr, today },
      });
    }

    if (currentBatch.quantity_on_hand <= 0) {
      throw new ValidationError({
        code: 'BATCH_ALREADY_EMPTY',
        message: 'Batch stock is already zero',
      });
    }

    const qtyToRemove = currentBatch.quantity_on_hand;
    const ledger = await applyLedgerEntry(client, {
      batchId,
      type: 'EXPIRY_WRITEOFF',
      delta: -qtyToRemove,
      reason: input?.reason || 'Physical removal of expired stock from warehouse shelf',
      userId: actor.userId,
    });

    return {
      batchId,
      removedQuantity: qtyToRemove,
      balanceAfter: ledger.balanceAfter,
      entryId: ledger.entryId,
    };
  });
}

