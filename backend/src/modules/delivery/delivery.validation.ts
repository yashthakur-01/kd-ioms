import { z } from 'zod';
import { ORDER_STATUS } from '../../enums/order-status.enum.js';

export const poolQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});

export const partnerOrdersQuerySchema = z.object({
  status: z.enum([
    ORDER_STATUS.OUT_FOR_DELIVERY,
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.REJECTED,
  ]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});

export const releaseBodySchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

export const overrideBodySchema = z.object({
  targetPartnerId: z.string().uuid().nullable().optional(),
  reason: z.string().trim().min(5, 'Reason must be at least 5 characters long').max(300),
});

export const lineDecisionSchema = z.object({
  orderItemId: z.number().int().positive(),
  decision: z.enum(['ACCEPTED', 'REFUSED']),
  reason: z.string().trim().max(200).optional(),
}).refine((data) => {
  if (data.decision === 'REFUSED') {
    return typeof data.reason === 'string' && data.reason.trim().length >= 3;
  }
  return true;
}, {
  message: 'Refusal reason must be between 3 and 200 characters when an item is refused',
  path: ['reason'],
});

export const completeDeliveryBodySchema = z.object({
  decisions: z.preprocess((val) => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    }
    return val;
  }, z.array(lineDecisionSchema).min(1, 'At least one line item decision is required')),
});
