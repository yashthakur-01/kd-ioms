import pg from 'pg';
import { query, withTransaction, lockMedicines, lockBatches } from '../../config/db.js';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  BusinessRuleError,
} from '../../errors/app-error.js';
import { ERROR_CODES } from '../../constants/error-codes.js';
import { USER_ROLE } from '../../enums/user-role.enum.js';
import { ORDER_STATUS, type OrderStatus } from '../../enums/order-status.enum.js';
import { LEDGER_ENTRY_TYPE } from '../../enums/ledger-entry-type.enum.js';
import { applyLedgerEntry } from '../stock-ledger/stock-ledger.service.js';
import { assertTransition } from './order.helpers.js';
import { saveIdempotencyKey } from '../../middleware/idempotency.js';
import type {
  PlaceOrderInput,
  GetOrdersQueryInput,
  ApproveOrderInput,
  RejectOrderInput,
} from './order.validation.js';

export interface PlaceOrderServiceParams {
  actor: {
    userId: string;
    role: string;
    username: string;
  };
  input: PlaceOrderInput;
  idempotencyKey?: string;
  requestHash?: string;
}

export interface CancelOrderServiceParams {
  actor: {
    userId: string;
    role: string;
    username: string;
  };
  orderId: number;
  reason?: string | null;
}

export interface ApproveOrderServiceParams {
  adminId: string;
  orderId: number;
  input: ApproveOrderInput;
}

export interface RejectOrderServiceParams {
  adminId: string;
  orderId: number;
  input: RejectOrderInput;
}

