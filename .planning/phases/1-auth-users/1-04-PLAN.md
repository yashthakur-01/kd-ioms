# Plan 1-04: User Administration Module (CRUD, Deactivation & Password Reset)

**Phase:** Phase 1 — Authentication and Users  
**Plan ID:** `1-04`  
**Wave:** 4 (User Admin API)  
**Dependencies:** Plan `1-01`, Plan `1-02`, Plan `1-03`  
**Responsible Developer:** `dev1`  

---

## 1. Objective

Build the administrative user management module allowing Admins to create retailer and delivery partner accounts with temporary credentials, list/filter users, toggle active status (with session revocation), and reset credentials.

---

## 2. Tasks & Detailed Instructions

### Task 1: User Validation Schemas (`backend/src/modules/user/user.validation.ts`)
- `createUserSchema`:
  - `body`: strict object with:
    - `username`: `z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,50}$/, 'Username must be 3-50 alphanumeric characters (._- allowed)')`
    - `role`: `z.enum([USER_ROLE.RETAILER, USER_ROLE.DELIVERY], { message: 'Admins can only create RETAILER or DELIVERY users' })`
    - `phone`: `z.string().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian mobile number')`
    - `temporaryPassword`: `z.string().min(10).max(128).optional()`
- `listUsersSchema`:
  - `query`: `paginationQuery.extend({ role: z.enum(USER_ROLE.values).optional(), isActive: z.enum(['true', 'false']).transform(v => v === 'true').optional(), q: z.string().trim().max(100).optional(), sort: z.string().optional() }).strict()`
- `getUserSchema`:
  - `params`: `z.object({ userId: uuidParam }).strict()`
- `updateUserSchema`:
  - `params`: `z.object({ userId: uuidParam }).strict()`
  - `body`: strict object with:
    - `phone`: `z.string().regex(/^[6-9]\d{9}$/).optional()`
    - `isActive`: `z.boolean().optional()`
  - `.refine(data => data.phone !== undefined || data.isActive !== undefined, { message: 'At least one field (phone or isActive) must be provided' })`
- `resetPasswordSchema`:
  - `params`: `z.object({ userId: uuidParam }).strict()`

### Task 2: User Service (`backend/src/modules/user/user.service.ts`)
- Implement:
  1. `createUser({ username, role, phone, temporaryPassword }, actorId)`:
     - Check duplicate username (unique index handles this via `db-error-map.ts -> DUPLICATE_RESOURCE`).
     - Temporary password resolution: `temporaryPassword || generateTemporaryPassword()`.
     - Hash password using `hashPassword()`.
     - In transaction:
       - Insert into `users`:
         ```sql
         INSERT INTO users (username, password_hash, role, phone, is_active, must_change_password)
         VALUES ($1, $2, $3, $4, true, true)
         RETURNING id, username, role, phone, is_active, must_change_password, created_at, updated_at;
         ```
     - Return `{ user: toCamel(insertedUser), temporaryPassword: rawTemporaryPassword }`.
  2. `listUsers(query)`:
     - Parse pagination: `page`, `pageSize`, `offset`.
     - Parse search filter `q`: matches `username ILIKE $` or `phone ILIKE $`.
     - Parse filters: `role = $`, `is_active = $`.
     - Parse sorting with whitelist: `createdAt:desc`, `username:asc`, `role:asc`.
     - Run count query + paginated select query.
     - Return `{ rows: toCamelList(rows), totalItems }`.
  3. `getUserById(userId)`:
     - Query: `SELECT id, username, role, phone, is_active, must_change_password, created_at, updated_at FROM users WHERE id = $1`.
     - If not found, throw `NotFoundError(ERROR_CODES.NOT_FOUND, 'User not found')`.
     - Return `toCamel(row)`.
  4. `updateUser(userId, { phone, isActive }, actor)`:
     - Load existing user. If not found, throw `NotFoundError`.
     - Self-deactivation check:
       If `isActive === false && userId === actor.userId`:
       Throw `ForbiddenError(ERROR_CODES.FORBIDDEN, 'Admins cannot deactivate their own account')`.
     - Update fields:
       `UPDATE users SET phone = COALESCE($1, phone), is_active = COALESCE($2, is_active), updated_at = NOW() WHERE id = $3 RETURNING id, username, role, phone, is_active, must_change_password, updated_at`.
     - Session revocation check:
       If `isActive === false`:
       Revoke all active sessions for this user in `auth_sessions`:
       `UPDATE auth_sessions SET is_revoked = true, updated_at = NOW() WHERE user_id = $1`.
     - Return `toCamel(updatedUser)`.
  5. `resetPassword(userId, actor)`:
     - Load user. If not found, throw `NotFoundError`.
     - Generate memorable passphrase (`generateTemporaryPassword()`).
     - Hash passphrase.
     - In transaction:
       - Update user:
         ```sql
         UPDATE users
         SET password_hash = $1, must_change_password = true, failed_login_count = 0, locked_until = NULL, updated_at = NOW()
         WHERE id = $2;
         ```
       - Revoke all sessions:
         ```sql
         UPDATE auth_sessions
         SET is_revoked = true, updated_at = NOW()
         WHERE user_id = $1;
         ```
     - Return `{ temporaryPassword: rawPassphrase }`.

