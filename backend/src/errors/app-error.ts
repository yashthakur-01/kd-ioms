export interface AppErrorOptions {
  code: string;
  httpStatus: number;
  message: string;
  details?: Record<string, unknown>;
  errors?: Array<{
    field?: string;
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }>;
  cause?: unknown;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly details?: Record<string, unknown>;
  public readonly errors: Array<{
    field?: string;
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }>;

  constructor({ code, httpStatus, message, details, errors = [], cause }: AppErrorOptions) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
    this.errors = errors;
    if (cause) {
      this.cause = cause;
    }
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(options: Omit<AppErrorOptions, 'httpStatus'>) {
    super({ ...options, httpStatus: 400 });
  }
}

export class AuthError extends AppError {
  constructor(options: Omit<AppErrorOptions, 'httpStatus'>) {
    super({ ...options, httpStatus: 401 });
  }
}

export class ForbiddenError extends AppError {
  constructor(options: Omit<AppErrorOptions, 'httpStatus'>) {
    super({ ...options, httpStatus: 403 });
  }
}

export class NotFoundError extends AppError {
  constructor(options: Omit<AppErrorOptions, 'httpStatus'>) {
    super({ ...options, httpStatus: 404 });
  }
}

export class ConflictError extends AppError {
  constructor(options: Omit<AppErrorOptions, 'httpStatus'>) {
    super({ ...options, httpStatus: 409 });
  }
}

export class BusinessRuleError extends AppError {
  constructor(options: Omit<AppErrorOptions, 'httpStatus'>) {
    super({ ...options, httpStatus: 422 });
  }
}

export class ExternalServiceError extends AppError {
  constructor(options: Omit<AppErrorOptions, 'httpStatus'>) {
    super({ ...options, httpStatus: 502 });
  }
}
