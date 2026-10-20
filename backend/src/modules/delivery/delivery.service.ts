import { query, withTransaction } from '../../config/db.js';
import { USER_ROLE } from '../../enums/user-role.enum.js';
import { ORDER_STATUS } from '../../enums/order-status.enum.js';
import { LEDGER_ENTRY_TYPE } from '../../enums/ledger-entry-type.enum.js';
import { ERROR_CODES } from '../../constants/error-codes.js';
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
  ValidationError,
  ExternalServiceError,
} from '../../errors/app-error.js';
import { uploadDeliveryPhoto } from '../../utils/storage.js';
import { applyLedgerEntry } from '../stock-ledger/stock-ledger.service.js';
import type {
  PoolOrderDto,
  PartnerOrderSummaryDto,
  DeliveryOrderDetailDto,
  LineDecisionDto,
} from './delivery.types.js';

export class DeliveryService {
  /**
   * Retrieves orders in APPROVED status with no assigned delivery partner, ordered oldest first.
   */
  async getPoolOrders(options: { page: number; pageSize: number }) {
    const { page, pageSize } = options;
    const offset = (page - 1) * pageSize;

    const countSql = `
      SELECT COUNT(*)::INT AS total
      FROM orders
      WHERE status = 'APPROVED' AND delivery_partner_id IS NULL
    `;
    const countRes = await query(countSql);
    const totalItems = countRes.rows[0]?.total || 0;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    const listSql = `
      SELECT
        o.order_id,
        o.order_number,
        o.status,
        o.created_at,
        u.id AS retailer_user_id,
        u.username AS retailer_username,
        u.phone AS user_phone,
        COALESCE(rp.shop_name, u.username) AS shop_name,
        COALESCE(rp.city, '') AS city,
        COALESCE(rp.pincode, '') AS pincode,
        COALESCE(COUNT(oi.order_item_id), 0)::INT AS item_count,
        COALESCE(SUM(ROUND(oi.picked_quantity * oi.quoted_price_incl_gst, 2)), 0.00)::TEXT AS total_amount,
        (
          SELECT created_at
          FROM order_status_history
          WHERE order_id = o.order_id AND to_status = 'APPROVED'
          ORDER BY created_at DESC LIMIT 1
        ) AS approved_at
      FROM orders o
      JOIN users u ON o.retailer_id = u.id
      LEFT JOIN retailer_profiles rp ON u.id = rp.user_id
      LEFT JOIN order_items oi ON o.order_id = oi.order_id
      WHERE o.status = 'APPROVED' AND o.delivery_partner_id IS NULL
      GROUP BY o.order_id, o.order_number, o.status, o.created_at, u.id, u.username, u.phone, rp.shop_name, rp.city, rp.pincode
      ORDER BY o.created_at ASC
      LIMIT $1 OFFSET $2
    `;
    const listRes = await query(listSql, [pageSize, offset]);

    const items: PoolOrderDto[] = listRes.rows.map((row: any) => ({
      orderId: row.order_id,
      orderNumber: row.order_number,
      retailer: {
        userId: row.retailer_user_id,
        shopName: row.shop_name,
        pharmacyName: row.shop_name,
        city: row.city,
        pincode: row.pincode,
        phone: row.user_phone || '',
      },
      itemCount: row.item_count,
      totalAmount: parseFloat(row.total_amount).toFixed(2),
      approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : null,
      createdAt: new Date(row.created_at).toISOString(),
    }));

    return {
      items,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    };
  }

