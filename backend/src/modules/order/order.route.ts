import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { requireApprovedRetailer } from '../../middleware/require-approved-retailer.js';
import { idempotency } from '../../middleware/idempotency.js';
import { validate } from '../../middleware/validate.js';
import { USER_ROLE } from '../../enums/user-role.enum.js';
import {
  placeOrderSchema,
  getOrdersQuerySchema,
  orderIdParamSchema,
  cancelOrderSchema,
} from './order.validation.js';
import {
  placeOrder,
  getOrders,
  getOrderById,
  cancelOrder,
} from './order.controller.js';

export const orderRouter = Router();

// Place order (Retailer for self, Delivery/Admin on behalf)
orderRouter.post(
  '/',
  authenticate,
  authorize(USER_ROLE.RETAILER, USER_ROLE.DELIVERY, USER_ROLE.ADMIN),
  requireApprovedRetailer,
  idempotency,
  validate(placeOrderSchema),
  placeOrder
);

// List orders with tenant isolation & filters
orderRouter.get(
  '/',
  authenticate,
  validate(getOrdersQuerySchema),
  getOrders
);

// Get order details with tenant isolation & allocation masking
orderRouter.get(
  '/:orderId',
  authenticate,
  validate(orderIdParamSchema),
  getOrderById
);

// Cancel order (Retailer only, while PLACED)
orderRouter.post(
  '/:orderId/cancel',
  authenticate,
  authorize(USER_ROLE.RETAILER),
  validate(cancelOrderSchema),
  cancelOrder
);
