# Phase 1 Context: Authentication and Users

*See full details at [`.planning/phases/1-auth-users/1-CONTEXT.md`](file:///d:/coding/Projects/kd-ioms/.planning/phases/1-auth-users/1-CONTEXT.md)*

**Phase:** Phase 1 — Authentication and Users  
**Responsible Developer:** `dev1`  
**Status:** Context Gathered & Locked (Ready for `/gsd-plan-phase 1`)  

### Key Decisions Locked:
1. **Password Hashing:** `bcrypt` (10–12 salt rounds) with dummy constant-time verification for non-existent users.
2. **Temporary Passwords:** Memorable passphrase format (e.g. `Kandarp-Drug-9281`) satisfying 10+ chars, letter, and digit requirements.
3. **Admin Seeding:** Standalone CLI script `npm run seed:admin` reading `ADMIN_USERNAME` and `ADMIN_PASSWORD` from `.env`.
4. **Session & Token Management:** 15-minute in-memory JWT access token; 7-day HttpOnly cookie refresh token with strict rotation and replay revocation.
5. **Password Change Workflow:** On password change, all other sessions are revoked while the current session receives rotated tokens and remains active.
6. **Compulsory Password Change:** Middleware `requirePasswordChanged` blocks non-auth endpoints when `must_change_password === true`.
