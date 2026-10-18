# Plan 1-02: Auth, Role & Password-Change Middlewares

**Phase:** Phase 1 — Authentication and Users  
**Plan ID:** `1-02`  
**Wave:** 2 (Middlewares)  
**Dependencies:** Plan `1-01`  
**Responsible Developer:** `dev1`  

---

## 1. Objective

Build Express middlewares for JWT bearer authentication, role-based access authorization, and mandatory password change gatekeeping.

---

## 2. Tasks & Detailed Instructions

### Task 1: Express Request User Typing (`backend/src/types/express.d.ts`)
- Extend Express `Request` interface to declare `user?: AuthenticatedUser`:
  ```ts
  export interface AuthenticatedUser {
    userId: string;
    username: string;
    role: UserRole;
    phone: string;
    mustChangePassword: boolean;
  }
  ```

### Task 2: Authentication Middleware (`backend/src/middleware/authenticate.ts`)
- Extracts token from `Authorization: Bearer <token>` header.
- If missing or malformed, throws `AppError(ERROR_CODES.AUTH_REQUIRED, 401, 'Authentication token is required')`.
- Calls `verifyAccessToken(token)`.
- Queries PostgreSQL database pool for active user record:
  ```sql
  SELECT id, username, role, phone, is_active, must_change_password
  FROM users
  WHERE id = $1;
  ```
- If user does not exist: throws `AppError(ERROR_CODES.AUTH_TOKEN_INVALID, 401, 'User account no longer exists')`.
- If `!user.is_active`: throws `AppError(ERROR_CODES.AUTH_ACCOUNT_INACTIVE, 403, 'Your account has been deactivated. Please contact support.')`.
- Attaches `req.user = { userId: user.id, username: user.username, role: user.role, phone: user.phone, mustChangePassword: user.must_change_password }`.
- Sets request logger context actor via `runWithContext` / `setActor`.

### Task 3: Authorization Middleware (`backend/src/middleware/authorize.ts`)
- Export `authorize(...allowedRoles: UserRole[])`:
  - Returns middleware `(req, res, next)`.
  - Asserts `req.user` is defined (fails with 401 if missing).
  - Checks if `allowedRoles.includes(req.user.role)`.
  - If unauthorized, throws `ForbiddenError(ERROR_CODES.FORBIDDEN, 403, 'You do not have permission to access this resource')`.
  - Calls `next()`.

### Task 4: Mandatory Password Change Middleware (`backend/src/middleware/require-password-changed.ts`)
- Export `requirePasswordChanged(req, res, next)`:
  - If `req.user?.mustChangePassword === true`:
    - Checks `req.baseUrl + req.path` or path prefix:
      - Allowed paths:
        - `POST /api/v1/auth/change-password`
        - `POST /api/v1/auth/logout`
        - `GET /api/v1/auth/me`
    - If path is not in the allowed list:
      Throws `AppError({ code: ERROR_CODES.AUTH_PASSWORD_CHANGE_REQUIRED, httpStatus: 403, message: 'You must change your password before continuing' })`.
  - Calls `next()`.

### Task 5: Middleware Unit & Integration Tests
- Create `backend/src/middleware/__tests__/auth-middlewares.test.ts`:
  - `authenticate`:
    - Rejects request without `Authorization` header with 401 `AUTH_REQUIRED`.
    - Rejects expired or tampered token with 401.
    - Rejects deactivated user with 403 `AUTH_ACCOUNT_INACTIVE`.
    - Populates `req.user` and calls `next()` for valid token and active user.
  - `authorize`:
    - Allows user with permitted role.
    - Throws 403 `FORBIDDEN` for mismatched role.
  - `requirePasswordChanged`:
    - Allows all requests if `mustChangePassword === false`.
    - Allows `/auth/change-password`, `/auth/logout`, `/auth/me` when `mustChangePassword === true`.
    - Throws 403 `AUTH_PASSWORD_CHANGE_REQUIRED` on other routes when `mustChangePassword === true`.

---

## 3. Verification & Acceptance Criteria ("Done When")

- [x] `authenticate` correctly verifies JWT and validates `is_active` in DB.
- [x] `authorize` reliably enforces role boundaries (`ADMIN`, `RETAILER`, `DELIVERY`).
- [x] `requirePasswordChanged` restricts users until password change is completed.
- [x] All middleware tests pass (`npm test --workspace=backend`).