  /**
   * Atomically claims an approved order for delivery using a single conditional SQL update.
   */
  async claimOrder(params: { partnerId: string; orderId: number }): Promise<DeliveryOrderDetailDto> {
    const { partnerId, orderId } = params;

    const claimSql = `
      UPDATE orders
      SET status = 'OUT_FOR_DELIVERY',
          delivery_partner_id = $1,
          claimed_at = NOW(),
          updated_at = NOW()
      WHERE order_id = $2
        AND status = 'APPROVED'
        AND delivery_partner_id IS NULL
      RETURNING order_id, order_number, status, claimed_at
    `;
    const claimRes = await query(claimSql, [partnerId, orderId]);

    if (claimRes.rowCount === 0) {
      // Determine the specific reason the atomic update failed
      const checkRes = await query(
        `SELECT order_id, status, delivery_partner_id FROM orders WHERE order_id = $1`,
        [orderId]
      );

      if (checkRes.rowCount === 0) {
        throw new NotFoundError({
          code: ERROR_CODES.NOT_FOUND,
          message: 'Order not found',
        });
      }

      const existing = checkRes.rows[0];
      if (existing.delivery_partner_id !== null) {
        throw new ConflictError({
          code: ERROR_CODES.ORDER_ALREADY_CLAIMED,
          message: 'This order has already been claimed by another delivery partner',
        });
      }

      if (existing.status !== ORDER_STATUS.APPROVED) {
        throw new ConflictError({
          code: ERROR_CODES.INVALID_STATE_TRANSITION,
          message: `Cannot claim order with status '${existing.status}'. Order must be in APPROVED status.`,
        });
      }

      throw new ConflictError({
        code: ERROR_CODES.ORDER_ALREADY_CLAIMED,
        message: 'Order is no longer available to be claimed',
      });
    }

    // Record order status history
    await query(
      `INSERT INTO order_status_history (order_id, from_status, to_status, actor_id, note)
       VALUES ($1, 'APPROVED', 'OUT_FOR_DELIVERY', $2, 'Order claimed from dispatch pool')`,
      [orderId, partnerId]
    );

    return this.getOrderDetail({
      actor: { userId: partnerId, role: USER_ROLE.DELIVERY },
      orderId,
    });
  }

  /**
   * Releases an order currently OUT_FOR_DELIVERY back to APPROVED in the pool.
   */
  async releaseOrder(params: {
    actor: { userId: string; role: string };
    orderId: number;
    reason?: string;
  }) {
    const { actor, orderId, reason } = params;

    return withTransaction(async (client) => {
      const orderRes = await client.query(
        `SELECT order_id, status, delivery_partner_id FROM orders WHERE order_id = $1 FOR UPDATE`,
        [orderId]
      );

      if (orderRes.rowCount === 0) {
        throw new NotFoundError({
          code: ERROR_CODES.NOT_FOUND,
          message: 'Order not found',
        });
      }

      const order = orderRes.rows[0];
      if (order.status !== ORDER_STATUS.OUT_FOR_DELIVERY) {
        throw new ConflictError({
          code: ERROR_CODES.INVALID_STATE_TRANSITION,
          message: `Cannot release order with status '${order.status}'. Order must be OUT_FOR_DELIVERY.`,
        });
      }

      if (actor.role === USER_ROLE.DELIVERY && order.delivery_partner_id !== actor.userId) {
        throw new ForbiddenError({
          code: ERROR_CODES.FORBIDDEN,
          message: 'You are not assigned to this delivery order',
        });
      }

      await client.query(
        `UPDATE orders
         SET status = 'APPROVED',
             delivery_partner_id = NULL,
             claimed_at = NULL,
             updated_at = NOW()
         WHERE order_id = $1`,
        [orderId]
      );

      const noteText = reason ? `Order released back to pool: ${reason}` : 'Order released back to dispatch pool';
      await client.query(
        `INSERT INTO order_status_history (order_id, from_status, to_status, actor_id, note)
         VALUES ($1, 'OUT_FOR_DELIVERY', 'APPROVED', $2, $3)`,
        [orderId, actor.userId, noteText]
      );

      return {
        orderId,
        status: ORDER_STATUS.APPROVED,
        message: 'Order successfully released back to dispatch pool',
      };
    });
  }

