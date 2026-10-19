import type { Request, Response } from 'express';
import { orderService } from './order.service.js';
import { ok, created, okList } from '../../utils/response.js';
import { SUCCESS_CODES } from '../../constants/success-codes.js';
import type { PlaceOrderInput, GetOrdersQueryInput } from './order.validation.js';

export async function placeOrder(req: Request, res: Response) {
  const actor = req.user!;
  const input = req.valid.body as PlaceOrderInput;
  const idempotencyKey = req.idempotencyKey;
  const requestHash = req.requestHash;

  const result = await orderService.placeOrder({
    actor: {
      userId: actor.userId,
      role: actor.role,
      username: actor.username,
    },
    input,
    idempotencyKey,
    requestHash,
  });

  return created(res, {
    code: SUCCESS_CODES.ORDER_PLACED,
    message: 'Order placed successfully',
    data: result.data,
  });
}

export async function getOrders(req: Request, res: Response) {
  const actor = req.user!;
  const queryParams = req.valid.query as GetOrdersQueryInput;

  const { orders, meta } = await orderService.getOrders(
    { userId: actor.userId, role: actor.role },
    queryParams
  );

  return okList(res, {
    code: SUCCESS_CODES.ORDERS_LISTED,
    message: 'Orders retrieved successfully',
    data: orders,
    page: meta.page,
    pageSize: meta.pageSize,
    totalItems: meta.total,
  });
}

export async function getOrderById(req: Request, res: Response) {
  const actor = req.user!;
  const { orderId } = req.valid.params as { orderId: number };

  const order = await orderService.getOrderById(
    { userId: actor.userId, role: actor.role },
    orderId
  );

  return ok(res, {
    code: SUCCESS_CODES.ORDER_FETCHED,
    message: 'Order retrieved successfully',
    data: order,
  });
}

export async function cancelOrder(req: Request, res: Response) {
  const actor = req.user!;
  const { orderId } = req.valid.params as { orderId: number };
  const reason = (req.valid.body as { reason?: string | null })?.reason;

  const result = await orderService.cancelOrder({
    actor: {
      userId: actor.userId,
      role: actor.role,
      username: actor.username,
    },
    orderId,
    reason,
  });

  return ok(res, {
    code: SUCCESS_CODES.ORDER_CANCELLED,
    message: 'Order cancelled successfully',
    data: result,
  });
}
