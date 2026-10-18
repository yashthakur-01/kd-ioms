import type { UserRole } from '../enums/user-role.enum.js';

export interface AuthenticatedUser {
  userId: string;
  username: string;
  role: UserRole;
  phone: string;
  mustChangePassword: boolean;
}

export interface ValidatedPayload {
  body?: any;
  query?: any;
  params?: any;
}

declare global {
  namespace Express {
    interface Request {
      valid: ValidatedPayload;
      user?: AuthenticatedUser;
    }
  }
}

export {};