  /**
   * Admin override for an OUT_FOR_DELIVERY order: either resets to pool or reassigns to another partner.
   */
  async overrideOrder(params: {
    adminId: string;
    orderId: number;
    targetPartnerId?: string | null;
    reason: string;
  }) {
    const { adminId, orderId, targetPartnerId, reason } = params;

    return withTransaction(async (client) => {
      const orderRes = await client.query(
        `SELECT order_id, status, delivery_partner_id FROM orders WHERE order_id = $1 FOR UPDATE`,
        [orderId]
      );

      if (orderRes.rowCount === 0) {
        throw new NotFoundError({
          code: ERROR_CODES.NOT_FOUND,
          message: 'Order not found',
        });
      }

      const order = orderRes.rows[0];
      if (order.status !== ORDER_STATUS.OUT_FOR_DELIVERY) {
        throw new ConflictError({
          code: ERROR_CODES.INVALID_STATE_TRANSITION,
          message: `Cannot override order with status '${order.status}'. Order must be OUT_FOR_DELIVERY.`,
        });
      }

      if (targetPartnerId) {
        // Validate target user exists and has DELIVERY role
        const userRes = await client.query(
          `SELECT id, role, is_active FROM users WHERE id = $1`,
          [targetPartnerId]
        );
        if (userRes.rowCount === 0 || userRes.rows[0].role !== USER_ROLE.DELIVERY || !userRes.rows[0].is_active) {
          throw new ValidationError({
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Target partner must be an active delivery user',
          });
        }

        await client.query(
          `UPDATE orders
           SET delivery_partner_id = $1,
               claimed_at = NOW(),
               updated_at = NOW()
           WHERE order_id = $2`,
          [targetPartnerId, orderId]
        );

        await client.query(
          `INSERT INTO order_status_history (order_id, from_status, to_status, actor_id, note)
           VALUES ($1, 'OUT_FOR_DELIVERY', 'OUT_FOR_DELIVERY', $2, $3)`,
          [orderId, adminId, `Admin reassigned delivery partner: ${reason}`]
        );
      } else {
        // Reset back to pool
        await client.query(
          `UPDATE orders
           SET status = 'APPROVED',
               delivery_partner_id = NULL,
               claimed_at = NULL,
               updated_at = NOW()
           WHERE order_id = $1`,
          [orderId]
        );

        await client.query(
          `INSERT INTO order_status_history (order_id, from_status, to_status, actor_id, note)
           VALUES ($1, 'OUT_FOR_DELIVERY', 'APPROVED', $2, $3)`,
          [orderId, adminId, `Admin override returned to pool: ${reason}`]
        );
      }

      return {
        orderId,
        message: 'Admin override executed successfully',
      };
    });
  }

  /**
   * Retrieves orders assigned to the authenticated delivery partner.
   */
  async getPartnerOrders(params: {
    partnerId: string;
    status?: string;
    page: number;
    pageSize: number;
  }) {
    const { partnerId, status, page, pageSize } = params;
    const offset = (page - 1) * pageSize;

    const conditions: string[] = ['o.delivery_partner_id = $1'];
    const queryParams: any[] = [partnerId];
    let idx = 2;

    if (status) {
      conditions.push(`o.status = $${idx++}`);
      queryParams.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*)::INT AS total FROM orders o ${whereClause}`;
    const countRes = await query(countSql, queryParams);
    const totalItems = countRes.rows[0]?.total || 0;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    const listSql = `
      SELECT
        o.order_id,
        o.order_number,
        o.status,
        o.claimed_at,
        o.delivered_at,
        o.created_at,
        COALESCE(rp.shop_name, u.username) AS shop_name,
        COALESCE(rp.city, '') AS city,
        COALESCE(COUNT(oi.order_item_id), 0)::INT AS item_count,
        COALESCE(SUM(ROUND(oi.picked_quantity * oi.quoted_price_incl_gst, 2)), 0.00)::TEXT AS total_amount
      FROM orders o
      JOIN users u ON o.retailer_id = u.id
      LEFT JOIN retailer_profiles rp ON u.id = rp.user_id
      LEFT JOIN order_items oi ON o.order_id = oi.order_id
      ${whereClause}
      GROUP BY o.order_id, o.order_number, o.status, o.claimed_at, o.delivered_at, o.created_at, rp.shop_name, u.username, rp.city
      ORDER BY o.claimed_at DESC NULLS LAST, o.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    queryParams.push(pageSize, offset);
    const listRes = await query(listSql, queryParams);

    const items: PartnerOrderSummaryDto[] = listRes.rows.map((row: any) => ({
      orderId: row.order_id,
      orderNumber: row.order_number,
      status: row.status,
      retailerShopName: row.shop_name,
      city: row.city,
      itemCount: row.item_count,
      totalAmount: parseFloat(row.total_amount).toFixed(2),
      claimedAt: row.claimed_at ? new Date(row.claimed_at).toISOString() : null,
      deliveredAt: row.delivered_at ? new Date(row.delivered_at).toISOString() : null,
      createdAt: new Date(row.created_at).toISOString(),
    }));

    return {
      items,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    };
  }

