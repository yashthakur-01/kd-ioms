import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../errors/app-error.js';
import { ERROR_CODES } from '../constants/error-codes.js';

export const deliveryPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(
        new ValidationError({
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Only JPEG, PNG, and WebP images are accepted for delivery proof',
          details: { field: 'photo', providedMimeType: file.mimetype },
        })
      );
    }
  },
});

export function handleUploadErrors(err: any, _req: Request, _res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(
        new ValidationError({
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Delivery proof photo exceeds maximum allowed size of 5 MB',
          details: { field: 'photo', maxSizeBytes: 5 * 1024 * 1024 },
        })
      );
    }
    return next(
      new ValidationError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: `File upload error: ${err.message}`,
        details: { field: 'photo', code: err.code },
      })
    );
  }
  next(err);
}
