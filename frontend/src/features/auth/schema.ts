import { z } from 'zod';

export const loginFormSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username cannot exceed 50 characters')
    .regex(/^[a-z0-9._-]+$/, 'Username can only contain alphanumeric characters, dots, underscores, or hyphens'),
  password: z.string().min(1, 'Password is required').max(128, 'Password cannot exceed 128 characters'),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;

export const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(10, 'Password must be at least 10 characters')
      .max(128, 'Password cannot exceed 128 characters')
      .regex(/[A-Za-z]/, 'Must contain at least one letter')
      .regex(/\d/, 'Must contain at least one digit'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>;
