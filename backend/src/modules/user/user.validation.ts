import { z } from 'zod';
import { paginationQuery, uuidParam } from '../../utils/validators.js';
import { USER_ROLE, USER_ROLE_VALUES } from '../../enums/user-role.enum.js';

export const createUserSchema = {
  body: z
    .object({
      username: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9._-]{3,50}$/, {
          message: 'Username must be 3-50 alphanumeric characters (._- allowed)',
        }),
      role: z.enum([USER_ROLE.RETAILER, USER_ROLE.DELIVERY], {
        message: 'Admins can only create RETAILER or DELIVERY users',
      }),
      phone: z.string().regex(/^[6-9]\d{9}$/, {
        message: 'Phone number must be a valid 10-digit Indian mobile number starting with 6-9',
      }),
      temporaryPassword: z.string().min(10).max(128).optional(),
    })
    .strict(),
};

export const listUsersSchema = {
  query: paginationQuery
    .extend({
      role: z.enum(USER_ROLE_VALUES).optional(),
      isActive: z
        .enum(['true', 'false'])
        .transform((v) => v === 'true')
        .optional(),
      q: z.string().trim().max(100).optional(),
      sort: z.string().optional(),
    })
    .strict(),
};

export const getUserSchema = {
  params: z
    .object({
      userId: uuidParam,
    })
    .strict(),
};

export const updateUserSchema = {
  params: z
    .object({
      userId: uuidParam,
    })
    .strict(),
  body: z
    .object({
      phone: z.string().regex(/^[6-9]\d{9}$/, {
        message: 'Phone number must be a valid 10-digit Indian mobile number',
      }).optional(),
      isActive: z.boolean().optional(),
    })
    .strict()
    .refine((data) => data.phone !== undefined || data.isActive !== undefined, {
      message: 'At least one field (phone or isActive) must be provided for update',
    }),
};

export const resetPasswordSchema = {
  params: z
    .object({
      userId: uuidParam,
    })
    .strict(),
};
