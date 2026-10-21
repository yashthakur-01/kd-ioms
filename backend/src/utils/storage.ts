import fs from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { ValidationError } from '../errors/app-error.js';
import { ERROR_CODES } from '../constants/error-codes.js';

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

let cachedSupabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (env.NODE_ENV === 'test' || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  if (!cachedSupabaseClient) {
    cachedSupabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return cachedSupabaseClient;
}

/**
 * Uploads a delivery proof photo to Supabase Storage if credentials are configured,
 * or saves to the local filesystem (uploads/delivery-photos) as a fallback in development/test.
 *
 * @param buffer - File content buffer
 * @param mime - MIME type (image/jpeg, image/png, image/webp)
 * @param orderId - ID of the order being delivered
 * @returns Saved photo path/key
 */
export async function uploadDeliveryPhoto(
  buffer: Buffer,
  mime: string,
  orderId: number
): Promise<string> {
  const ext = ALLOWED_MIME_TYPES[mime.toLowerCase()];
  if (!ext) {
    throw new ValidationError({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Only JPEG, PNG, and WebP images are accepted for delivery proof',
      details: { allowedMimeTypes: Object.keys(ALLOWED_MIME_TYPES), providedMimeType: mime },
    });
  }

  const filename = `${orderId}-${Date.now()}.${ext}`;
  const supabase = getSupabaseClient();

  if (supabase) {
    const bucket = env.SUPABASE_DELIVERY_BUCKET;
    const objectPath = `${filename}`;

    const { error } = await supabase.storage.from(bucket).upload(objectPath, buffer, {
      contentType: mime,
      upsert: true,
    });

    if (error) {
      throw new Error(`Supabase Storage upload failed: ${error.message}`);
    }

    return `${bucket}/${objectPath}`;
  }

  // Local filesystem fallback
  const uploadDir = path.resolve(process.cwd(), 'uploads', 'delivery-photos');
  await fs.promises.mkdir(uploadDir, { recursive: true });
  const localFilePath = path.join(uploadDir, filename);
  await fs.promises.writeFile(localFilePath, buffer);

  return path.posix.join('uploads', 'delivery-photos', filename);
}

/**
 * Uploads an invoice PDF buffer to Supabase Storage if credentials are configured,
 * or saves to the local filesystem (uploads/invoices) as a fallback in development/test.
 *
 * @param buffer - PDF file buffer
 * @param invoiceNumber - Invoice identifier (e.g. INV/2026-27/00001)
 * @returns Storage key/path
 */
export async function uploadInvoicePdf(
  buffer: Buffer,
  invoiceNumber: string
): Promise<string> {
  const safeName = invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeName}.pdf`;
  const supabase = getSupabaseClient();

  if (supabase) {
    const bucket = env.SUPABASE_STORAGE_BUCKET;
    const objectPath = filename;

    const { error } = await supabase.storage.from(bucket).upload(objectPath, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

    if (error) {
      throw new Error(`Supabase Storage upload failed: ${error.message}`);
    }

    return `${bucket}/${objectPath}`;
  }

  // Local filesystem fallback
  const uploadDir = path.resolve(process.cwd(), 'uploads', 'invoices');
  await fs.promises.mkdir(uploadDir, { recursive: true });
  const localFilePath = path.join(uploadDir, filename);
  await fs.promises.writeFile(localFilePath, buffer);

  return path.posix.join('uploads', 'invoices', filename);
}

/**
 * Generates a signed or accessible download URL for an invoice PDF.
 *
 * @param pdfPath - The stored path returned by uploadInvoicePdf
 * @param expiresInSeconds - Validity TTL for the signed URL (default 300 seconds)
 * @returns URL string
 */
export async function getInvoicePdfSignedUrl(
  pdfPath: string,
  expiresInSeconds: number = 300
): Promise<string> {
  const supabase = getSupabaseClient();

  if (supabase && pdfPath.startsWith(`${env.SUPABASE_STORAGE_BUCKET}/`)) {
    const objectPath = pdfPath.slice(env.SUPABASE_STORAGE_BUCKET.length + 1);
    const { data, error } = await supabase.storage
      .from(env.SUPABASE_STORAGE_BUCKET)
      .createSignedUrl(objectPath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new Error(`Failed to generate signed URL from Supabase Storage: ${error?.message}`);
    }

    return data.signedUrl;
  }

  // Local fallback: clean relative download path avoiding double slashes
  const cleanPath = pdfPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const baseUrl = env.PORT ? `http://localhost:${env.PORT}` : env.APP_ORIGIN;
  return `${baseUrl}/${cleanPath}`;
}

