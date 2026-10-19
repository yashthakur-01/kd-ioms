import { z } from 'zod';

export const patchSettingsSchema = {
  body: z
    .object({
      expiryAlertDays: z
        .number()
        .int('Expiry alert days must be an integer')
        .min(1, 'Expiry alert days must be at least 1')
        .max(730, 'Expiry alert days cannot exceed 730')
        .optional(),
      businessProfile: z
        .object({
          name: z.string().trim().min(1, 'Company name is required').max(200).optional(),
          address: z.string().trim().min(1, 'Address is required').max(500).optional(),
          gstin: z
            .string()
            .trim()
            .regex(
              /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
              'Invalid Indian GSTIN format'
            )
            .optional(),
          drugLicenseNumber: z.string().trim().min(1, 'Drug license number is required').max(100).optional(),
          phone: z
            .string()
            .trim()
            .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
            .optional(),
          email: z.string().trim().email('Invalid email address').optional(),
          logoPath: z.string().trim().nullable().optional(),
        })
        .optional(),
    })
    .refine((data) => data.expiryAlertDays !== undefined || data.businessProfile !== undefined, {
      message: 'At least one setting (expiryAlertDays or businessProfile) must be provided to update',
    }),
};
