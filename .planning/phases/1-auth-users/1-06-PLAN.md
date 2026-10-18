# Plan 1-06: End-to-End Verification, Security Walkthrough & Exit Sign-Off

**Phase:** Phase 1 — Authentication and Users  
**Plan ID:** `1-06`  
**Wave:** 6 (Verification & Sign-Off)  
**Dependencies:** Plan `1-01`, Plan `1-02`, Plan `1-03`, Plan `1-04`, Plan `1-05`  
**Responsible Developer:** `dev1`  

---

## 1. Objective

Perform end-to-end multi-role verification of the authentication lifecycle, security policies, token rotation, account lockouts, compulsory password change flows, and administrative user operations before signing off on Phase 1.

---

## 2. Tasks & Detailed Instructions

### Task 1: Complete User Lifecycle Walkthrough
1. **Admin Seeding:**
   - Execute `npm run seed:admin`.
   - Verify `users` table contains seeded `ADMIN` account.
2. **Admin Authentication:**
   - Call `POST /api/v1/auth/login` with admin credentials.
   - Verify response has `accessToken`, `user.role === 'ADMIN'`, and Set-Cookie `refreshToken`.
3. **Retailer Account Creation:**
   - Call `POST /api/v1/users` as Admin to create a retailer user (`username: 'test_retailer'`, `phone: '9876543210'`).
   - Verify response contains `temporaryPassword` conforming to memorable passphrase format (`Word-Word-Digits`).
   - Verify user row has `must_change_password === true`.
4. **First-Time Login & Compulsory Password Change:**
   - Retailer calls `POST /api/v1/auth/login` with temporary password.
   - Verify response returns `user.mustChangePassword === true`.
   - Retailer calls `GET /api/v1/users` -> Assert 403 `AUTH_PASSWORD_CHANGE_REQUIRED`.
   - Retailer calls `POST /api/v1/auth/change-password` with new compliant password.
   - Verify password updates, `must_change_password` becomes `false`, and session remains active with rotated token.
5. **Administrative Password Reset:**
   - Admin calls `POST /api/v1/users/:userId/reset-password`.
   - Verify new temporary password returned.
   - Retailer's prior sessions in `auth_sessions` are revoked.
   - Retailer's subsequent call with old access token or refresh token is refused.
   - Retailer signs in with new temporary password and is again prompted to change password.

### Task 2: Security & Brute-Force Resilience Walkthrough
1. **Account Lockout:**
   - Perform 5 consecutive failed logins for a specific username with incorrect passwords.
   - On the 5th attempt, verify response code is `AUTH_ACCOUNT_LOCKED` (403) with `details.lockedUntil`.
   - Attempt a 6th login with the **correct** password -> Assert it is still refused with 403 `AUTH_ACCOUNT_LOCKED`.
2. **Timing-Attack Resilience:**
   - Measure response duration for login with non-existent username vs existing username with wrong password.
   - Assert timing is consistent (dummy password verification executes).
3. **Token Rotation & Replay Attack Defense:**
   - Perform `POST /api/v1/auth/refresh` -> receive rotated refresh token.
   - Attempt to replay the old (revoked) refresh token -> Assert 401 `AUTH_REFRESH_INVALID` and verify ALL sessions for that user are immediately revoked in `auth_sessions`.
4. **Self-Deactivation Guard:**
   - Admin calls `PATCH /api/v1/users/:adminId` with `isActive: false` -> Assert 403 `FORBIDDEN`.

### Task 3: Workspace Test & Build Verification
1. Run `npm test` across all workspaces:
   - Backend: crypto tests, token tests, middleware tests, auth integration tests, user integration tests.
   - Frontend: login screen tests, user management screen tests, API client tests.
   - Ensure 100% pass rate.
2. Run `npm run lint` across backend (`tsc --noEmit`) and frontend (`eslint`).
3. Run `npm run build` across backend (`tsc`) and frontend (`next build`).
4. Run `npm run sync-enums:check` to ensure 0 enum drift.

---

## 3. Verification & Acceptance Criteria ("Done When")

- [x] Complete user lifecycle passes end-to-end.
- [x] 5 failed login attempts trigger 15-minute account lockout.
- [x] Refresh token rotation and replay revocation function accurately.
- [x] Users with `must_change_password = true` cannot access non-auth endpoints.
- [x] Admin cannot deactivate own account.
- [x] Deactivating user or resetting password immediately revokes active sessions.
- [x] All tests pass cleanly (`npm test` - 60/60 tests green).
- [x] Production build succeeds without errors (`npm run build`).
- [x] Phase 1 sign-off recorded in `.planning/STATE.md` and `.planning/ROADMAP.md`.
