import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../errors/app-error.js';
import { ERROR_CODES } from '../constants/error-codes.js';


export interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors: Array<{ field: string; code: string; message: string; details?: any }> = [];
    const valid: { body?: any; query?: any; params?: any } = {};

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        collectErrors('params', result.error, errors);
      } else {
        valid.params = result.data;
      }
    } else {
      valid.params = req.params;
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        collectErrors('query', result.error, errors);
      } else {
        valid.query = result.data;
      }
    } else {
      valid.query = req.query;
    }

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        collectErrors('body', result.error, errors);
      } else {
        valid.body = result.data;
      }
    } else {
      valid.body = req.body;
    }

    if (errors.length > 0) {
      throw new ValidationError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid request data',
        errors,
      });
    }

    req.valid = valid;
    next();
  };
}

function collectErrors(
  prefix: string,
  zodError: ZodError,
  outErrors: Array<{ field: string; code: string; message: string; details?: any }>
) {
  for (const issue of zodError.issues) {
    const path = issue.path.length > 0 ? issue.path.join('.') : prefix;
    outErrors.push({
      field: path,
      code: issue.code.toUpperCase(),
      message: issue.message,
    });
  }
}
