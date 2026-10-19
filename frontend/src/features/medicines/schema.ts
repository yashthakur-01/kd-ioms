import { z } from 'zod';

export const createMedicineSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Medicine name must be at least 2 characters')
    .max(150, 'Medicine name cannot exceed 150 characters'),
  company: z
    .string()
    .trim()
    .min(2, 'Company name must be at least 2 characters')
    .max(100, 'Company name cannot exceed 100 characters'),
  packSize: z.string().trim().max(50, 'Pack size cannot exceed 50 characters').default(''),
  gstRate: z
    .number()
    .min(0, 'GST rate must be at least 0%')
    .max(40, 'GST rate cannot exceed 40%'),
  saltIds: z
    .array(z.number().int().positive())
    .max(10, 'Cannot select more than 10 salts')
    .default([]),
});

export type CreateMedicineFormValues = z.infer<typeof createMedicineSchema>;

export const updateMedicineSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  company: z.string().trim().min(2).max(100).optional(),
  packSize: z.string().trim().max(50).optional(),
  gstRate: z.number().min(0).max(40).optional(),
  saltIds: z.array(z.number().int().positive()).max(10).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateMedicineFormValues = z.infer<typeof updateMedicineSchema>;
