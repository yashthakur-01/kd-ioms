import { z } from 'zod';
import { CAPTURE_METHOD_VALUES } from '../../enums/capture-method.enum.js';

export const inwardStockSchema = {
  body: z
    .object({
      medicineId: z.number().int().positive({ message: 'medicineId must be a positive integer' }),
      batchNumber: z.string().trim().min(1, 'batchNumber cannot be empty').max(50, 'batchNumber cannot exceed 50 characters'),
      expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'expiryDate must be in YYYY-MM-DD format' }),
      mrp: z
        .string()
        .regex(/^\d+(\.\d{1,2})?$/, { message: 'mrp must be a valid positive amount with at most two decimal places' })
        .refine((v) => parseFloat(v) > 0, { message: 'mrp must be greater than zero' }),
      sellingPrice: z
        .string()
        .regex(/^\d+(\.\d{1,2})?$/, { message: 'sellingPrice must be a valid positive amount with at most two decimal places' })
        .refine((v) => parseFloat(v) > 0, { message: 'sellingPrice must be greater than zero' }),
      purchaseRate: z
        .string()
        .regex(/^\d+(\.\d{1,2})?$/, { message: 'purchaseRate must be a valid amount with at most two decimal places' })
        .optional()
        .default('0.00'),
      quantity: z
        .number()
        .int({ message: 'quantity must be an integer' })
        .min(1, { message: 'quantity must be at least 1' })
        .max(100000, { message: 'quantity cannot exceed 100,000' }),
      supplierName: z.string().trim().max(150, { message: 'supplierName cannot exceed 150 characters' }).optional(),
      gtin: z
        .string()
        .trim()
        .regex(/^\d{8,14}$/, { message: 'gtin must be between 8 and 14 digits' })
        .optional(),
      qrPayload: z.string().max(2000, { message: 'qrPayload cannot exceed 2000 characters' }).optional(),
      captureMethod: z.enum(CAPTURE_METHOD_VALUES, {
        message: 'captureMethod must be SCAN_BARCODE, SCAN_OCR, or MANUAL',
      }),
    })
    .strict(),
};

export const scanResolveSchema = {
  body: z
    .object({
      payload: z.string().min(1, { message: 'payload cannot be empty' }).max(2000, { message: 'payload cannot exceed 2000 characters' }),
    })
    .strict(),
};

export type InwardStockInput = z.infer<typeof inwardStockSchema.body>;
export type ScanResolveInput = z.infer<typeof scanResolveSchema.body>;