export class OrderService {
  /**
   * Places an order against real-time availability with ascending row locks,
   * price ceiling protection, document sequence generation, and idempotency persistence.
   */
  async placeOrder({ actor, input, idempotencyKey, requestHash }: PlaceOrderServiceParams) {
    let targetRetailerId: string;

    if (actor.role === USER_ROLE.RETAILER) {
      if (input.retailerId && input.retailerId !== actor.userId) {
        throw new ValidationError({
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Retailers cannot specify a different retailerId; orders are placed for own account',
        });
      }
      targetRetailerId = actor.userId;

      const profileRes = await query(
        `SELECT approval_status FROM retailer_profiles WHERE user_id = $1`,
        [targetRetailerId]
      );
      if (profileRes.rowCount === 0 || profileRes.rows[0].approval_status !== 'APPROVED') {
        throw new ForbiddenError({
          code: ERROR_CODES.RETAILER_NOT_APPROVED,
          message: 'Account KYC verification is pending admin approval',
        });
      }
    } else if (actor.role === USER_ROLE.DELIVERY || actor.role === USER_ROLE.ADMIN) {
      if (!input.retailerId) {
        throw new ValidationError({
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'A valid approved retailerId must be specified when placing order on behalf',
        });
      }
      targetRetailerId = input.retailerId;

      const profileRes = await query(
        `SELECT approval_status FROM retailer_profiles WHERE user_id = $1`,
        [targetRetailerId]
      );
      if (profileRes.rowCount === 0 || profileRes.rows[0].approval_status !== 'APPROVED') {
        throw new ValidationError({
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Selected retailer does not exist or is not approved',
        });
      }
    } else {
      throw new ForbiddenError({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Your role is not authorized to place orders',
      });
    }

    return withTransaction(async (client: pg.PoolClient) => {
      // 1. Ascending row locking on unique medicine IDs to prevent deadlock
      const sortedMedicineIds = [...new Set(input.items.map((i) => i.medicineId))].sort((a, b) => a - b);
      await lockMedicines(client, sortedMedicineIds);

      // 2. Query sellable stock for locked medicines
      const sellableRes = await client.query<{
        medicine_id: number;
        on_hand_qty: number;
        max_price_incl_gst: string | null;
      }>(
        `SELECT
           b.medicine_id,
           COALESCE(SUM(b.quantity_on_hand), 0)::INT AS on_hand_qty,
           MAX(ROUND(b.selling_price * (1.0 + (m.gst_rate / 100.0)), 2))::TEXT AS max_price_incl_gst
         FROM batches b
         JOIN medicines m ON b.medicine_id = m.medicine_id
         WHERE b.medicine_id = ANY($1::int[])
           AND b.status = 'ACTIVE'
           AND b.expiry_date >= today_ist()
           AND b.quantity_on_hand > 0
         GROUP BY b.medicine_id`,
        [sortedMedicineIds]
      );

      const sellableMap = new Map<number, { onHand: number; maxPriceInclGst: string | null }>();
      for (const row of sellableRes.rows) {
        sellableMap.set(row.medicine_id, {
          onHand: row.on_hand_qty,
          maxPriceInclGst: row.max_price_incl_gst,
        });
      }

      // 3. Query existing PLACED order reservations
      const reservedRes = await client.query<{ medicine_id: number; reserved_qty: number }>(
        `SELECT
           oi.medicine_id,
           COALESCE(SUM(oi.requested_quantity), 0)::INT AS reserved_qty
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.order_id
         WHERE oi.medicine_id = ANY($1::int[])
           AND o.status = 'PLACED'
         GROUP BY oi.medicine_id`,
        [sortedMedicineIds]
      );

      const reservedMap = new Map<number, number>();
      for (const row of reservedRes.rows) {
        reservedMap.set(row.medicine_id, row.reserved_qty);
      }

      // 4. Verify availability per item
      const shortages: Array<{ medicineId: number; requested: number; available: number }> = [];
      for (const item of input.items) {
        const sellable = sellableMap.get(item.medicineId);
        const onHand = sellable ? sellable.onHand : 0;
        const reserved = reservedMap.get(item.medicineId) || 0;
        const available = Math.max(0, onHand - reserved);

        if (item.quantity > available) {
          shortages.push({
            medicineId: item.medicineId,
            requested: item.quantity,
            available,
          });
        }
      }

      if (shortages.length > 0) {
        throw new ConflictError({
          code: ERROR_CODES.INSUFFICIENT_STOCK,
          message: 'Insufficient stock for requested medicines',
          details: { items: shortages },
        });
      }

      // 5. Verify price quote integrity against catalog maximum
      for (const item of input.items) {
        const sellable = sellableMap.get(item.medicineId);
        const currentMaxPrice = sellable?.maxPriceInclGst;

        if (currentMaxPrice) {
          const quoted = parseFloat(item.quotedPriceInclGst);
          const current = parseFloat(currentMaxPrice);
          if (quoted < current) {
            throw new ConflictError({
              code: ERROR_CODES.PRICE_CHANGED,
              message: 'One or more medicine prices have changed since quote was generated',
              details: {
                medicineId: item.medicineId,
                quotedPriceInclGst: item.quotedPriceInclGst,
                currentPriceInclGst: currentMaxPrice,
              },
            });
          }
        }
      }

      // 6. Generate sequential document number
      const docRes = await client.query<{ order_number: string }>(
        `SELECT next_document_number('ORD') AS order_number`
      );
      const orderNumber = docRes.rows[0].order_number;

      // 7. Insert order
      const orderRes = await client.query<{
        order_id: number;
        order_number: string;
        retailer_id: string;
        status: OrderStatus;
        note: string | null;
        created_at: Date;
      }>(
        `INSERT INTO orders (order_number, retailer_id, status, note)
         VALUES ($1, $2, 'PLACED', $3)
         RETURNING order_id, order_number, retailer_id, status, note, created_at`,
        [orderNumber, targetRetailerId, input.note || null]
      );
      const order = orderRes.rows[0];

      // 8. Insert order items
      let totalAmountPaise = 0;
      const insertedItems: Array<{
        orderItemId: number;
        medicineId: number;
        requestedQuantity: number;
        quotedPriceInclGst: string;
        fulfilmentStatus: string;
        deliveryStatus: string;
      }> = [];

      for (const item of input.items) {
        const itemRes = await client.query<{
          order_item_id: number;
          medicine_id: number;
          requested_quantity: number;
          quoted_price_incl_gst: string;
          fulfilment_status: string;
          delivery_status: string;
        }>(
          `INSERT INTO order_items (order_id, medicine_id, requested_quantity, quoted_price_incl_gst)
           VALUES ($1, $2, $3, $4)
           RETURNING order_item_id, medicine_id, requested_quantity, quoted_price_incl_gst, fulfilment_status, delivery_status`,
          [order.order_id, item.medicineId, item.quantity, item.quotedPriceInclGst]
        );
        const ins = itemRes.rows[0];
        insertedItems.push({
          orderItemId: ins.order_item_id,
          medicineId: ins.medicine_id,
          requestedQuantity: ins.requested_quantity,
          quotedPriceInclGst: parseFloat(ins.quoted_price_incl_gst).toFixed(2),
          fulfilmentStatus: ins.fulfilment_status,
          deliveryStatus: ins.delivery_status,
        });

        const unitPaise = Math.round(parseFloat(ins.quoted_price_incl_gst) * 100);
        totalAmountPaise += unitPaise * ins.requested_quantity;
      }

      // 9. Insert initial status history row
      await client.query(
        `INSERT INTO order_status_history (order_id, from_status, to_status, actor_id, note)
         VALUES ($1, NULL, 'PLACED', $2, 'Order placed')`,
        [order.order_id, actor.userId]
      );

      const totalAmount = (totalAmountPaise / 100).toFixed(2);

      const responseEnvelope = {
        success: true,
        code: 'OK',
        message: 'Order placed successfully',
        data: {
          orderId: order.order_id,
          orderNumber: order.order_number,
          status: order.status,
          retailerId: order.retailer_id,
          note: order.note,
          itemCount: insertedItems.length,
          totalAmount,
          items: insertedItems,
          createdAt: order.created_at.toISOString(),
        },
      };

      // 10. Persist idempotency key inside the transaction
      if (idempotencyKey && requestHash) {
        await saveIdempotencyKey(client, idempotencyKey, actor.userId, requestHash, responseEnvelope);
      }

      return responseEnvelope;
    });
  }

