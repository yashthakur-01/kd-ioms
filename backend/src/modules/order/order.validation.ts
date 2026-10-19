import { z } from 'zod';
import { ORDER_STATUS_VALUES } from '../../enums/order-status.enum.js';

export const placeOrderItemSchema = z.object({
  medicineId: z.number().int().positive('Medicine ID must be positive'),
  quantity: z
    .number()
    .int()
    .min(1, 'Quantity must be at least 1')
    .max(5000, 'Quantity cannot exceed 5000'),
  quotedPriceInclGst: z
    .string()
    .regex(/^\d+(\.\d{2})?$/, 'quotedPriceInclGst must be a valid two-decimal number string'),
});

export const placeOrderBodySchema = z.object({
  retailerId: z.string().uuid('retailerId must be a valid UUID').optional(),
  note: z.string().trim().max(300, 'Note cannot exceed 300 characters').optional().nullable(),
  items: z
    .array(placeOrderItemSchema)
    .min(1, 'Order must contain at least 1 item')
    .max(60, 'Order cannot exceed 60 items')
    .refine(
      (items) => {
        const ids = items.map((i) => i.medicineId);
        return new Set(ids).size === ids.length;
      },
      { message: 'Order cannot contain duplicate medicine items' }
    ),
});

export const placeOrderSchema = {
  body: placeOrderBodySchema,
};

export const getOrdersQuerySchema = {
  query: z.object({
    status: z.enum(ORDER_STATUS_VALUES as unknown as [string, ...string[]]).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    retailerId: z.string().uuid().optional(),
    q: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
    sort: z.enum(['createdAt', '-createdAt']).default('-createdAt'),
  }),
};

export const orderIdParamSchema = {
  params: z.object({
    orderId: z.coerce.number().int().positive('Order ID must be a positive integer'),
  }),
};

export const cancelOrderSchema = {
  params: z.object({
    orderId: z.coerce.number().int().positive('Order ID must be a positive integer'),
  }),
  body: z.object({
    reason: z.string().trim().max(300, 'Cancellation reason cannot exceed 300 characters').optional().nullable(),
  }).optional(),
};

export type PlaceOrderInput = z.infer<typeof placeOrderBodySchema>;
export type GetOrdersQueryInput = z.infer<typeof getOrdersQuerySchema.query>;
