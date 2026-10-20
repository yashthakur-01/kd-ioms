import type { Request, Response } from 'express';
import { deliveryService } from './delivery.service.js';
import {
  poolQuerySchema,
  partnerOrdersQuerySchema,
  releaseBodySchema,
  overrideBodySchema,
  completeDeliveryBodySchema,
} from './delivery.validation.js';
import { ok } from '../../utils/response.js';
import { ValidationError } from '../../errors/app-error.js';
import { ERROR_CODES } from '../../constants/error-codes.js';

export class DeliveryController {
  /**
   * GET /api/v1/delivery/pool
   */
  async getPool(req: Request, res: Response) {
    const parsed = poolQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid pagination parameters',
        errors: parsed.error.issues.map((i) => ({
          field: i.path.join('.'),
          code: i.code,
          message: i.message,
        })),
      });
    }

    const { items, meta } = await deliveryService.getPoolOrders(parsed.data);
    return ok(res, {
      code: 'DELIVERY_POOL_RETRIEVED',
      message: 'Available pool orders retrieved successfully',
      data: items,
      meta,
    });
  }

  /**
   * POST /api/v1/delivery/orders/:orderId/claim
   */
  async claimOrder(req: Request, res: Response) {
    const orderId = Number(req.params.orderId);
    if (!orderId || isNaN(orderId) || orderId <= 0) {
      throw new ValidationError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'A valid positive integer orderId is required in path parameter',
      });
    }

    const user = (req as any).user;
    const order = await deliveryService.claimOrder({
      partnerId: user.userId,
      orderId,
    });

    return ok(res, {
      code: 'ORDER_CLAIMED',
      message: 'Order claimed successfully for delivery',
      data: order,
    });
  }

  /**
   * POST /api/v1/delivery/orders/:orderId/release
   */
  async releaseOrder(req: Request, res: Response) {
    const orderId = Number(req.params.orderId);
    if (!orderId || isNaN(orderId) || orderId <= 0) {
      throw new ValidationError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'A valid positive integer orderId is required in path parameter',
      });
    }

    const parsed = releaseBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid release payload',
        errors: parsed.error.issues.map((i) => ({
          field: i.path.join('.'),
          code: i.code,
          message: i.message,
        })),
      });
    }

    const user = (req as any).user;
    const result = await deliveryService.releaseOrder({
      actor: user,
      orderId,
      reason: parsed.data.reason,
    });

    return ok(res, {
      code: 'ORDER_RELEASED',
      message: result.message,
      data: result,
    });
  }

  /**
   * POST /api/v1/delivery/orders/:orderId/override
   */
  async overrideOrder(req: Request, res: Response) {
    const orderId = Number(req.params.orderId);
    if (!orderId || isNaN(orderId) || orderId <= 0) {
      throw new ValidationError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'A valid positive integer orderId is required in path parameter',
      });
    }

    const parsed = overrideBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid admin override payload',
        errors: parsed.error.issues.map((i) => ({
          field: i.path.join('.'),
          code: i.code,
          message: i.message,
        })),
      });
    }

    const user = (req as any).user;
    const result = await deliveryService.overrideOrder({
      adminId: user.userId,
      orderId,
      targetPartnerId: parsed.data.targetPartnerId,
      reason: parsed.data.reason,
    });

    return ok(res, {
      code: 'ORDER_OVERRIDDEN',
      message: result.message,
      data: result,
    });
  }

  /**
   * GET /api/v1/delivery/orders
   */
  async getPartnerOrders(req: Request, res: Response) {
    const parsed = partnerOrdersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid delivery orders query parameters',
        errors: parsed.error.issues.map((i) => ({
          field: i.path.join('.'),
          code: i.code,
          message: i.message,
        })),
      });
    }

    const user = (req as any).user;
    const { items, meta } = await deliveryService.getPartnerOrders({
      partnerId: user.userId,
      status: parsed.data.status,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });

    return ok(res, {
      code: 'DELIVERY_ORDERS_RETRIEVED',
      message: 'Partner delivery orders retrieved successfully',
      data: items,
      meta,
    });
  }

  /**
   * GET /api/v1/delivery/orders/:orderId
   */
  async getOrderDetail(req: Request, res: Response) {
    const orderId = Number(req.params.orderId);
    if (!orderId || isNaN(orderId) || orderId <= 0) {
      throw new ValidationError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'A valid positive integer orderId is required in path parameter',
      });
    }

    const user = (req as any).user;
    const order = await deliveryService.getOrderDetail({
      actor: user,
      orderId,
    });

    return ok(res, {
      code: 'DELIVERY_ORDER_DETAIL_RETRIEVED',
      message: 'Delivery order details retrieved successfully',
      data: order,
    });
  }

  /**
   * POST /api/v1/delivery/orders/:orderId/complete
   */
  async completeDelivery(req: Request, res: Response) {
    const orderId = Number(req.params.orderId);
    if (!orderId || isNaN(orderId) || orderId <= 0) {
      throw new ValidationError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'A valid positive integer orderId is required in path parameter',
      });
    }

    const parsed = completeDeliveryBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid delivery decisions payload',
        errors: parsed.error.issues.map((i) => ({
          field: i.path.join('.'),
          code: i.code,
          message: i.message,
        })),
      });
    }

    const user = (req as any).user;
    const file = req.file
      ? { buffer: req.file.buffer, mimetype: req.file.mimetype }
      : undefined;

    const order = await deliveryService.completeDelivery({
      partnerId: user.userId,
      orderId,
      file,
      decisions: parsed.data.decisions,
    });

    return ok(res, {
      code: 'DELIVERY_COMPLETED',
      message:
        order.status === 'DELIVERED'
          ? 'Order delivered successfully'
          : 'Order rejected at doorstep',
      data: order,
    });
  }
}

export const deliveryController = new DeliveryController();
