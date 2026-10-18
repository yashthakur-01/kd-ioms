import { z } from 'zod';

export const PINCODE_REGEX = /^\d{6}$/;
export const PHONE_REGEX = /^(?:\+91)?[6-9]\d{9}$|^\+[1-9]\d{7,14}$/;
export const DRUG_LICENSE_REGEX = /^[A-Za-z0-9\-\/ ]{5,50}$/;
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const retailerProfileFormSchema = z.object({
  shopName: z
    .string()
    .trim()
    .min(2, 'Shop name must be at least 2 characters')
    .max(120, 'Shop name cannot exceed 120 characters'),
  addressLine: z
    .string()
    .trim()
    .min(5, 'Address line must be at least 5 characters')
    .max(250, 'Address line cannot exceed 250 characters'),
  city: z
    .string()
    .trim()
    .min(1, 'City is required')
    .max(100, 'City cannot exceed 100 characters'),
  state: z
    .string()
    .trim()
    .min(1, 'State is required')
    .max(100, 'State cannot exceed 100 characters'),
  pincode: z
    .string()
    .trim()
    .regex(PINCODE_REGEX, 'Pincode must be exactly 6 digits'),
  whatsappNumber: z
    .string()
    .trim()
    .regex(PHONE_REGEX, 'Must be a valid 10-digit mobile or E.164 number (e.g. +919876543210)'),
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .optional()
    .or(z.literal('')),
  drugLicenseNumber: z
    .string()
    .trim()
    .min(5, 'Drug license must be at least 5 characters')
    .max(50, 'Drug license cannot exceed 50 characters')
    .regex(DRUG_LICENSE_REGEX, 'Drug license must be 5-50 valid characters'),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(GSTIN_REGEX, 'Invalid GSTIN format (must be 15 alphanumeric characters)')
    .optional()
    .or(z.literal('')),
});

export type RetailerProfileFormData = z.infer<typeof retailerProfileFormSchema>;

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface RetailerProfile {
  id: string;
  userId: string;
  shopName: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  whatsappNumber: string;
  email?: string | null;
  drugLicenseNumber: string;
  gstin?: string | null;
  approvalStatus: ApprovalStatus;
  rejectionReason?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RetailerRecord extends RetailerProfile {
  username: string;
  userPhone: string;
  userIsActive: boolean;
}

export interface RetailerProfileResponse {
  profile: RetailerProfile | null;
  approvalStatus: ApprovalStatus | null;
}
