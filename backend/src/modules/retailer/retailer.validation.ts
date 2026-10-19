import { z } from 'zod';
import { paginationQuery, uuidParam, phoneE164, phoneIndian } from '../../utils/validators.js';
import { APPROVAL_STATUS_VALUES } from '../../enums/approval-status.enum.js';
import { REGEX } from '../../constants/regex.js';

export const upsertProfileSchema = {
  body: z
    .object({
      shopName: z.string().trim().min(2, 'Shop name must be at least 2 characters').max(120, 'Shop name cannot exceed 120 characters'),
      addressLine: z.string().trim().min(5, 'Address line must be at least 5 characters').max(250, 'Address line cannot exceed 250 characters'),
      city: z.string().trim().min(1, 'City is required').max(100, 'City cannot exceed 100 characters'),
      state: z.string().trim().min(1, 'State is required').max(100, 'State cannot exceed 100 characters'),
      pincode: z.string().trim().regex(REGEX.PINCODE_INDIAN, 'Pincode must be exactly 6 digits'),
      whatsappNumber: phoneE164.or(phoneIndian),
      email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
      drugLicenseNumber: z
        .string()
        .trim()
        .min(5, 'Drug license must be at least 5 characters')
        .max(50, 'Drug license cannot exceed 50 characters')
        .regex(REGEX.DRUG_LICENSE, 'Drug license must be 5-50 valid characters'),
      gstin: z
        .string()
        .trim()
        .toUpperCase()
        .regex(REGEX.GSTIN, 'Invalid GSTIN format (must be 15 alphanumeric characters)')
        .optional()
        .or(z.literal('')),
    })
    .strict(),
};

export const listRetailersSchema = {
  query: paginationQuery
    .extend({
      approvalStatus: z.enum(APPROVAL_STATUS_VALUES).optional(),
      q: z.string().trim().max(100).optional(),
      sort: z.string().optional(),
    })
    .strict(),
};

export const getRetailerSchema = {
  params: z
    .object({
      userId: uuidParam,
    })
    .strict(),
};

export const approveRetailerSchema = {
  params: z
    .object({
      userId: uuidParam,
    })
    .strict(),
};

export const rejectRetailerSchema = {
  params: z
    .object({
      userId: uuidParam,
    })
    .strict(),
  body: z
    .object({
      reason: z
        .string()
        .trim()
        .min(5, 'Rejection reason must be at least 5 characters')
        .max(300, 'Rejection reason cannot exceed 300 characters'),
    })
    .strict(),
};
