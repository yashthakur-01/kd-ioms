# Plan 1-03: Authentication Module (Sign-In, Refresh, Logout, Change-Password, Me)

**Phase:** Phase 1 — Authentication and Users  
**Plan ID:** `1-03`  
**Wave:** 3 (Core Auth API)  
**Dependencies:** Plan `1-01`, Plan `1-02`  
**Responsible Developer:** `dev1`  

---

## 1. Objective

Implement the complete Authentication API module according to the strict security constraints of `tech.md`: rate-limited login, account lockout after 5 failed attempts, constant-time dummy verify, rotating refresh tokens with replay attack mitigation, session revocation, and compulsory password change.

---

## 2. Tasks & Detailed Instructions

### Task 1: Auth Validation Schemas (`backend/src/modules/auth/auth.validation.ts`)
- `loginSchema`:
  - `body`: strict object with:
    - `username`: `z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,50}$/, 'Username must be 3-50 alphanumeric characters (._- allowed)')`
    - `password`: `z.string().min(1).max(128)`
- `changePasswordSchema`:
  - `body`: strict object with:
    - `currentPassword`: `z.string().min(1).max(128)`
    - `newPassword`: `z.string().min(10, 'Password must be at least 10 characters').max(128).regex(/[A-Za-z]/, 'Password must contain at least one letter').regex(/\d/, 'Password must contain at least one digit')`
  - `.refine((data) => data.currentPassword !== data.newPassword, { message: 'New password must be different from current password', path: ['newPassword'] })`

### Task 2: Auth Service (`backend/src/modules/auth/auth.service.ts`)
- Implement:
  1. `login({ username, password, ip, userAgent })`:
     - Load user: `SELECT id, username, password_hash, role, phone, is_active, must_change_password, failed_login_count, locked_until FROM users WHERE LOWER(username) = LOWER($1)`.
     - Check lockout: If user exists and `locked_until && new Date() < new Date(locked_until)`:
       Throw `AppError({ code: ERROR_CODES.AUTH_ACCOUNT_LOCKED, httpStatus: 403, message: 'Account is temporarily locked due to consecutive failed login attempts', details: { lockedUntil: user.locked_until } })`.
     - Non-existent user check: If user not found, execute `await verifyDummyPassword(password)` and throw `AppError({ code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, httpStatus: 401, message: 'Invalid username or password' })`.
     - Password check: `await verifyPassword(password, user.password_hash)`.
     - If password fails:
       - Increment failed attempts: `const newCount = user.failed_login_count + 1`.
       - If `newCount >= 5`: `locked_until = NOW() + INTERVAL '15 minutes'`.
       - Update DB: `UPDATE users SET failed_login_count = $1, locked_until = $2 WHERE id = $3`.
       - Throw `AppError({ code: ERROR_CODES.AUTH_INVALID_CREDENTIALS, httpStatus: 401, message: 'Invalid username or password' })`.
     - If password matches:
       - If `!user.is_active`: throw `AppError({ code: ERROR_CODES.AUTH_ACCOUNT_INACTIVE, httpStatus: 403, message: 'Account has been deactivated' })`.
       - Reset lockout: `UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = $1`.
       - Create session:
         - Generate raw refresh token (`newRefreshToken()`) and hash it (`hashRefreshToken()`).
         - Insert into `auth_sessions (user_id, refresh_token_hash, user_agent, ip_address, expires_at) VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')`.
       - Sign access token with user info (`sub`, `username`, `role`, `mustChangePassword`, `phone`).
       - Return `{ accessToken, refreshToken, expiresIn: 900, user: { id: user.id, username: user.username, role: user.role, phone: user.phone, mustChangePassword: user.must_change_password } }`.
  2. `refresh({ refreshToken, ip, userAgent })`:
     - If missing: throw `AppError({ code: ERROR_CODES.AUTH_REFRESH_INVALID, httpStatus: 401, message: 'Refresh token is required' })`.
     - Hash token: `const tokenHash = hashRefreshToken(refreshToken)`.
     - Find session: `SELECT id, user_id, is_revoked, expires_at FROM auth_sessions WHERE refresh_token_hash = $1`.
     - If not found or expired (`new Date() > new Date(session.expires_at)`):
       Throw `AppError({ code: ERROR_CODES.AUTH_REFRESH_INVALID, httpStatus: 401, message: 'Invalid or expired refresh token' })`.
     - Replay detection: If `session.is_revoked`:
       - **Revoke all sessions for this user immediately**: `UPDATE auth_sessions SET is_revoked = true WHERE user_id = $1`.
       - Log warning for security audit.
       - Throw `AppError({ code: ERROR_CODES.AUTH_REFRESH_INVALID, httpStatus: 401, message: 'Invalid refresh token session family' })`.
     - Check user active: `SELECT id, username, role, phone, is_active, must_change_password FROM users WHERE id = $1`.
     - If `!user.is_active`: throw `AUTH_ACCOUNT_INACTIVE`.
     - Rotate atomically in `withTransaction`:
       - Mark incoming session revoked: `UPDATE auth_sessions SET is_revoked = true, updated_at = NOW() WHERE id = $1`.
       - Generate new refresh token, hash it, insert new session record.
     - Sign new access token.
     - Return `{ accessToken, newRefreshToken, expiresIn: 900 }`.
  3. `logout({ refreshToken })`:
     - If `refreshToken`:
       - Hash token and update `auth_sessions SET is_revoked = true, updated_at = NOW() WHERE refresh_token_hash = $1`.
  4. `changePassword({ userId, currentPassword, newPassword, currentRefreshToken, ip, userAgent })`:
     - Load user: `SELECT id, password_hash FROM users WHERE id = $1`.
     - Verify current password. If invalid, throw `AppError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, 401, 'Current password is incorrect')`.
     - Hash new password.
     - Execute transaction:
       - Update user: `UPDATE users SET password_hash = $1, must_change_password = false, updated_at = NOW() WHERE id = $2`.
       - Revoke other sessions: If `currentRefreshToken` provided, keep its session family or rotate it; revoke all sessions with `user_id = $1 AND refresh_token_hash != $2`.
       - Rotate current session with new refresh token.
     - Sign new access token with `mustChangePassword: false`.
     - Return `{ accessToken, newRefreshToken, message: 'Password changed successfully' }`.
  5. `getMe(userId)`:
     - Query user: `SELECT id, username, role, phone, must_change_password FROM users WHERE id = $1`.
     - Return user details.

