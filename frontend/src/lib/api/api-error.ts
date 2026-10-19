export interface ApiFieldError {
  field?: string;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorOptions {
  status: number;
  code: string;
  message: string;
  details?: unknown;
  errors?: ApiFieldError[];
  meta?: {
    requestId?: string;
    timestamp?: string;
  };
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly errors: ApiFieldError[];
  public readonly requestId?: string;

  constructor({ status, code, message, details, errors = [], meta }: ApiErrorOptions) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.errors = errors;
    this.requestId = meta?.requestId;
  }
}
