import { AppError, ConflictError, BusinessRuleError, NotFoundError } from '../errors/app-error.js';
import { ERROR_CODES } from '../constants/error-codes.js';

interface PostgresErrorLike {
  code?: string;
  detail?: string;
  message?: string;
  constraint?: string;
}

export function mapDbError(err: unknown): AppError {
  if (err instanceof AppError) {
    return err;
  }

  const pgErr = err as PostgresErrorLike;
  const code = pgErr.code;
  const message = pgErr.message || '';
  const detail = pgErr.detail || '';

  // 23505: Unique constraint violation
  if (code === '23505') {
    let msg = 'A resource with this identifier already exists';
    const constraint = (pgErr.constraint || detail || message).toLowerCase();
    if (constraint.includes('salts_name')) {
      msg = 'A salt with this name already exists';
    } else if (constraint.includes('medicines_identity')) {
      msg = 'A medicine with this name, company, and pack size already exists';
    } else if (constraint.includes('users_username') || constraint.includes('username')) {
      msg = 'A user with this username already exists';
    }

    return new ConflictError({
      code: ERROR_CODES.DUPLICATE_RESOURCE,
      message: msg,
      errors: [{ code: 'DUPLICATE', message: detail || message }],
      cause: err,
    });
  }

  // 23503: Foreign key violation
  if (code === '23503') {
    return new ConflictError({
      code: ERROR_CODES.INVALID_STATE_TRANSITION,
      message: 'Referenced entity does not exist or is in use',
      errors: [{ code: 'FOREIGN_KEY_VIOLATION', message: detail || message }],
      cause: err,
    });
  }

  // 23514: Check constraint violation
  if (code === '23514') {
    if (message.includes('selling_price') || message.includes('mrp')) {
      return new BusinessRuleError({
        code: ERROR_CODES.PRICE_EXCEEDS_MRP,
        message: 'Selling price exceeds Maximum Retail Price (MRP)',
        cause: err,
      });
    }
    if (message.includes('expiry')) {
      return new BusinessRuleError({
        code: ERROR_CODES.EXPIRY_IN_PAST,
        message: 'Expiry date cannot be in the past',
        cause: err,
      });
    }
    return new BusinessRuleError({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Database check constraint failed',
      cause: err,
    });
  }

  // Custom trigger errors raised via RAISE EXCEPTION
  if (message.includes('BATCH_EXPIRED')) {
    return new BusinessRuleError({
      code: ERROR_CODES.BATCH_EXPIRED,
      message: 'Cannot pick from an expired batch',
      cause: err,
    });
  }

  if (message.includes('BATCH_MEDICINE_MISMATCH')) {
    return new BusinessRuleError({
      code: ERROR_CODES.BATCH_MEDICINE_MISMATCH,
      message: 'Batch does not belong to the selected medicine',
      cause: err,
    });
  }

  if (message.includes('PRICE_EXCEEDS_QUOTE')) {
    return new BusinessRuleError({
      code: ERROR_CODES.PRICE_EXCEEDS_QUOTE,
      message: 'Batch price exceeds the quoted price on the order',
      cause: err,
    });
  }

  // 40001 (Serialization Failure) or 40P01 (Deadlock)
  if (code === '40001' || code === '40P01') {
    return new ConflictError({
      code: ERROR_CODES.INVALID_STATE_TRANSITION,
      message: 'Database concurrency conflict detected. Please retry the operation.',
      cause: err,
    });
  }

  // Default fallback to 500 internal error wrapper
  return new AppError({
    code: ERROR_CODES.INTERNAL_ERROR,
    httpStatus: 500,
    message: 'An unexpected database error occurred',
    cause: err,
  });
}
