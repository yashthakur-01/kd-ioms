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
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
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
