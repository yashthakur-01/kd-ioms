import { z } from 'zod';
import { USER_ROLE } from '../../lib/enums';

export const createUserFormSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username cannot exceed 50 characters')
    .regex(/^[a-z0-9._-]+$/, 'Username can only contain alphanumeric characters, dots, underscores, or hyphens'),
  role: z.enum([USER_ROLE.RETAILER, USER_ROLE.DELIVERY], {
    message: 'Please select a role (Retailer or Delivery)',
  }),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian phone number starting with 6-9'),
  temporaryPassword: z.string().min(10, 'Must be at least 10 characters').max(128).optional().or(z.literal('')),
});

export type CreateUserFormValues = z.infer<typeof createUserFormSchema>;