### Task 3: Auth Controller (`backend/src/modules/auth/auth.controller.ts`)
- Manages HTTP headers and cookies:
  - `login`: calls `authService.login`, sets HttpOnly cookie via `res.cookie('refreshToken', refreshToken, getRefreshCookieOptions())`, returns `ok(res, { code: SUCCESS_CODES.AUTH_LOGGED_IN, message: 'Signed in successfully', data: { accessToken, expiresIn, user } })`.
  - `refresh`: reads `req.cookies.refreshToken`, calls `authService.refresh`, sets rotated cookie, returns `ok(res, { code: SUCCESS_CODES.AUTH_REFRESHED, message: 'Token refreshed', data: { accessToken, expiresIn } })`.
  - `logout`: reads cookie, calls `authService.logout`, clears cookie via `res.clearCookie('refreshToken', getRefreshCookieOptions())`, returns `ok(res, { code: SUCCESS_CODES.AUTH_LOGGED_OUT, message: 'Signed out successfully', data: null })`.
  - `changePassword`: calls `authService.changePassword`, sets rotated cookie, returns `ok(res, { code: SUCCESS_CODES.AUTH_PASSWORD_CHANGED, message: 'Password changed successfully', data: { accessToken } })`.
  - `me`: calls `authService.getMe`, returns `ok(res, { code: SUCCESS_CODES.USER_FETCHED, message: 'Current user profile', data: user })`.

### Task 4: Auth Routes (`backend/src/modules/auth/auth.route.ts`)
- Define endpoints:
  - `POST /login`: `loginLimiter`, `validate(schema.loginSchema)`, `asyncHandler(controller.login)`.
  - `POST /refresh`: `asyncHandler(controller.refresh)`.
  - `POST /logout`: `asyncHandler(controller.logout)`.
  - `POST /change-password`: `authenticate`, `validate(schema.changePasswordSchema)`, `asyncHandler(controller.changePassword)`.
  - `GET /me`: `authenticate`, `asyncHandler(controller.me)`.
- Mount router under `/api/v1/auth` in `backend/src/routes/index.ts`.

### Task 5: Integration Tests (`backend/src/modules/auth/__tests__/auth.integration.test.ts`)
- Automated integration tests with Supertest:
  - Successful sign-in sets `refreshToken` cookie and returns standard success envelope.
  - Invalid credentials return 401 `AUTH_INVALID_CREDENTIALS`.
  - 5 consecutive invalid attempts lock account for 15 minutes (`AUTH_ACCOUNT_LOCKED`).
  - Constant timing defense: invalid username returns in similar time as invalid password.
  - Silent token refresh rotates token and cookie.
  - Replay of revoked refresh token revokes all user sessions.
  - Deactivated user cannot sign in or refresh.
  - Password change clears `mustChangePassword` and revokes other sessions.
  - `/auth/me` returns current user profile.

---

## 3. Verification & Acceptance Criteria ("Done When")

- [x] All auth endpoints return the standard response envelope.
- [x] Login rate limiting and account lockout enforce brute-force resistance.
- [x] Refresh token rotation and replay revocation prevent session hijacking.
- [x] Password change clears `must_change_password` and revokes competing sessions.
- [x] Integration tests pass 100% (`npm test --workspace=backend`).
