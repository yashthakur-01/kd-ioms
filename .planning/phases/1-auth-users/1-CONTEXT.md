# Phase 1 Context: Authentication and Users

**Phase:** Phase 1 — Authentication and Users  
**Responsible Developer:** `dev1`  
**Status:** Context Gathered & Locked (Ready for `/gsd-plan-phase 1`)  
**Primary Source:** [`tech.md`](file:///d:/coding/Projects/kd-ioms/tech.md) Section 6 & [`REQUIREMENTS.md`](file:///d:/coding/Projects/kd-ioms/.planning/REQUIREMENTS.md) Section 2 (Phase 1)  

---

## 1. Phase Objective & Boundary

Establish secure user identity, credential lifecycle, role-based authorization, and user management for KD-IOMS:
- Authentication API for signing in, token refresh rotation, and logout.
- Account lockout protections (5 consecutive failed attempts lock account for 15 minutes) and timing-attack resistant password verification.
- Mandatory password change workflow on initial login and after administrative credential reset.
- Token architecture: 15-minute in-memory JWT access tokens and 7-day HttpOnly secure rotating refresh tokens tracked in `auth_sessions`.
- User administration APIs for Admin (`POST /users`, `GET /users`, `GET /users/:userId`, `PATCH /users/:userId`, `POST /users/:userId/reset-password`).
- Initial Admin user seeding script (`npm run seed:admin`).
- Frontend authentication flow in Next.js: `AuthProvider`, silent token refresh, `/login` screen, `/change-password` screen, Admin user directory, and user creation form with single-view temporary password display.

---

## 2. Locked Implementation Decisions

### 2.1 Cryptography & Credentials
- **Password Hashing:** `bcrypt` (10–12 salt rounds) via `backend/src/utils/crypto.ts`.
- **Timing Attack Defense:** A dummy `bcrypt.compare` executes against a precomputed reference hash whenever a requested username does not exist, ensuring uniform response latency.
- **Temporary Password Format:** Memorable passphrase format (e.g. `Kandarp-Drug-9281`) meeting password complexity rules (10–128 characters, contains at least one letter and at least one digit).
- **Password Policy:** Minimum 10 characters, maximum 128 characters; requires at least one letter and one digit. Enforced via Zod and DB constraints.
- **Refresh Token Generation:** Cryptographically secure 256-bit random hex strings (`crypto.randomBytes(32).toString('hex')`). Only the SHA-256 hash of the refresh token is stored in the `auth_sessions.token_hash` column.

### 2.2 Token Lifecycle & Session Management
- **Access Token:**
  - Standard JWT signed with `JWT_ACCESS_SECRET`.
  - Expiry: 15 minutes (900 seconds).
  - Payload: `{ sub: user.user_id, username: user.username, role: user.role, mustChangePassword: user.must_change_password }`.
  - Client storage: In-memory only in `frontend/src/lib/api/client.ts` (never in `localStorage` or `sessionStorage`).
- **Refresh Token & Cookie:**
  - Lifetime: 7 days (`auth_sessions.expires_at`).
  - Cookie attributes: `HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=604800`.
  - Rotation: Each call to `POST /auth/refresh` revokes the incoming session row and atomically issues a new refresh token and cookie.
  - Replay Attack Mitigation: If a revoked or already-used refresh token is presented, all sessions belonging to that user are immediately revoked, and an `AUTH_REFRESH_INVALID` (401) error is returned.
- **Password Change Invalidation:**
  - Upon successful `POST /auth/change-password`, all other active sessions for the user are revoked.
  - The current session receives a newly rotated token and remains active so the user transitions immediately into their authorized portal without re-logging in.
- **User Deactivation / Reset:**
  - Admin deactivating a user (`PATCH /users/:userId` with `isActive: false`) or resetting a password (`POST /users/:userId/reset-password`) revokes all active sessions in `auth_sessions`.

### 2.3 User Administration & Seeding
- **Admin Seeding:**
  - Standalone script `backend/src/scripts/seed-admin.ts` (executable via `npm run seed:admin --workspace=backend`).
  - Reads `ADMIN_USERNAME` and `ADMIN_PASSWORD` from validated environment variables.
  - If no admin exists in `users`, inserts the initial `ADMIN` account with `is_active = true` and `must_change_password = false`.
- **User Creation:**
  - Admins can create `RETAILER` or `DELIVERY` users via `POST /users`. Admins cannot create other `ADMIN` accounts via API.
  - Admin may supply a custom initial password or leave it blank to auto-generate a memorable passphrase.
  - Newly created users have `must_change_password = true`.
  - When creating a `RETAILER`, the service atomically initializes a corresponding placeholder record in `retailer_profiles` (`approval_status = 'PENDING'`).
  - The temporary password is returned in the API response `data.temporaryPassword` and shown in the UI exactly once with a copy button.

### 2.4 Middleware & Authorization Pipeline
- **`authenticate`:**
  - Reads `Authorization: Bearer <token>`.
  - Verifies JWT validity and signature.
  - Loads the user row from `users`; if `is_active = false`, throws `AUTH_ACCOUNT_INACTIVE` (403).
  - Attaches `req.user = { userId, username, role, mustChangePassword }` to `req`.
- **`authorize(...roles)`:**
  - Validates `req.user.role` is included in the allowed roles list. If not, throws `ForbiddenError` (`FORBIDDEN` 403).
- **`requirePasswordChanged`:**
  - Intercepts requests where `req.user.mustChangePassword === true`.
  - If the target route is not `/api/v1/auth/change-password`, `/api/v1/auth/logout`, or `/api/v1/auth/me`, throws `AUTH_PASSWORD_CHANGE_REQUIRED` (403).

### 2.5 Frontend Architecture & Navigation Shells
- **Silent Refresh & Bootstrapping:**
  - On application mount, `AuthProvider` calls `POST /api/v1/auth/refresh`.
  - If valid cookie exists, in-memory token is populated, and `/api/v1/auth/me` is fetched to set user context.
  - If no cookie or 401, user state is set to `null` and unauthenticated visitor is redirected to `/login`.
- **Navigation & Route Guards:**
  - `(auth)/login`: Clean, accessible login form with error alerts showing `Ref: <requestId>`.
  - `(auth)/change-password`: Compulsory form for users with `mustChangePassword === true`.
  - `(admin)/users`: User directory with table layout, search input, role filter, status toggle, and reset password modal.
  - `(admin)/users/new`: Creation form with immediate temporary password modal/copy box.
  - Role Layouts:
    - `(admin)`: Redirects non-admin users to their assigned home.
    - `(retailer)`: Redirects non-retailer users.
    - `(delivery)`: Redirects non-delivery users.

---

## 3. API Contract Specifications

### 3.1 Authentication Routes (`/api/v1/auth`)

| Method | Endpoint | Access | Input (Body / Cookie) | Response Envelope Data |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | Public (Rate Limited) | `{ username: string, password: string }` | `{ accessToken, expiresIn: 900, user: { id, username, role, mustChangePassword } }` + Set-Cookie `refreshToken` |
| `POST` | `/auth/refresh` | Cookie (`refreshToken`) | None (HttpOnly cookie) | `{ accessToken, expiresIn: 900 }` + Set-Cookie rotated `refreshToken` |
| `POST` | `/auth/logout` | Authenticated / Cookie | None | `null` + Clear-Cookie `refreshToken` |
| `POST` | `/auth/change-password` | Authenticated | `{ currentPassword: string, newPassword: string }` | `{ message: "Password updated successfully" }` + Set-Cookie rotated `refreshToken` |
| `GET` | `/auth/me` | Authenticated | None | `{ id, username, role, phone, mustChangePassword }` |

### 3.2 User Administration Routes (`/api/v1/users`)

| Method | Endpoint | Access | Input (Body / Query / Params) | Response Envelope Data |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/users` | Admin | `{ username: string, role: 'RETAILER' \| 'DELIVERY', phone: string, temporaryPassword?: string }` | `{ user: UserRecord, temporaryPassword: string }` |
| `GET` | `/users` | Admin | `?role=&isActive=&q=&page=1&pageSize=20&sort=createdAt:desc` | Array of `UserRecord` + `meta.pagination` |
| `GET` | `/users/:userId` | Admin | `params: { userId: UUID }` | `UserRecord` |
| `PATCH` | `/users/:userId` | Admin | `params: { userId: UUID }`, `{ phone?: string, isActive?: boolean }` | `UserRecord` |
| `POST` | `/users/:userId/reset-password` | Admin | `params: { userId: UUID }` | `{ temporaryPassword: string }` |

---

## 4. Acceptance Criteria & Test Plan

### 4.1 Unit Tests
- `crypto.test.ts`: Password hashing, timing-safe verification, memorable passphrase generation, token hashing.
- `tokens.test.ts`: Access token JWT signing and verification, payload structure, expiration.
- `auth.validation.test.ts`: Username character restrictions, password policy checks, phone regex validation.

### 4.2 Integration Tests
- **Account Lockout:** 5 consecutive invalid login attempts for an account triggers lockout with code `AUTH_ACCOUNT_LOCKED`; subsequent attempts (even with correct password) are rejected until 15 minutes expire.
- **Timing Attack Resilience:** Unknown username returns `AUTH_INVALID_CREDENTIALS` within similar latency as known username with bad password.
- **Token Rotation & Replay:** Calling `/auth/refresh` rotates token; attempting to replay the old token revokes the entire session set.
- **Compulsory Password Change:** User with `must_change_password = true` receives 403 `AUTH_PASSWORD_CHANGE_REQUIRED` on any protected endpoint except `/auth/change-password`, `/auth/logout`, and `/auth/me`.
- **Admin User Lifecycle:**
  - Admin creates retailer -> receives temporary password -> retailer profile row is created.
  - Retailer signs in -> forced to change password -> updates password -> transitions to active status.
  - Admin deactivates retailer -> subsequent API calls with old JWT or refresh token fail.
  - Self-deactivation: Admin attempting to set `isActive: false` on own account receives 403 `FORBIDDEN`.