### Task 3: User Controller (`backend/src/modules/user/user.controller.ts`)
- `createUser`: calls `userService.createUser(req.valid.body, req.user.userId)`, returns `created(res, { code: SUCCESS_CODES.USER_CREATED, message: 'User created successfully', data: { user, temporaryPassword } })`.
- `listUsers`: calls `userService.listUsers(req.valid.query)`, returns `okList(res, { code: SUCCESS_CODES.USERS_LISTED, message: 'Users retrieved', data: rows, page, pageSize, totalItems })`.
- `getUserById`: calls `userService.getUserById(req.valid.params.userId)`, returns `ok(res, { code: SUCCESS_CODES.USER_FETCHED, message: 'User details', data: user })`.
- `updateUser`: calls `userService.updateUser(req.valid.params.userId, req.valid.body, req.user)`, returns `ok(res, { code: SUCCESS_CODES.USER_UPDATED, message: 'User updated successfully', data: user })`.
- `resetPassword`: calls `userService.resetPassword(req.valid.params.userId, req.user)`, returns `ok(res, { code: SUCCESS_CODES.PASSWORD_RESET, message: 'Password reset successfully', data: { temporaryPassword } })`.

### Task 4: User Routes (`backend/src/modules/user/user.route.ts`)
- Define endpoints:
  - Protect all routes with `authenticate`, `authorize(USER_ROLE.ADMIN)`, `requirePasswordChanged`.
  - `POST /`: `validate(createUserSchema)`, `asyncHandler(controller.createUser)`.
  - `GET /`: `validate(listUsersSchema)`, `asyncHandler(controller.listUsers)`.
  - `GET /:userId`: `validate(getUserSchema)`, `asyncHandler(controller.getUserById)`.
  - `PATCH /:userId`: `validate(updateUserSchema)`, `asyncHandler(controller.updateUser)`.
  - `POST /:userId/reset-password`: `validate(resetPasswordSchema)`, `asyncHandler(controller.resetPassword)`.
- Mount router under `/api/v1/users` in `backend/src/routes/index.ts`.

### Task 5: Integration Tests (`backend/src/modules/user/__tests__/user.integration.test.ts`)
- Automated integration tests:
  - Admin can create a retailer user with generated temporary password.
  - Attempting to create an admin via `POST /users` fails validation (only RETAILER and DELIVERY allowed).
  - Non-admin calling `POST /users` or `GET /users` receives 403 `FORBIDDEN`.
  - Admin listing users filters by role, active status, search keyword, and pagination.
  - Updating user phone succeeds.
  - Admin cannot deactivate own account (`FORBIDDEN`).
  - Deactivating a user revokes all active sessions for that user.
  - Resetting password returns temporary password and sets `must_change_password = true`.

---

## 3. Verification & Acceptance Criteria ("Done When")

- [x] All user admin routes enforce admin-only authorization.
- [x] Temporary passwords format conforms to memorable passphrase standard.
- [x] Self-deactivation is blocked with 403 `FORBIDDEN`.
- [x] Deactivation and password reset immediately revoke active user sessions.
- [x] Integration tests pass 100% (`npm test --workspace=backend`).
