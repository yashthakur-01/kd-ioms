# Plan 1-01: Security Primitives, Crypto, Tokens & Admin Seeder

**Phase:** Phase 1 — Authentication and Users  
**Plan ID:** `1-01`  
**Wave:** 1 (Security Foundation)  
**Dependencies:** Phase 0  
**Responsible Developer:** `dev1`  

---

## 1. Objective

Build the cryptographic utilities, JWT access token and refresh token management helpers, password complexity validation, memorable temporary password generation, and the standalone admin seeding script.

---

## 2. Tasks & Detailed Instructions

### Task 1: Dependencies Installation
- Add `bcryptjs` and devDependency `@types/bcryptjs` to `backend/package.json`.
- Run `npm install` to update `package-lock.json`.

### Task 2: Environment Configuration Update (`backend/src/config/env.ts`)
- Update Zod schema to include:
  - `ADMIN_USERNAME`: `z.string().default('admin')`
  - `ADMIN_PASSWORD`: `z.string().min(10).default('Admin@KD2026!')`
  - `REFRESH_TOKEN_PEPPER`: `z.string().default('kd-ioms-refresh-pepper-2026')`

### Task 3: Cryptographic Utilities (`backend/src/utils/crypto.ts`)
- Implement:
  - `hashPassword(password: string): Promise<string>`:
    Uses `bcryptjs.hash(password, 12)`.
  - `verifyPassword(password: string, hash: string): Promise<boolean>`:
    Uses `bcryptjs.compare(password, hash)`.
  - `verifyDummyPassword(password: string): Promise<boolean>`:
    Executes `bcryptjs.compare` against a precomputed reference hash (`$2a$12$e8r3i7Hh7J...`) to ensure uniform response latency when non-existent usernames are queried.
  - `generateTemporaryPassword(): string`:
    Generates a memorable passphrase in the format `Word-Word-Digits` (e.g., `Kandarp-Drug-9281`), choosing from a curated pharmacy-friendly word list and appending a 4-digit number. Satisfies length (10+ chars), letter, and digit criteria.
  - `newRefreshToken(): string`:
    Returns `crypto.randomBytes(32).toString('hex')` (256-bit cryptographically secure random string).
  - `hashRefreshToken(token: string): string`:
    Returns SHA-256 hash of `token + ':' + env.REFRESH_TOKEN_PEPPER`.

### Task 4: Token Helpers (`backend/src/utils/tokens.ts`)
- Implement:
  - `interface AccessTokenPayload`:
    `{ sub: string; username: string; role: UserRole; mustChangePassword: boolean; phone: string; }`
  - `signAccessToken(payload: AccessTokenPayload): string`:
    Signs JWT with `env.JWT_ACCESS_SECRET`, `expiresIn: '15m'`.
  - `verifyAccessToken(token: string): AccessTokenPayload`:
    Verifies JWT with `env.JWT_ACCESS_SECRET`. Catches `TokenExpiredError` and throws `AppError(ERROR_CODES.AUTH_TOKEN_EXPIRED, 401)`; catches `JsonWebTokenError` and throws `AppError(ERROR_CODES.AUTH_TOKEN_INVALID, 401)`.
  - `getRefreshCookieOptions(): CookieOptions`:
    Returns `{ httpOnly: true, secure: env.COOKIE_SECURE, sameSite: 'lax', path: '/api/v1/auth', maxAge: 7 * 24 * 60 * 60 * 1000 }`.

### Task 5: Admin Seeder (`backend/src/scripts/seed-admin.ts`)
- Standalone CLI script:
  - Checks if an `ADMIN` user already exists: `SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1`.
  - If exists, logs info `"Admin user already exists. Skipping seed."` and exits.
  - If missing:
    - Hashes `env.ADMIN_PASSWORD` using `hashPassword()`.
    - Inserts user:
      ```sql
      INSERT INTO users (username, password_hash, role, phone, is_active, must_change_password)
      VALUES ($1, $2, 'ADMIN', '9999999999', true, false)
      RETURNING id, username, role;
      ```
    - Logs success `"Admin user seeded successfully: username='admin'"`.
- Add script entry to `backend/package.json`: `"seed:admin": "tsx src/scripts/seed-admin.ts"`.
- Add script entry to root `package.json`: `"seed:admin": "npm run seed:admin --workspace=backend"`.

### Task 6: Unit Tests
- Create `backend/src/utils/__tests__/crypto.test.ts`:
  - `hashPassword` produces valid bcrypt hash and round-trips with `verifyPassword`.
  - `verifyPassword` returns false for mismatched password.
  - `verifyDummyPassword` executes without errors.
  - `generateTemporaryPassword` satisfies password complexity rules (10–128 chars, letters, and digits).
  - `newRefreshToken` returns 64-char hex string; `hashRefreshToken` produces consistent SHA-256 digest.
- Create `backend/src/utils/__tests__/tokens.test.ts`:
  - `signAccessToken` produces valid JWT decoded by `verifyAccessToken`.
  - `verifyAccessToken` throws `AUTH_TOKEN_EXPIRED` on expired token.
  - `verifyAccessToken` throws `AUTH_TOKEN_INVALID` on tampered token.
  - `getRefreshCookieOptions` returns expected cookie flags (`httpOnly: true`, `path: '/api/v1/auth'`).

---

## 3. Verification & Acceptance Criteria ("Done When")

- [x] `npm run seed:admin` runs cleanly and is idempotent (safe to run multiple times).
- [x] Password hashes use bcrypt with 12 salt rounds.
- [x] Dummy password verify prevents timing attacks.
- [x] Temporary password generator creates compliant memorable passphrases.
- [x] All crypto and token unit tests pass (`npm test --workspace=backend`).