  /**
   * Retrieves full details for a single delivery order stop with address, phone, and batch allocations.
   */
  async getOrderDetail(
    params: {
      actor: { userId: string; role: string };
      orderId: number;
    },
    client?: any
  ): Promise<DeliveryOrderDetailDto> {
    const { actor, orderId } = params;
    const dbClient = client || { query };

    const orderSql = `
      SELECT
        o.order_id,
        o.order_number,
        o.status,
        o.note,
        o.claimed_at,
        o.delivered_at,
        o.delivery_photo_path,
        o.rejection_reason,
        o.created_at,
        o.delivery_partner_id,
        u.id AS retailer_user_id,
        u.username AS retailer_username,
        u.phone AS user_phone,
        COALESCE(rp.shop_name, u.username) AS shop_name,
        COALESCE(rp.address_line, '') AS address_line,
        COALESCE(rp.city, '') AS city,
        COALESCE(rp.state, '') AS state,
        COALESCE(rp.pincode, '') AS pincode,
        COALESCE(rp.whatsapp_number, u.phone) AS whatsapp_number,
        dp.id AS dp_id,
        dp.username AS dp_username
      FROM orders o
      JOIN users u ON o.retailer_id = u.id
      LEFT JOIN retailer_profiles rp ON u.id = rp.user_id
      LEFT JOIN users dp ON o.delivery_partner_id = dp.id
      WHERE o.order_id = $1
    `;
    const orderRes = await dbClient.query(orderSql, [orderId]);

    if (orderRes.rowCount === 0) {
      throw new NotFoundError({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Order not found',
      });
    }

    const order = orderRes.rows[0];

    // Authorization: Assigned delivery partner or Admin only
    if (actor.role === USER_ROLE.DELIVERY && order.delivery_partner_id !== actor.userId) {
      throw new ForbiddenError({
        code: ERROR_CODES.FORBIDDEN,
        message: 'You are not assigned to this delivery order',
      });
    }

    // Query line items
    const itemsSql = `
      SELECT
        oi.order_item_id,
        oi.medicine_id,
        m.name AS medicine_name,
        m.company,
        m.pack_size,
        oi.requested_quantity,
        oi.picked_quantity,
        oi.quoted_price_incl_gst::TEXT AS quoted_price_incl_gst,
        oi.delivery_status,
        oi.refusal_reason
      FROM order_items oi
      JOIN medicines m ON oi.medicine_id = m.medicine_id
      WHERE oi.order_id = $1
      ORDER BY oi.order_item_id ASC
    `;
    const itemsRes = await dbClient.query(itemsSql, [orderId]);

    // Query batch allocations
    const allocSql = `
      SELECT
        oa.allocation_id,
        oa.order_item_id,
        oa.batch_id,
        b.batch_number,
        b.expiry_date::TEXT AS expiry_date,
        oa.quantity,
        oa.rate::TEXT AS rate,
        oa.mrp::TEXT AS mrp,
        oa.gst_rate::TEXT AS gst_rate
      FROM order_allocations oa
      JOIN batches b ON oa.batch_id = b.batch_id
      JOIN order_items oi ON oa.order_item_id = oi.order_item_id
      WHERE oi.order_id = $1
      ORDER BY oa.allocation_id ASC
    `;
    const allocRes = await dbClient.query(allocSql, [orderId]);

    const allocsByItem: Record<number, any[]> = {};
    for (const alloc of allocRes.rows) {
      if (!allocsByItem[alloc.order_item_id]) {
        allocsByItem[alloc.order_item_id] = [];
      }
      allocsByItem[alloc.order_item_id].push({
        allocationId: alloc.allocation_id,
        batchId: alloc.batch_id,
        batchNumber: alloc.batch_number,
        expiryDate: alloc.expiry_date,
        quantity: alloc.quantity,
        rate: alloc.rate,
        mrp: alloc.mrp,
        gstRate: alloc.gst_rate,
      });
    }

    let totalAmountPaise = 0;
    const items = itemsRes.rows.map((row: any) => {
      const unitPaise = Math.round(parseFloat(row.quoted_price_incl_gst) * 100);
      totalAmountPaise += unitPaise * row.picked_quantity;

      return {
        orderItemId: row.order_item_id,
        medicineId: row.medicine_id,
        medicineName: row.medicine_name,
        company: row.company,
        packSize: row.pack_size,
        requestedQuantity: row.requested_quantity,
        pickedQuantity: row.picked_quantity,
        quotedPriceInclGst: parseFloat(row.quoted_price_incl_gst).toFixed(2),
        deliveryStatus: row.delivery_status,
        refusalReason: row.refusal_reason,
        allocations: allocsByItem[row.order_item_id] || [],
      };
    });

    return {
      orderId: order.order_id,
      orderNumber: order.order_number,
      status: order.status,
      note: order.note,
      claimedAt: order.claimed_at ? new Date(order.claimed_at).toISOString() : null,
      deliveredAt: order.delivered_at ? new Date(order.delivered_at).toISOString() : null,
      deliveryPhotoPath: order.delivery_photo_path,
      rejectionReason: order.rejection_reason,
      createdAt: new Date(order.created_at || Date.now()).toISOString(),
      retailer: {
        userId: order.retailer_user_id,
        shopName: order.shop_name,
        pharmacyName: order.shop_name,
        addressLine: order.address_line,
        city: order.city,
        state: order.state,
        pincode: order.pincode,
        whatsappNumber: order.whatsapp_number,
        phone: order.user_phone || order.whatsapp_number,
      },
      deliveryPartner: order.dp_id ? { id: order.dp_id, username: order.dp_username } : null,
      itemCount: items.length,
      totalAmount: (totalAmountPaise / 100).toFixed(2),
      items,
    };
  }

