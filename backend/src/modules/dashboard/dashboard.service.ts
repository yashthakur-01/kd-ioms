import { pool } from '../../config/db.js';

export interface DashboardSummaryResponse {
  pendingRetailers: number;
  placedOrders: number;
  approvedUnclaimed: number;
  outForDelivery: number;
  nearExpiryBatches: number;
  expiredBatches: number;
  outOfStockMedicines: number;
  failedNotifications: number;
}

export async function getDashboardSummary(): Promise<DashboardSummaryResponse> {
  const [
    pendingRetailersRes,
    placedOrdersRes,
    approvedUnclaimedRes,
    outForDeliveryRes,
    nearExpiryBatchesRes,
    expiredBatchesRes,
    outOfStockMedicinesRes,
    failedNotificationsRes,
  ] = await Promise.all([
    pool.query<{ count: number }>(`
      SELECT COUNT(*)::int AS count
      FROM retailers
      WHERE verification_status = 'PENDING'
    `),
    pool.query<{ count: number }>(`
      SELECT COUNT(*)::int AS count
      FROM orders
      WHERE status = 'PLACED'
    `),
    pool.query<{ count: number }>(`
      SELECT COUNT(*)::int AS count
      FROM orders
      WHERE status = 'APPROVED' AND claimed_by IS NULL
    `),
    pool.query<{ count: number }>(`
      SELECT COUNT(*)::int AS count
      FROM orders
      WHERE status = 'DISPATCHED'
    `),
    pool.query<{ count: number }>(`
      SELECT COUNT(*)::int AS count
      FROM v_expiry_alerts
    `),
    pool.query<{ count: number }>(`
      SELECT COUNT(*)::int AS count
      FROM v_expired_stock
    `),
    pool.query<{ count: number }>(`
      SELECT COUNT(*)::int AS count
      FROM v_medicine_availability
      WHERE available_qty = 0
    `),
    pool.query<{ count: number }>(`
      SELECT COUNT(*)::int AS count
      FROM notification_logs
      WHERE status = 'FAILED'
    `),
  ]);

  return {
    pendingRetailers: pendingRetailersRes.rows[0]?.count ?? 0,
    placedOrders: placedOrdersRes.rows[0]?.count ?? 0,
    approvedUnclaimed: approvedUnclaimedRes.rows[0]?.count ?? 0,
    outForDelivery: outForDeliveryRes.rows[0]?.count ?? 0,
    nearExpiryBatches: nearExpiryBatchesRes.rows[0]?.count ?? 0,
    expiredBatches: expiredBatchesRes.rows[0]?.count ?? 0,
    outOfStockMedicines: outOfStockMedicinesRes.rows[0]?.count ?? 0,
    failedNotifications: failedNotificationsRes.rows[0]?.count ?? 0,
  };
}