  /**
   * Retrieves paginated list of orders with filters and role-based tenant isolation.
   */
  async getOrders(actor: { userId: string; role: string }, queryParams: GetOrdersQueryInput) {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    // Tenant isolation: RETAILER only sees own orders
    if (actor.role === USER_ROLE.RETAILER) {
      conditions.push(`o.retailer_id = $${idx++}`);
      values.push(actor.userId);
    } else if (queryParams.retailerId) {
      conditions.push(`o.retailer_id = $${idx++}`);
      values.push(queryParams.retailerId);
    }

    if (actor.role === USER_ROLE.DELIVERY) {
      conditions.push(`(o.delivery_partner_id = $${idx} OR o.delivery_partner_id IS NULL)`);
      idx++;
      values.push(actor.userId);
    }

    if (queryParams.status) {
      conditions.push(`o.status = $${idx++}`);
      values.push(queryParams.status);
    }

    if (queryParams.from) {
      conditions.push(`o.created_at >= $${idx++}`);
      values.push(queryParams.from);
    }

    if (queryParams.to) {
      conditions.push(`o.created_at <= $${idx++}`);
      values.push(queryParams.to);
    }

    if (queryParams.q) {
      conditions.push(`o.order_number ILIKE $${idx++}`);
      values.push(`%${queryParams.q.trim()}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total count
    const countSql = `SELECT COUNT(*)::INT AS total FROM orders o ${whereClause}`;
    const countRes = await query<{ total: number }>(countSql, values);
    const total = countRes.rows[0]?.total || 0;

    const page = queryParams.page || 1;
    const pageSize = queryParams.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const sortDir = queryParams.sort === 'createdAt' ? 'ASC' : 'DESC';

    const listSql = `
      SELECT
        o.order_id,
        o.order_number,
        o.status,
        o.note,
        o.created_at,
        u.id AS retailer_user_id,
        u.username AS retailer_username,
        rp.shop_name AS pharmacy_name,
        COALESCE(COUNT(oi.order_item_id), 0)::INT AS item_count,
        COALESCE(SUM(ROUND(oi.requested_quantity * oi.quoted_price_incl_gst, 2)), 0.00)::TEXT AS total_amount
      FROM orders o
      JOIN users u ON o.retailer_id = u.id
      LEFT JOIN retailer_profiles rp ON u.id = rp.user_id
      LEFT JOIN order_items oi ON o.order_id = oi.order_id
      ${whereClause}
      GROUP BY o.order_id, u.id, u.username, rp.shop_name
      ORDER BY o.created_at ${sortDir}
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    const listValues = [...values, pageSize, offset];
    const listRes = await query(listSql, listValues);

    const orders = listRes.rows.map((row: any) => ({
      orderId: row.order_id,
      orderNumber: row.order_number,
      status: row.status,
      note: row.note,
      itemCount: row.item_count,
      totalAmount: parseFloat(row.total_amount).toFixed(2),
      retailer: {
        id: row.retailer_user_id,
        username: row.retailer_username,
        pharmacyName: row.pharmacy_name || row.retailer_username,
      },
      createdAt: row.created_at.toISOString(),
    }));

    return {
      orders,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }

  /**
   * Retrieves full details for a single order by ID with tenant isolation and allocation masking.
   */
  async getOrderById(actor: { userId: string; role: string }, orderId: number) {
    const orderSql = `
      SELECT
        o.order_id,
        o.order_number,
        o.retailer_id,
        o.delivery_partner_id,
        o.status,
        o.note,
        o.rejection_reason,
        o.cancelled_at,
        o.delivered_at,
        o.delivery_photo_path,
        o.created_at,
        u.username AS retailer_username,
        rp.shop_name AS pharmacy_name,
        dp.username AS delivery_partner_username,
        dp.phone AS delivery_partner_phone
      FROM orders o
      JOIN users u ON o.retailer_id = u.id
      LEFT JOIN retailer_profiles rp ON u.id = rp.user_id
      LEFT JOIN users dp ON o.delivery_partner_id = dp.id
      WHERE o.order_id = $1
    `;
    const orderRes = await query(orderSql, [orderId]);

    if (orderRes.rowCount === 0) {
      throw new NotFoundError({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Order not found',
      });
    }

    const order = orderRes.rows[0];

    // Strict tenant isolation: Retailer can ONLY view their own orders
    if (actor.role === USER_ROLE.RETAILER && order.retailer_id !== actor.userId) {
      throw new NotFoundError({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Order not found',
      });
    }

    // Query line items
    const itemsSql = `
      SELECT
        oi.order_item_id,
        oi.medicine_id,
        oi.requested_quantity,
        oi.quoted_price_incl_gst::TEXT AS quoted_price_incl_gst,
        oi.picked_quantity,
        oi.fulfilment_status,
        oi.delivery_status,
        oi.refusal_reason,
        m.name AS medicine_name,
        m.company,
        m.pack_size,
        m.gst_rate::TEXT AS gst_rate
      FROM order_items oi
      JOIN medicines m ON oi.medicine_id = m.medicine_id
      WHERE oi.order_id = $1
      ORDER BY oi.order_item_id ASC
    `;
    const itemsRes = await query(itemsSql, [orderId]);

    let totalAmountPaise = 0;
    const items = itemsRes.rows.map((row: any) => {
      const unitPaise = Math.round(parseFloat(row.quoted_price_incl_gst) * 100);
      totalAmountPaise += unitPaise * row.requested_quantity;

      return {
        orderItemId: row.order_item_id,
        medicineId: row.medicine_id,
        medicineName: row.medicine_name,
        company: row.company,
        packSize: row.pack_size,
        gstRate: row.gst_rate,
        requestedQuantity: row.requested_quantity,
        quotedPriceInclGst: parseFloat(row.quoted_price_incl_gst).toFixed(2),
        pickedQuantity: row.picked_quantity,
        fulfilmentStatus: row.fulfilment_status,
        deliveryStatus: row.delivery_status,
        refusalReason: row.refusal_reason,
      };
    });

    // Query status history
    const historySql = `
      SELECT
        osh.history_id,
        osh.from_status,
        osh.to_status,
        osh.actor_id,
        osh.note,
        osh.created_at,
        u.username AS actor_username,
        u.role AS actor_role
      FROM order_status_history osh
      LEFT JOIN users u ON osh.actor_id = u.id
      WHERE osh.order_id = $1
      ORDER BY osh.created_at ASC, osh.history_id ASC
    `;
    const historyRes = await query(historySql, [orderId]);
    const history = historyRes.rows.map((h: any) => ({
      historyId: h.history_id,
      fromStatus: h.from_status,
      toStatus: h.to_status,
      actorId: h.actor_id,
      actorName: h.actor_username || 'System',
      actorRole: h.actor_role,
      note: h.note,
      createdAt: h.created_at.toISOString(),
    }));

    // Allocations masking: only exposed to ADMIN and DELIVERY
    let allocations: any[] | undefined = undefined;
    if (actor.role === USER_ROLE.ADMIN || actor.role === USER_ROLE.DELIVERY) {
      const allocSql = `
        SELECT
          oa.allocation_id,
          oa.order_item_id,
          oa.batch_id,
          oa.quantity,
          oa.rate::TEXT AS rate,
          oa.mrp::TEXT AS mrp,
          oa.gst_rate::TEXT AS gst_rate,
          oa.capture_method,
          oa.created_at,
          b.batch_number,
          b.expiry_date
        FROM order_allocations oa
        JOIN batches b ON oa.batch_id = b.batch_id
        JOIN order_items oi ON oa.order_item_id = oi.order_item_id
        WHERE oi.order_id = $1
        ORDER BY oa.allocation_id ASC
      `;
      const allocRes = await query(allocSql, [orderId]);
      allocations = allocRes.rows.map((a: any) => ({
        allocationId: a.allocation_id,
        orderItemId: a.order_item_id,
        batchId: a.batch_id,
        batchNumber: a.batch_number,
        expiryDate: a.expiry_date,
        quantity: a.quantity,
        rate: a.rate,
        mrp: a.mrp,
        gstRate: a.gst_rate,
        captureMethod: a.capture_method,
        createdAt: a.created_at.toISOString(),
      }));
    }

    return {
      orderId: order.order_id,
      orderNumber: order.order_number,
      status: order.status,
      retailer: {
        id: order.retailer_id,
        username: order.retailer_username,
        pharmacyName: order.pharmacy_name || order.retailer_username,
      },
      deliveryPartner: order.delivery_partner_id
        ? {
            id: order.delivery_partner_id,
            username: order.delivery_partner_username,
            phone: order.delivery_partner_phone || null,
          }
        : null,
      deliveryPhotoPath: order.delivery_photo_path || null,
      note: order.note,
      rejectionReason: order.rejection_reason,
      cancelledAt: order.cancelled_at ? order.cancelled_at.toISOString() : null,
      deliveredAt: order.delivered_at ? order.delivered_at.toISOString() : null,
      createdAt: order.created_at.toISOString(),
      totalAmount: (totalAmountPaise / 100).toFixed(2),
      itemCount: items.length,
      items,
      history,
      ...(allocations !== undefined ? { allocations } : {}),
      invoice: await (async () => {
        if (order.status === ORDER_STATUS.DELIVERED) {
          const invRes = await query(
            `SELECT invoice_id, invoice_number, total::TEXT AS total, pdf_path FROM invoices WHERE order_id = $1`,
            [orderId]
          );
          if (invRes.rows.length > 0) {
            return {
              invoiceId: invRes.rows[0].invoice_id,
              invoiceNumber: invRes.rows[0].invoice_number,
              total: invRes.rows[0].total,
              pdfPath: invRes.rows[0].pdf_path,
            };
          }
          // If DELIVERED but invoice record is not yet present, auto-generate on-the-fly
          try {
            const { invoiceService } = await import('../invoice/invoice.service.js');
            const generated = await invoiceService.generateInvoice(orderId);
            return {
              invoiceId: generated.invoiceId,
              invoiceNumber: generated.invoiceNumber,
              total: generated.total,
              pdfPath: generated.pdfPath,
            };
          } catch (autoGenErr: any) {
            console.warn(`[ORDER INVOICE AUTO-GEN] Could not generate invoice for order #${orderId}:`, autoGenErr.message);
          }
        }
        return null;
      })(),
    };
  }

  /**
   * Cancels an order while in PLACED status.
   * Releases inventory reservation immediately.
   */
  async cancelOrder({ actor, orderId, reason }: CancelOrderServiceParams) {
    return withTransaction(async (client: pg.PoolClient) => {
      const orderRes = await client.query<{
        order_id: number;
        retailer_id: string;
        status: OrderStatus;
        order_number: string;
      }>(
        `SELECT order_id, retailer_id, status, order_number FROM orders WHERE order_id = $1 FOR UPDATE`,
        [orderId]
      );

      if (orderRes.rowCount === 0) {
        throw new NotFoundError({
          code: ERROR_CODES.NOT_FOUND,
          message: 'Order not found',
        });
      }

      const order = orderRes.rows[0];

      // Tenant isolation: Retailer can only cancel their own order
      if (actor.role === USER_ROLE.RETAILER && order.retailer_id !== actor.userId) {
        throw new NotFoundError({
          code: ERROR_CODES.NOT_FOUND,
          message: 'Order not found',
        });
      }

      // Assert transition (must be PLACED)
      assertTransition(order.status, ORDER_STATUS.CANCELLED);

      const updateRes = await client.query<{
        order_id: number;
        order_number: string;
        status: OrderStatus;
        cancelled_at: Date;
      }>(
        `UPDATE orders
         SET status = 'CANCELLED',
             cancelled_at = NOW(),
             rejection_reason = $2,
             updated_at = NOW()
         WHERE order_id = $1
         RETURNING order_id, order_number, status, cancelled_at`,
        [orderId, reason || null]
      );

      await client.query(
        `INSERT INTO order_status_history (order_id, from_status, to_status, actor_id, note)
         VALUES ($1, 'PLACED', 'CANCELLED', $2, $3)`,
        [orderId, actor.userId, reason || 'Order cancelled by retailer']
      );

      const updated = updateRes.rows[0];
      return {
        orderId: updated.order_id,
        orderNumber: updated.order_number,
        status: updated.status,
        cancelledAt: updated.cancelled_at.toISOString(),
      };
    });
  }

  /**
   * Approves a PLACED order with picked batch allocations.
   * Locks batches in ascending numeric order, validates business invariants,
   * inserts order_allocations, decrements physical stock via OUTWARD ledger entries,
   * updates line items (FULL, PARTIAL, NONE), drops shortfall, and marks order APPROVED.
   */
  async approveOrder({ adminId, orderId, input }: ApproveOrderServiceParams) {
    return withTransaction(async (client) => {
      // 1. Lock order row
      const orderRes = await client.query<{
        order_id: number;
        order_number: string;
        status: OrderStatus;
      }>(
        `SELECT order_id, order_number, status
         FROM orders
         WHERE order_id = $1
         FOR UPDATE`,
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
          message: `Cannot approve order in status '${order.status}'. Order must be in 'PLACED' status`,
        });
      }

      // 2. Fetch order items for this order
      const itemsRes = await client.query<{
        order_item_id: number;
        order_id: number;
        medicine_id: number;
        requested_quantity: number;
        quoted_price_incl_gst: string;
      }>(
        `SELECT order_item_id, order_id, medicine_id, requested_quantity, quoted_price_incl_gst
         FROM order_items
         WHERE order_id = $1`,
        [orderId]
      );

      const itemsMap = new Map<number, (typeof itemsRes.rows)[0]>();
      for (const item of itemsRes.rows) {
        itemsMap.set(item.order_item_id, item);
      }

      // 3. Validate picks coverage and total quantities
      let totalPickedOverall = 0;
      const allBatchIds: number[] = [];

      for (const pick of input.picks) {
        const orderItem = itemsMap.get(pick.orderItemId);
        if (!orderItem) {
          throw new ValidationError({
            code: ERROR_CODES.VALIDATION_ERROR,
            message: `Order item #${pick.orderItemId} does not belong to order #${orderId}`,
          });
        }

        let linePicked = 0;
        for (const alloc of pick.allocations) {
          linePicked += alloc.quantity;
          allBatchIds.push(alloc.batchId);
        }

        if (linePicked > orderItem.requested_quantity) {
          throw new BusinessRuleError({
            code: ERROR_CODES.PICK_EXCEEDS_REQUESTED,
            message: `Total picked quantity (${linePicked}) exceeds requested quantity (${orderItem.requested_quantity}) for order item #${pick.orderItemId}`,
          });
        }

        totalPickedOverall += linePicked;
      }

      if (totalPickedOverall === 0) {
        throw new ValidationError({
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Cannot approve order with zero picked items. Use reject order instead',
        });
      }

      // 4. Lock all referenced batches in ascending order
      await lockBatches(client, allBatchIds);

      const lockedBatchesRes = await client.query<{
        batch_id: number;
        medicine_id: number;
        status: string;
        expiry_date: string;
        quantity_on_hand: number;
        selling_price: string;
        mrp: string;
        gst_rate: string;
        price_incl_gst: string;
      }>(
        `SELECT b.batch_id, b.medicine_id, b.status, b.expiry_date::text AS expiry_date,
                b.quantity_on_hand, b.selling_price, b.mrp, m.gst_rate,
                ROUND(b.selling_price * (1.0 + (m.gst_rate / 100.0)), 2) AS price_incl_gst
         FROM batches b
         JOIN medicines m ON b.medicine_id = m.medicine_id
         WHERE b.batch_id = ANY($1::int[])`,
        [[...new Set(allBatchIds)]]
      );

      const batchesMap = new Map<number, (typeof lockedBatchesRes.rows)[0]>();
      for (const b of lockedBatchesRes.rows) {
        batchesMap.set(b.batch_id, b);
      }

      // Track decrements per batch if same batch allocated across multiple lines
      const batchRemainingOnHand = new Map<number, number>();
      for (const [batchId, b] of batchesMap.entries()) {
        batchRemainingOnHand.set(batchId, b.quantity_on_hand);
      }

      // Today in IST
      const todayRes = await client.query<{ today: string }>('SELECT today_ist()::text AS today');
      const todayIst = todayRes.rows[0].today;

      // 5. Deep validate all allocations against business invariants
      for (const pick of input.picks) {
        const orderItem = itemsMap.get(pick.orderItemId)!;
        const quotedCeiling = Number(orderItem.quoted_price_incl_gst);

        for (const alloc of pick.allocations) {
          const batch = batchesMap.get(alloc.batchId);
          if (!batch) {
            throw new NotFoundError({
              code: ERROR_CODES.BATCH_NOT_FOUND,
              message: `Batch #${alloc.batchId} does not exist`,
            });
          }

          if (batch.medicine_id !== orderItem.medicine_id) {
            throw new BusinessRuleError({
              code: ERROR_CODES.BATCH_MEDICINE_MISMATCH,
              message: `Batch #${batch.batch_id} medicine (${batch.medicine_id}) does not match order item medicine (${orderItem.medicine_id})`,
            });
          }

          if (batch.status !== 'ACTIVE') {
            throw new BusinessRuleError({
              code: ERROR_CODES.BATCH_BLOCKED,
              message: `Batch #${batch.batch_id} is blocked (status: ${batch.status})`,
            });
          }

          if (batch.expiry_date < todayIst) {
            throw new BusinessRuleError({
              code: ERROR_CODES.BATCH_EXPIRED,
              message: `Cannot pick from expired batch #${batch.batch_id} (expiry: ${batch.expiry_date})`,
            });
          }

          const currentAvailable = batchRemainingOnHand.get(alloc.batchId) ?? 0;
          if (currentAvailable < alloc.quantity) {
            throw new BusinessRuleError({
              code: ERROR_CODES.PICK_EXCEEDS_ON_HAND,
              message: `Allocated quantity (${alloc.quantity}) exceeds on-hand stock (${currentAvailable}) for batch #${batch.batch_id}`,
            });
          }
          batchRemainingOnHand.set(alloc.batchId, currentAvailable - alloc.quantity);

          const effectivePrice = Number(batch.price_incl_gst);
          if (effectivePrice > quotedCeiling) {
            throw new BusinessRuleError({
              code: ERROR_CODES.PRICE_EXCEEDS_QUOTE,
              message: `Batch #${batch.batch_id} effective price incl GST (${effectivePrice.toFixed(2)}) exceeds quoted price (${quotedCeiling.toFixed(2)})`,
            });
          }
        }
      }

      // 6. Execute allocations and ledger reductions
      const lineResults: Array<{
        orderItemId: number;
        requestedQuantity: number;
        pickedQuantity: number;
        fulfilmentStatus: string;
        allocations: Array<{
          allocationId: number;
          batchId: number;
          quantity: number;
        }>;
      }> = [];

      for (const pick of input.picks) {
        const orderItem = itemsMap.get(pick.orderItemId)!;
        let linePickedQty = 0;
        const createdAllocations: Array<{ allocationId: number; batchId: number; quantity: number }> = [];

        for (const alloc of pick.allocations) {
          const batch = batchesMap.get(alloc.batchId)!;
          linePickedQty += alloc.quantity;

          const allocRes = await client.query<{ allocation_id: number }>(
            `INSERT INTO order_allocations (
               order_item_id, batch_id, quantity, rate, mrp, gst_rate, capture_method, scanned_payload
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING allocation_id`,
            [
              pick.orderItemId,
              alloc.batchId,
              alloc.quantity,
              batch.selling_price,
              batch.mrp,
              batch.gst_rate,
              alloc.captureMethod,
              alloc.scannedPayload || null,
            ]
          );

          createdAllocations.push({
            allocationId: allocRes.rows[0].allocation_id,
            batchId: alloc.batchId,
            quantity: alloc.quantity,
          });

          // Append-only ledger decrement
          await applyLedgerEntry(client, {
            batchId: alloc.batchId,
            type: LEDGER_ENTRY_TYPE.OUTWARD,
            delta: -alloc.quantity,
            orderId,
            orderItemId: pick.orderItemId,
            userId: adminId,
          });
        }

        let fulfilmentStatus = 'NONE';
        if (linePickedQty === orderItem.requested_quantity) {
          fulfilmentStatus = 'FULL';
        } else if (linePickedQty > 0) {
          fulfilmentStatus = 'PARTIAL';
        }

        await client.query(
          `UPDATE order_items
           SET picked_quantity = $1,
               fulfilment_status = $2,
               updated_at = NOW()
           WHERE order_item_id = $3`,
          [linePickedQty, fulfilmentStatus, pick.orderItemId]
        );

        lineResults.push({
          orderItemId: pick.orderItemId,
          requestedQuantity: orderItem.requested_quantity,
          pickedQuantity: linePickedQty,
          fulfilmentStatus,
          allocations: createdAllocations,
        });
      }

      // 7. Update order to APPROVED and log history
      await client.query(
        `UPDATE orders
         SET status = 'APPROVED',
             approved_at = NOW(),
             updated_at = NOW()
         WHERE order_id = $1`,
        [orderId]
      );

      await client.query(
        `INSERT INTO order_status_history (order_id, from_status, to_status, actor_id, note)
         VALUES ($1, 'PLACED', 'APPROVED', $2, 'Order approved with batch picking allocations')`,
        [orderId, adminId]
      );

      return {
        orderId: order.order_id,
        orderNumber: order.order_number,
        status: ORDER_STATUS.APPROVED,
        items: lineResults,
      };
    });
  }

  /**
   * Rejects an order. If PLACED, updates status.
   * If APPROVED and unclaimed, restores stock to original batches via RESTOCK entries before rejecting.
   */
  async rejectOrder({ adminId, orderId, input }: RejectOrderServiceParams) {
    return withTransaction(async (client) => {
      // 1. Lock order row
      const orderRes = await client.query<{
        order_id: number;
        order_number: string;
        status: OrderStatus;
        delivery_partner_id: string | null;
      }>(
        `SELECT order_id, order_number, status, delivery_partner_id
         FROM orders
         WHERE order_id = $1
         FOR UPDATE`,
        [orderId]
      );

      if (orderRes.rowCount === 0) {
        throw new NotFoundError({
          code: ERROR_CODES.NOT_FOUND,
          message: `Order #${orderId} does not exist`,
        });
      }

      const order = orderRes.rows[0];

      // If order is PLACED
      if (order.status === ORDER_STATUS.PLACED) {
        assertTransition(ORDER_STATUS.PLACED, ORDER_STATUS.REJECTED);

        await client.query(
          `UPDATE orders
           SET status = 'REJECTED',
               rejection_reason = $2,
               updated_at = NOW()
           WHERE order_id = $1`,
          [orderId, input.reason]
        );

        await client.query(
          `INSERT INTO order_status_history (order_id, from_status, to_status, actor_id, note)
           VALUES ($1, 'PLACED', 'REJECTED', $2, $3)`,
          [orderId, adminId, input.reason]
        );

        return {
          orderId: order.order_id,
          orderNumber: order.order_number,
          status: ORDER_STATUS.REJECTED,
          rejectionReason: input.reason,
        };
      }

      // If order is APPROVED
      if (order.status === ORDER_STATUS.APPROVED) {
        if (order.delivery_partner_id !== null) {
          throw new ConflictError({
            code: ERROR_CODES.INVALID_STATE_TRANSITION,
            message: 'Order is already claimed by delivery partner and cannot be rejected by admin',
          });
        }

        assertTransition(ORDER_STATUS.APPROVED, ORDER_STATUS.REJECTED);

        // Query all allocations for this order
        const allocsRes = await client.query<{
          allocation_id: number;
          batch_id: number;
          order_item_id: number;
          quantity: number;
        }>(
          `SELECT oa.allocation_id, oa.batch_id, oa.order_item_id, oa.quantity
           FROM order_allocations oa
           JOIN order_items oi ON oa.order_item_id = oi.order_item_id
           WHERE oi.order_id = $1
           ORDER BY oa.batch_id ASC`,
          [orderId]
        );

        // Lock batches in ascending order before restock
        const batchIds = allocsRes.rows.map((a) => a.batch_id);
        await lockBatches(client, batchIds);

        // Apply RESTOCK (+quantity) per allocation
        for (const alloc of allocsRes.rows) {
          await applyLedgerEntry(client, {
            batchId: alloc.batch_id,
            type: LEDGER_ENTRY_TYPE.RESTOCK,
            delta: alloc.quantity,
            orderId,
            orderItemId: alloc.order_item_id,
            reason: `Order rejection restock: ${input.reason}`,
            userId: adminId,
          });
        }

        await client.query(
          `UPDATE orders
           SET status = 'REJECTED',
               rejection_reason = $2,
               updated_at = NOW()
           WHERE order_id = $1`,
          [orderId, input.reason]
        );

        await client.query(
          `INSERT INTO order_status_history (order_id, from_status, to_status, actor_id, note)
           VALUES ($1, 'APPROVED', 'REJECTED', $2, $3)`,
          [orderId, adminId, input.reason]
        );

        return {
          orderId: order.order_id,
          orderNumber: order.order_number,
          status: ORDER_STATUS.REJECTED,
          rejectionReason: input.reason,
        };
      }

      // Any other status cannot be rejected
      throw new ConflictError({
        code: ERROR_CODES.INVALID_STATE_TRANSITION,
        message: `Cannot reject order in status '${order.status}'`,
      });
    });
  }
}

export const orderService = new OrderService();

