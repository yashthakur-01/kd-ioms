import { z } from 'zod';

export const settingsFormSchema = z.object({
  expiryAlertDays: z.coerce
    .number()
    .int('Threshold must be an integer')
    .min(1, 'Threshold must be at least 1 day')
    .max(730, 'Threshold cannot exceed 730 days'),
  businessProfile: z.object({
    name: z.string().trim().min(1, 'Company legal name is required').max(200),
    address: z.string().trim().min(1, 'Registered address is required').max(500),
    gstin: z
      .string()
      .trim()
      .regex(
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
        'Invalid GSTIN format (e.g. 24AAAAA0000A1Z5)'
      ),
    drugLicenseNumber: z.string().trim().min(1, 'Drug license number is required').max(100),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format (e.g. +919876543210)'),
    email: z.string().trim().email('Invalid email address'),
    logoPath: z.string().trim().nullable().optional(),
  }),
});

export type SettingsFormData = z.infer<typeof settingsFormSchema>;
