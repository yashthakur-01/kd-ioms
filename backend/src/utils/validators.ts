import { z } from 'zod';
import { REGEX } from '../constants/regex.js';
import { LIMITS } from '../constants/limits.js';

export const idParam = z.coerce.number().int().positive();
export const uuidParam = z.string().uuid();

export const paginationQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(LIMITS.MAX_PAGE_SIZE).optional(),
  sort: z.string().optional(),
});

export const nonEmptyText = (min: number = 1, max: number = 255) =>
  z.string().trim().min(min).max(max);

export const moneyString = z.string().trim().regex(REGEX.MONEY_STRING, 'Must be a valid decimal amount (e.g. 100.80)');

export const quantity = (min: number = 1, max: number = LIMITS.MAX_STOCK_INWARD_QUANTITY) =>
  z.coerce.number().int().min(min).max(max);

export const isoDate = z.string().regex(REGEX.DATE_YYYY_MM_DD, 'Must be in YYYY-MM-DD format');

export const phoneIndian = z.string().regex(REGEX.PHONE_INDIAN, 'Must be a valid 10-digit Indian phone number starting with 6-9');

export const phoneE164 = z.string().regex(REGEX.PHONE_E164, 'Must be a valid E.164 phone number (e.g. +919876543210)');

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(50)
  .regex(REGEX.USERNAME, 'Username must be 3-50 lowercase alphanumeric characters, dots, underscores, or hyphens');

export const passwordSchema = z
  .string()
  .min(LIMITS.PASSWORD_MIN_LENGTH, `Password must be at least ${LIMITS.PASSWORD_MIN_LENGTH} characters`)
  .max(LIMITS.PASSWORD_MAX_LENGTH)
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one digit');
