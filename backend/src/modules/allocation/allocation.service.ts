import { query } from '../../config/db.js';
import { NotFoundError, ConflictError } from '../../errors/app-error.js';
import { ERROR_CODES } from '../../constants/error-codes.js';
import { ORDER_STATUS } from '../../enums/order-status.enum.js';
import { parseGs1 } from '../../utils/gtin.js';
import type {
  OrderPickSuggestionsResult,
  ItemPickSuggestion,
  BatchPickSuggestion,
  ResolveScanResult,
} from './allocation.types.js';

export class AllocationService {
  /**
   * Generates FEFO suggestions for all lines of a PLACED order.
   * Batches are sorted strictly by earliest expiry date first (expiry_date ASC, batch_id ASC).
   * Verifies price ceiling (effective price <= quoted price) and greedily calculates suggestedQty.
   */
  async suggest(orderId: number): Promise<OrderPickSuggestionsResult> {
    // 1. Fetch order and verify status
    const orderRes = await query<{
      order_id: number;
      order_number: string;
      status: string;
    }>(
      `SELECT order_id, order_number, status
       FROM orders
       WHERE order_id = $1`,
      [orderId]
    );

    if (orderRes.rowCount === 0) {
      throw new NotFoundError({
        code: ERROR_CODES.NOT_FOUND,
        message: `Order #${orderId} does not exist`,
      });
    }

    const order = orderRes.rows[0];
    if (order.status !== ORDER_STATUS.PLACED) {
      throw new ConflictError({
        code: ERROR_CODES.INVALID_STATE_TRANSITION,
        message: `Order must be in PLACED status to generate pick suggestions (current status: ${order.status})`,
      });
    }

    // 2. Fetch order items with medicine details
    const itemsRes = await query<{
      order_item_id: number;
      medicine_id: number;
      requested_quantity: number;
      quoted_price_incl_gst: string;
      medicine_name: string;
      company: string;
      pack_size: string;
    }>(
      `SELECT oi.order_item_id, oi.medicine_id, oi.requested_quantity, oi.quoted_price_incl_gst,
              m.name AS medicine_name, m.company, m.pack_size
       FROM order_items oi
       JOIN medicines m ON oi.medicine_id = m.medicine_id
       WHERE oi.order_id = $1
       ORDER BY oi.order_item_id ASC`,
      [orderId]
    );

    const items: ItemPickSuggestion[] = [];

    // 3. For each order item, query active unexpired batches in FEFO order
    for (const item of itemsRes.rows) {
      const batchesRes = await query<{
        batch_id: number;
        batch_number: string;
        expiry_date: string;
        mrp: string;
        selling_price: string;
        gst_rate: string;
        quantity_on_hand: number;
        price_incl_gst: string;
      }>(
        `SELECT b.batch_id, b.batch_number, b.expiry_date::text AS expiry_date,
                b.mrp, b.selling_price, m.gst_rate, b.quantity_on_hand,
                ROUND(b.selling_price * (1.0 + (m.gst_rate / 100.0)), 2) AS price_incl_gst
         FROM batches b
         JOIN medicines m ON b.medicine_id = m.medicine_id
         WHERE b.medicine_id = $1
           AND b.status = 'ACTIVE'
           AND b.expiry_date >= today_ist()
           AND b.quantity_on_hand > 0
         ORDER BY b.expiry_date ASC, b.batch_id ASC`,
        [item.medicine_id]
      );

      const quotedCeiling = Number(item.quoted_price_incl_gst);
      let remainingNeeded = item.requested_quantity;
      const suggestions: BatchPickSuggestion[] = [];

      for (const batch of batchesRes.rows) {
        const priceInclGst = Number(batch.price_incl_gst);
        const withinQuote = priceInclGst <= quotedCeiling;

        let suggestedQty = 0;
        if (withinQuote && remainingNeeded > 0) {
          suggestedQty = Math.min(batch.quantity_on_hand, remainingNeeded);
          remainingNeeded -= suggestedQty;
        }

        suggestions.push({
          batchId: batch.batch_id,
          batchNumber: batch.batch_number,
          expiryDate: batch.expiry_date,
          mrp: Number(batch.mrp).toFixed(2),
          sellingPrice: Number(batch.selling_price).toFixed(2),
          gstRate: Number(batch.gst_rate).toFixed(2),
          priceInclGst: Number(batch.price_incl_gst).toFixed(2),
          quantityOnHand: batch.quantity_on_hand,
          withinQuote,
          suggestedQty,
        });
      }

      items.push({
        orderItemId: item.order_item_id,
        medicineId: item.medicine_id,
        medicineName: item.medicine_name,
        company: item.company,
        packSize: item.pack_size,
        requestedQuantity: item.requested_quantity,
        quotedPriceInclGst: Number(item.quoted_price_incl_gst).toFixed(2),
        suggestions,
        batches: suggestions,
      });
    }

    return {
      orderId: order.order_id,
      orderNumber: order.order_number,
      items,
    };
  }

