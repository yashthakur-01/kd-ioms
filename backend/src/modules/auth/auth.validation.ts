import { z } from 'zod';

export const loginSchema = {
  body: z
    .object({
      username: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9._-]{3,50}$/, {
          message: 'Username must be 3-50 alphanumeric characters (._- allowed)',
        }),
      password: z.string().min(1, 'Password is required').max(128, 'Password cannot exceed 128 characters'),
    })
    .strict(),
};

export const changePasswordSchema = {
  body: z
    .object({
      currentPassword: z
        .string()
        .min(1, 'Current password is required')
        .max(128, 'Current password cannot exceed 128 characters'),
      newPassword: z
        .string()
        .min(10, 'New password must be at least 10 characters long')
        .max(128, 'New password cannot exceed 128 characters')
        .regex(/[A-Za-z]/, 'New password must contain at least one letter')
        .regex(/\d/, 'New password must contain at least one digit'),
    })
    .strict()
    .refine((data) => data.currentPassword !== data.newPassword, {
      message: 'New password must be different from current password',
      path: ['newPassword'],
    }),
};