  /**
   * Completes delivery with photo proof and line-level item decisions.
   * Whole-line refusals trigger RETURN_IN (+delta) ledger rows restoring batch inventory.
   */
  async completeDelivery(params: {
    partnerId: string;
    orderId: number;
    file?: { buffer: Buffer; mimetype: string };
    decisions: LineDecisionDto[];
  }): Promise<DeliveryOrderDetailDto> {
    const { partnerId, orderId, file, decisions } = params;

    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new ValidationError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Delivery proof photo is required',
        details: { field: 'photo' },
      });
    }

    // 1. Pre-transaction upload to Supabase Storage or local disk fallback
    let photoPath: string;
    try {
      photoPath = await uploadDeliveryPhoto(file.buffer, file.mimetype, orderId);
    } catch (err: any) {
      throw new ExternalServiceError({
        code: ERROR_CODES.EXTERNAL_SERVICE_ERROR,
        message: 'Failed to upload delivery proof photo. Database state untouched.',
        details: { error: err.message },
      });
    }

    // 2. Atomic Database Transaction
    return withTransaction(async (client) => {
      const orderRes = await client.query(
        `SELECT order_id, order_number, status, delivery_partner_id FROM orders WHERE order_id = $1 FOR UPDATE`,
        [orderId]
      );

      if (orderRes.rowCount === 0) {
        throw new NotFoundError({
          code: ERROR_CODES.NOT_FOUND,
          message: 'Order not found',
        });
      }

      const order = orderRes.rows[0];

      if (order.status !== ORDER_STATUS.OUT_FOR_DELIVERY) {
        throw new ConflictError({
          code: ERROR_CODES.INVALID_STATE_TRANSITION,
          message: `Cannot complete order with status '${order.status}'. Order must be OUT_FOR_DELIVERY.`,
        });
      }

      if (order.delivery_partner_id !== partnerId) {
        throw new ForbiddenError({
          code: ERROR_CODES.FORBIDDEN,
          message: 'You are not the assigned delivery partner for this order',
        });
      }

      // Query active items for this order
      const itemsRes = await client.query(
        `SELECT order_item_id, requested_quantity, picked_quantity, delivery_status
         FROM order_items
         WHERE order_id = $1`,
        [orderId]
      );

      const items = itemsRes.rows;
      const activeItems = items.filter((it: any) => it.picked_quantity > 0);

      // Verify all active items have an explicit decision
      const decisionMap = new Map<number, LineDecisionDto>();
      for (const d of decisions) {
        decisionMap.set(d.orderItemId, d);
      }

      for (const item of activeItems) {
        if (!decisionMap.has(item.order_item_id)) {
          throw new ValidationError({
            code: ERROR_CODES.VALIDATION_ERROR,
            message: `Missing delivery decision for order item ${item.order_item_id}`,
          });
        }
      }

      // Process decisions
      let acceptedCount = 0;
      const refusalReasons: string[] = [];

      for (const item of activeItems) {
        const decision = decisionMap.get(item.order_item_id)!;

        if (decision.decision === 'REFUSED') {
          refusalReasons.push(decision.reason || 'Item refused at doorstep');

          // Mark item refused
          await client.query(
            `UPDATE order_items
             SET delivery_status = 'REFUSED',
                 refusal_reason = $1,
                 updated_at = NOW()
             WHERE order_item_id = $2`,
            [decision.reason || 'Item refused', item.order_item_id]
          );

          // Find all allocations for this item to execute RETURN_IN ledger restoration
          const allocRes = await client.query(
            `SELECT allocation_id, batch_id, quantity FROM order_allocations WHERE order_item_id = $1`,
            [item.order_item_id]
          );

          for (const alloc of allocRes.rows) {
            await applyLedgerEntry(client, {
              batchId: alloc.batch_id,
              type: LEDGER_ENTRY_TYPE.RETURN_IN,
              delta: alloc.quantity, // Positive delta restores stock on hand
              orderId,
              orderItemId: item.order_item_id,
              userId: partnerId,
              reason: `Doorstep refusal: ${decision.reason || 'Item refused'}`,
            });
          }
        } else {
          // Accepted
          acceptedCount++;
          await client.query(
            `UPDATE order_items
             SET delivery_status = 'ACCEPTED',
                 updated_at = NOW()
             WHERE order_item_id = $1`,
            [item.order_item_id]
          );
        }
      }

      // Final order status
      if (acceptedCount > 0) {
        // At least one item accepted -> DELIVERED
        await client.query(
          `UPDATE orders
           SET status = 'DELIVERED',
               delivered_at = NOW(),
               delivery_photo_path = $1,
               updated_at = NOW()
           WHERE order_id = $2`,
          [photoPath, orderId]
        );

        await client.query(
          `INSERT INTO order_status_history (order_id, from_status, to_status, actor_id, note)
           VALUES ($1, 'OUT_FOR_DELIVERY', 'DELIVERED', $2, 'Order successfully delivered with photo proof')`,
          [orderId, partnerId]
        );
      } else {
        // All items refused -> REJECTED
        const combinedReason = refusalReasons.join('; ');
        await client.query(
          `UPDATE orders
           SET status = 'REJECTED',
               delivery_photo_path = $1,
               rejection_reason = $2,
               updated_at = NOW()
           WHERE order_id = $3`,
          [photoPath, combinedReason, orderId]
        );

        await client.query(
          `INSERT INTO order_status_history (order_id, from_status, to_status, actor_id, note)
           VALUES ($1, 'OUT_FOR_DELIVERY', 'REJECTED', $2, $3)`,
          [orderId, partnerId, `All items refused at doorstep: ${combinedReason}`]
        );
      }

      return this.getOrderDetail(
        {
          actor: { userId: partnerId, role: USER_ROLE.DELIVERY },
          orderId,
        },
        client
      );
    });
  }
}

export const deliveryService = new DeliveryService();