  /**
   * Resolves a barcode scan or pack text to an active unexpired warehouse batch.
   * Matches by GTIN or composite (batch_number, expiry_date), optionally scoped to medicineId.
   */
  async resolveScan({
    payload,
    medicineId,
  }: {
    payload: string;
    medicineId?: number;
  }): Promise<ResolveScanResult> {
    const trimmed = payload.trim();
    if (!trimmed) {
      throw new NotFoundError({
        code: ERROR_CODES.BATCH_NOT_FOUND,
        message: 'No barcode payload provided',
      });
    }

    const parsed = parseGs1(trimmed);

    let batchRow: {
      batch_id: number;
      medicine_id: number;
      medicine_name: string;
      batch_number: string;
      expiry_date: string;
      mrp: string;
      selling_price: string;
      gst_rate: string;
      quantity_on_hand: number;
      price_incl_gst: string;
    } | null = null;

    // 1. Try GTIN match if GTIN parsed
    if (parsed.gtin) {
      const sql = `
        SELECT b.batch_id, b.medicine_id, m.name AS medicine_name,
               b.batch_number, b.expiry_date::text AS expiry_date,
               b.mrp, b.selling_price, m.gst_rate, b.quantity_on_hand,
               ROUND(b.selling_price * (1.0 + (m.gst_rate / 100.0)), 2) AS price_incl_gst
        FROM batches b
        JOIN medicines m ON b.medicine_id = m.medicine_id
        WHERE b.gtin = $1
          AND b.status = 'ACTIVE'
          AND b.expiry_date >= today_ist()
          AND b.quantity_on_hand > 0
          ${medicineId ? 'AND b.medicine_id = $2' : ''}
        ORDER BY b.expiry_date ASC, b.batch_id ASC
        LIMIT 1
      `;
      const params = medicineId ? [parsed.gtin, medicineId] : [parsed.gtin];
      const res = await query<any>(sql, params);
      if (res.rowCount && res.rowCount > 0) {
        batchRow = res.rows[0];
      }
    }

    // 2. Try Batch Number + Expiry match if both parsed
    if (!batchRow && parsed.batchNumber && parsed.expiryDate) {
      const sql = `
        SELECT b.batch_id, b.medicine_id, m.name AS medicine_name,
               b.batch_number, b.expiry_date::text AS expiry_date,
               b.mrp, b.selling_price, m.gst_rate, b.quantity_on_hand,
               ROUND(b.selling_price * (1.0 + (m.gst_rate / 100.0)), 2) AS price_incl_gst
        FROM batches b
        JOIN medicines m ON b.medicine_id = m.medicine_id
        WHERE LOWER(TRIM(b.batch_number)) = LOWER(TRIM($1))
          AND b.expiry_date = $2
          AND b.status = 'ACTIVE'
          AND b.expiry_date >= today_ist()
          AND b.quantity_on_hand > 0
          ${medicineId ? 'AND b.medicine_id = $3' : ''}
        ORDER BY b.expiry_date ASC, b.batch_id ASC
        LIMIT 1
      `;
      const params = medicineId
        ? [parsed.batchNumber, parsed.expiryDate, medicineId]
        : [parsed.batchNumber, parsed.expiryDate];
      const res = await query<any>(sql, params);
      if (res.rowCount && res.rowCount > 0) {
        batchRow = res.rows[0];
      }
    }

    // 3. Fallback: match batch_number directly with raw trimmed text
    if (!batchRow) {
      const sql = `
        SELECT b.batch_id, b.medicine_id, m.name AS medicine_name,
               b.batch_number, b.expiry_date::text AS expiry_date,
               b.mrp, b.selling_price, m.gst_rate, b.quantity_on_hand,
               ROUND(b.selling_price * (1.0 + (m.gst_rate / 100.0)), 2) AS price_incl_gst
        FROM batches b
        JOIN medicines m ON b.medicine_id = m.medicine_id
        WHERE LOWER(TRIM(b.batch_number)) = LOWER(TRIM($1))
          AND b.status = 'ACTIVE'
          AND b.expiry_date >= today_ist()
          AND b.quantity_on_hand > 0
          ${medicineId ? 'AND b.medicine_id = $2' : ''}
        ORDER BY b.expiry_date ASC, b.batch_id ASC
        LIMIT 1
      `;
      const params = medicineId ? [trimmed, medicineId] : [trimmed];
      const res = await query<any>(sql, params);
      if (res.rowCount && res.rowCount > 0) {
        batchRow = res.rows[0];
      }
    }

    if (!batchRow) {
      throw new NotFoundError({
        code: ERROR_CODES.BATCH_NOT_FOUND,
        message: medicineId
          ? `No active unexpired batch found for medicine #${medicineId} matching scan payload '${trimmed}'`
          : `No active unexpired batch found matching scan payload '${trimmed}'`,
      });
    }

    return {
      batchId: batchRow.batch_id,
      medicineId: batchRow.medicine_id,
      medicineName: batchRow.medicine_name,
      batchNumber: batchRow.batch_number,
      expiryDate: batchRow.expiry_date,
      mrp: Number(batchRow.mrp).toFixed(2),
      sellingPrice: Number(batchRow.selling_price).toFixed(2),
      gstRate: Number(batchRow.gst_rate).toFixed(2),
      priceInclGst: Number(batchRow.price_incl_gst).toFixed(2),
      quantityOnHand: batchRow.quantity_on_hand,
    };
  }
}

export const allocationService = new AllocationService();
