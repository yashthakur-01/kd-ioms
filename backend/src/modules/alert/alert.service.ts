import { query } from '../../config/db.js';
import { NotFoundError, ConflictError } from '../../errors/app-error.js';
import { ERROR_CODES } from '../../constants/error-codes.js';
import type { ListAlertsQuery } from './alert.validation.js';

export interface NearExpiryAlertItem {
  batchId: number;
  medicineId: number;
  medicineName: string;
  batchNumber: string;
  expiryDate: string;
  daysLeft: number;
  quantityOnHand: number;
  mrp: string;
  sellingPrice: string;
}

export interface ExpiredStockItem {
  batchId: number;
  medicineId: number;
  medicineName: string;
  batchNumber: string;
  expiryDate: string;
  daysExpired: number;
  quantityOnHand: number;
  mrp: string;
  sellingPrice: string;
}

export async function listNearExpiry(queryParams: ListAlertsQuery): Promise<{ rows: NearExpiryAlertItem[]; totalItems: number }> {
  const page = queryParams.page || 1;
  const pageSize = queryParams.pageSize || 20;
  const offset = (page - 1) * pageSize;
  const search = queryParams.search?.trim() || null;

  const { rows } = await query<{
    batch_id: number;
    medicine_id: number;
    medicine_name: string;
    batch_number: string;
    expiry_date: string;
    days_left: number;
    quantity_on_hand: number;
    mrp: string;
    selling_price: string;
    full_count: string;
  }>(
    `SELECT
       batch_id,
       medicine_id,
       medicine_name,
       batch_number,
       TO_CHAR(expiry_date, 'YYYY-MM-DD') AS expiry_date,
       days_left,
       quantity_on_hand,
       mrp::text,
       selling_price::text,
       COUNT(*) OVER() AS full_count
     FROM v_expiry_alerts
     WHERE ($1::text IS NULL OR medicine_name ILIKE ('%' || $1 || '%') OR batch_number ILIKE ('%' || $1 || '%'))
     ORDER BY days_left ASC, medicine_name ASC
     LIMIT $2 OFFSET $3`,
    [search, pageSize, offset]
  );

  const totalItems = rows.length > 0 ? parseInt(rows[0].full_count, 10) : 0;

  const items: NearExpiryAlertItem[] = rows.map((r) => ({
    batchId: r.batch_id,
    medicineId: r.medicine_id,
    medicineName: r.medicine_name,
    batchNumber: r.batch_number,
    expiryDate: r.expiry_date,
    daysLeft: r.days_left,
    quantityOnHand: r.quantity_on_hand,
    mrp: r.mrp,
    sellingPrice: r.selling_price,
  }));

  return { rows: items, totalItems };
}

export async function listExpiredStock(queryParams: ListAlertsQuery): Promise<{ rows: ExpiredStockItem[]; totalItems: number }> {
  const page = queryParams.page || 1;
  const pageSize = queryParams.pageSize || 20;
  const offset = (page - 1) * pageSize;
  const search = queryParams.search?.trim() || null;

  const { rows } = await query<{
    batch_id: number;
    medicine_id: number;
    medicine_name: string;
    batch_number: string;
    expiry_date: string;
    days_expired: number;
    quantity_on_hand: number;
    mrp: string;
    selling_price: string;
    full_count: string;
  }>(
    `SELECT
       batch_id,
       medicine_id,
       medicine_name,
       batch_number,
       TO_CHAR(expiry_date, 'YYYY-MM-DD') AS expiry_date,
       days_expired,
       quantity_on_hand,
       mrp::text,
       selling_price::text,
       COUNT(*) OVER() AS full_count
     FROM v_expired_stock
     WHERE ($1::text IS NULL OR medicine_name ILIKE ('%' || $1 || '%') OR batch_number ILIKE ('%' || $1 || '%'))
     ORDER BY days_expired DESC, medicine_name ASC
     LIMIT $2 OFFSET $3`,
    [search, pageSize, offset]
  );

  const totalItems = rows.length > 0 ? parseInt(rows[0].full_count, 10) : 0;

  const items: ExpiredStockItem[] = rows.map((r) => ({
    batchId: r.batch_id,
    medicineId: r.medicine_id,
    medicineName: r.medicine_name,
    batchNumber: r.batch_number,
    expiryDate: r.expiry_date,
    daysExpired: r.days_expired,
    quantityOnHand: r.quantity_on_hand,
    mrp: r.mrp,
    sellingPrice: r.selling_price,
  }));

  return { rows: items, totalItems };
}

export async function dismissNearExpiryAlert(batchId: number): Promise<{
  batchId: number;
  medicineId: number;
  batchNumber: string;
  expiryDate: string;
  expiryAlertDismissedAt: Date;
}> {
  const { rows } = await query<{
    batch_id: number;
    medicine_id: number;
    batch_number: string;
    expiry_date: string;
    is_expired: boolean;
  }>(
    `SELECT
       batch_id,
       medicine_id,
       batch_number,
       TO_CHAR(expiry_date, 'YYYY-MM-DD') AS expiry_date,
       (expiry_date < today_ist()) AS is_expired
     FROM batches
     WHERE batch_id = $1`,
    [batchId]
  );

  if (rows.length === 0) {
    throw new NotFoundError({
      code: ERROR_CODES.NOT_FOUND,
      message: 'Batch not found',
    });
  }

  const batch = rows[0];

  if (batch.is_expired) {
    throw new ConflictError({
      code: ERROR_CODES.INVALID_STATE_TRANSITION,
      message: 'Cannot dismiss an alert for an already expired batch',
    });
  }

  const updateRes = await query<{
    batch_id: number;
    medicine_id: number;
    batch_number: string;
    expiry_date: string;
    expiry_alert_dismissed_at: Date;
  }>(
    `UPDATE batches
     SET expiry_alert_dismissed_at = NOW(),
         updated_at = NOW()
     WHERE batch_id = $1
     RETURNING
       batch_id,
       medicine_id,
       batch_number,
       TO_CHAR(expiry_date, 'YYYY-MM-DD') AS expiry_date,
       expiry_alert_dismissed_at`,
    [batchId]
  );

  const updated = updateRes.rows[0];

  return {
    batchId: updated.batch_id,
    medicineId: updated.medicine_id,
    batchNumber: updated.batch_number,
    expiryDate: updated.expiry_date,
    expiryAlertDismissedAt: updated.expiry_alert_dismissed_at,
  };
}
