import { z } from 'zod';

export const inwardStockFormSchema = z
  .object({
    medicineId: z.number().int().positive('Please select a medicine'),
    medicineName: z.string().optional(),
    medicineCompany: z.string().optional(),
    gstRate: z.number(),
    batchNumber: z.string().trim().min(1, 'Batch number is required').max(50, 'Batch number too long'),
    expiryDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry date must be in YYYY-MM-DD format')
      .refine((val) => {
        const today = new Date().toISOString().slice(0, 10);
        return val >= today;
      }, 'Expiry date cannot be in the past'),
    mrp: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, 'MRP must be a valid positive amount')
      .refine((v) => parseFloat(v) > 0, 'MRP must be greater than zero'),
    sellingPrice: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, 'Selling price must be a valid positive amount')
      .refine((v) => parseFloat(v) > 0, 'Selling price must be greater than zero'),
    purchaseRate: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, 'Purchase rate must be valid amount')
      .optional(),
    quantity: z
      .number()
      .int('Quantity must be an integer')
      .min(1, 'Quantity must be at least 1')
      .max(100000, 'Quantity cannot exceed 100,000'),
    supplierName: z.string().trim().max(150, 'Supplier name cannot exceed 150 characters').optional(),
    gtin: z
      .string()
      .trim()
      .regex(/^\d{8,14}$/, 'GTIN must be between 8 and 14 digits')
      .optional()
      .or(z.literal('')),
    qrPayload: z.string().optional(),
    captureMethod: z.enum(['SCAN_BARCODE', 'SCAN_OCR', 'MANUAL']),
  })
  .refine(
    (data) => {
      const sp = parseFloat(data.sellingPrice);
      const mrp = parseFloat(data.mrp);
      if (isNaN(sp) || isNaN(mrp)) return true;
      const gstFactor = 1.0 + data.gstRate / 100.0;
      const effectiveSp = Math.round(sp * gstFactor * 100) / 100;
      return effectiveSp <= mrp;
    },
    {
      message: 'Selling price inclusive of GST cannot exceed MRP',
      path: ['sellingPrice'],
    }
  );

export type InwardStockFormData = z.infer<typeof inwardStockFormSchema>;
