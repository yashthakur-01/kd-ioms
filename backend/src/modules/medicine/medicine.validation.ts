import { z } from 'zod';
import { idParam, paginationQuery } from '../../utils/validators.js';

export const createMedicineSchema = {
  body: z
    .object({
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
        .array(z.number().int().positive('Salt ID must be a positive integer'))
        .max(10, 'Cannot link more than 10 salts')
        .default([])
        .refine((ids) => new Set(ids).size === ids.length, {
          message: 'Salt IDs must be distinct',
        }),
    })
    .strict(),
};

export const listMedicinesSchema = {
  query: paginationQuery
    .extend({
      q: z.string().trim().max(100).optional(),
      saltId: z.coerce.number().int().positive().optional(),
      company: z.string().trim().max(100).optional(),
      isActive: z
        .enum(['true', 'false'])
        .transform((v) => v === 'true')
        .optional(),
      sort: z.string().optional(),
    })
    .strict(),
};

export const searchMedicinesSchema = {
  query: z
    .object({
      q: z
        .string()
        .trim()
        .min(2, 'Search query must be at least 2 characters')
        .max(100, 'Search query cannot exceed 100 characters'),
    })
    .strict(),
};

export const getMedicineSchema = {
  params: z
    .object({
      medicineId: idParam,
    })
    .strict(),
};

export const updateMedicineSchema = {
  params: z
    .object({
      medicineId: idParam,
    })
    .strict(),
  body: z
    .object({
      name: z.string().trim().min(2).max(150).optional(),
      company: z.string().trim().min(2).max(100).optional(),
      packSize: z.string().trim().max(50).optional(),
      gstRate: z.number().min(0).max(40).optional(),
      saltIds: z
        .array(z.number().int().positive())
        .max(10)
        .refine((ids) => new Set(ids).size === ids.length, {
          message: 'Salt IDs must be distinct',
        })
        .optional(),
      isActive: z.boolean().optional(),
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided for update',
    }),
};
