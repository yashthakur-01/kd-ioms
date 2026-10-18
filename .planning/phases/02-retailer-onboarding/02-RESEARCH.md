# Phase 2: Retailer Onboarding - Research

**Phase:** Phase 2 — Retailer Onboarding  
**Status:** Completed  
**Author:** `dev3` Lead / GSD Phase Researcher  
**Date:** 2026-10-18  

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (Strict Redirect & Locked Navigation):** Unapproved retailers (unsubmitted, `PENDING`, or `REJECTED`) are strictly redirected to `/profile`. Navigation items (`BottomNav` links: Catalog, Cart, Orders) are disabled and display a lock badge until status is `APPROVED`.
- **D-02 (Clean Read-Only Inspector):** When status is `PENDING` or `APPROVED`, profile inputs are presented in a clean read-only summary card with a prominent color-coded status banner (Amber for `PENDING`, Emerald for `APPROVED`) and quick-copy buttons for GSTIN and Drug License Number.
- **D-03 (403 Gated Route Interception):** When an unapproved retailer navigates to a gated route or triggers an API response with 403 `RETAILER_NOT_APPROVED`, `apiFetch` / React Query displays an informative toast ("Verification required: Please complete KYC profile") and navigates to `/profile`.
- **D-04 (Approval Celebration UX):** Upon approval, `/profile` replaces the pending alert with an emerald "Account Verified" banner featuring a primary CTA button "Browse Catalog & Order". Lock icons are removed and navigation items unlock immediately.
- **D-05 (Rejection Presentation & Resubmission):** When `REJECTED`, display a persistent red "Application Needs Attention" card detailing the admin's exact rejection remarks. Directly below it, render a pre-filled editable form with a primary "Resubmit for Review" button.
- **D-06 (Approved Profile Lock):** Once `APPROVED`, direct edits are refused (returning 409 `INVALID_STATE_TRANSITION`). The UI renders an informational lock card instructing the retailer to contact Kandarp Drugs admin/support (phone & email) for any verified business detail amendments.
- **D-07 (Duplicate Conflict UI):** When profile submission fails with 409 `DUPLICATE_RESOURCE` targeting GSTIN or Drug License Number, attach field-level error messages directly to the offending input: "Already registered with another account. Contact admin if you believe this is an error."
- **D-08 (Instant Transition on Submit):** Submitting or resubmitting via `PUT /retailers/me` immediately flips the UI to the read-only summary card with the amber "Under Verification" banner and triggers a success toast ("KYC details submitted for review").
- **D-09 (Tabbed Queue Layout):** `/admin/retailers` features top tabs: "Pending Review (N)", "Approved", "Rejected", and "All", with live badge counts, search by shop name/license/phone, and pagination.
- **D-10 (Rejection Presets & Live Counter):** The rejection modal provides quick-select chip presets ("Invalid Drug License format", "GSTIN and shop name mismatch", "Incomplete address details") that populate a 5–300 character textarea with a live character counter, allowing admin customization before submitting `POST /retailers/:userId/reject`.
- **D-11 (Approval Confirmation):** Clicking "Approve" opens a `ConfirmDialog` displaying a summary of Shop Name, Drug License, and GSTIN to prevent accidental approvals before executing `POST /retailers/:userId/approve`.
- **D-12 (Dedicated Detail Page):** `/admin/retailers/[userId]` serves as a dedicated review page displaying complete KYC fields, user account details, audit timestamps (`reviewedBy`, `reviewedAt`), and sticky Approve / Reject actions.
- **D-13 (Window Focus Refetching):** React Query checks `GET /retailers/me` upon window and tab refocus without an active background interval timer.
- **D-14 (Manual Check Status Button):** The amber `PENDING` banner on `/profile` includes an on-demand "Check Verification Status" button with an icon spinner, enabling retailers to verify status instantly without reloading the browser.
- **D-15 (Dedicated useRetailerProfile Hook):** Encapsulate profile and verification state in a dedicated React Query hook (`useRetailerProfile`) with query key `['retailers', 'me']`. `RetailerLayout` and `BottomNav` subscribe directly to reactively unlock navigation across the app.
- **D-16 (Celebratory Toast Notification):** When the query detects a status transition from `PENDING` to `APPROVED`, trigger a celebratory toast: "🎉 Your KYC is approved! Catalog access is now unlocked."

### Antigravity's Discretion
- Standard responsive layout tokens and component compositions using existing Tailwind primitives (`Card`, `Badge`, `Button`, `FormField`, `Modal`, `Table`, `Pagination`, `ConfirmDialog`).
- SQL query parameterization and transaction isolation levels.
- Rejection presets list content.

### Deferred Ideas (OUT OF SCOPE)
- Automated GSTIN lookup via external Government/ClearTax API (future phase).
- PDF / image upload for physical drug license certificates (future attachment storage phase).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **FR-RET-01** | Retailer profile retrieval via `GET /retailers/me` | Handled by `retailer.controller.ts` & `retailer.service.ts` querying `retailer_profiles` by `req.user.userId`. Returns 200 with `{ profile, approvalStatus }` or `{ profile: null, approvalStatus: null }`. |
| **FR-RET-02** | Retailer profile submission / resubmission via `PUT /retailers/me` validating GSTIN and Drug License Number, transitioning status to `PENDING` | `retailer.validation.ts` schema + `retailerService.upsertMine` handling atomic insert/update, updating `approval_status = 'PENDING'`, and clearing `rejection_reason`. |
| **FR-RET-03** | Approved profiles are locked against direct edits | In `upsertMine`, if existing row has `approval_status === 'APPROVED'`, throws 409 `INVALID_STATE_TRANSITION`. |
| **FR-RET-04** | Admin retailer queue `GET /retailers` with filtering by `approvalStatus`, search query `q`, and pagination | Handled by `retailerService.listRetailers` using dynamic WHERE clauses, `COUNT(*) OVER()`, and `pagination.ts`. |
| **FR-RET-05** | Admin profile approval `POST /retailers/:userId/approve` granting catalog and order placement access | `retailerService.review` with decision `'APPROVE'`. Updates status to `'APPROVED'`, sets `reviewed_by` and `reviewed_at`. Guards against non-`PENDING` transitions. |
| **FR-RET-06** | Admin profile rejection `POST /retailers/:userId/reject` requiring 5–300 character rationale, reverting profile to `REJECTED` | `retailerService.review` with decision `'REJECT'` and `{ reason }`. Updates status to `'REJECTED'`, sets `rejection_reason`. Guards against non-`PENDING` transitions. |
| **FR-RET-07** | Middleware `requireApprovedRetailer` blocking unapproved retailers (`RETAILER_NOT_APPROVED` 403) from protected catalog and ordering routes | `middleware/require-approved-retailer.ts` queries `approval_status` for `RETAILER` callers; passes only when `approval_status === 'APPROVED'`. |
</phase_requirements>

---

## 1. Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|:---------:|---------|----------|
| Node.js | Runtime | ✓ | v24.21.0 | — |
| npm | Package Manager | ✓ | 12.0.2 | — |
| TypeScript | Type Safety | ✓ | 5.8+ | — |
| Vitest | Backend & Frontend Tests | ✓ | 3.2.7 | — |
| PostgreSQL / Supabase | Persistence Layer | ✓ | 15+ (`pg` Pool) | — |
| Next.js App Router | Frontend Framework | ✓ | 15.2.1 | — |
| Express.js | Backend Framework | ✓ | 4.21.2 | — |
| TanStack React Query | State Management | ✓ | 5.67.2 | — |

**Missing dependencies:** None. All workspaces and test suites are installed and passing.

---

## 2. Architecture & Domain Research

### 2.1 Database Schema Alignment
The PostgreSQL table `retailer_profiles` is already defined in migration `backend/migrations/001_init.sql` (L114–L132):
```sql
CREATE TABLE IF NOT EXISTS retailer_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_name VARCHAR(120) NOT NULL,
  address_line VARCHAR(250) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  pincode VARCHAR(6) NOT NULL,
  whatsapp_number VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  drug_license_number VARCHAR(50) UNIQUE NOT NULL,
  gstin VARCHAR(15) UNIQUE,
  approval_status approval_status NOT NULL DEFAULT 'PENDING',
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Key DB constraints:**
1. `user_id` is unique (`1:1` relationship with `users`).
2. `drug_license_number` has a unique constraint.
3. `gstin` has a unique constraint (nullable).
4. `approval_status` is an enum type (`PENDING`, `APPROVED`, `REJECTED`).

### 2.2 Backend Module Design (`backend/src/modules/retailer`)

Following the established user/auth module patterns:
1. `retailer.validation.ts`:
   - `upsertProfileSchema`:
     - `shopName`: string 2–120 chars, trimmed.
     - `addressLine`: string 5–250 chars, trimmed.
     - `city`: string 1–100 chars, trimmed.
     - `state`: string 1–100 chars, trimmed.
     - `pincode`: regex `REGEX.PINCODE_INDIAN` (`^\d{6}$`).
     - `whatsappNumber`: regex `REGEX.PHONE_E164` (`^\+[1-9]\d{7,14}$`).
     - `email`: optional valid email address or empty string.
     - `drugLicenseNumber`: string 5–50 chars, trimmed, uppercase.
     - `gstin`: optional 15-char uppercase regex `REGEX.GSTIN`.
   - `listRetailersSchema`:
     - `approvalStatus`: optional enum `ApprovalStatus` (`PENDING`, `APPROVED`, `REJECTED`).
     - `q`: optional search string (max 100 chars).
     - `page`: coerce number >= 1, default 1.
     - `pageSize`: coerce number 1–100, default 20.
   - `getRetailerSchema`:
     - `userId`: UUID.
   - `approveRetailerSchema`:
     - `userId`: UUID.
   - `rejectRetailerSchema`:
     - `userId`: UUID.
     - `reason`: string 5–300 chars, trimmed.

2. `retailer.service.ts`:
   - `getMine(userId: string)`: Returns retailer profile row (or null) + approvalStatus.
   - `upsertMine(userId: string, dto: UpsertProfileDto)`:
     - Uses `withTransaction` or row-level lock.
     - Checks if current status is `APPROVED`: if so, throws `ConflictError({ code: ERROR_CODES.INVALID_STATE_TRANSITION, message: 'Approved profiles cannot be edited directly' })`.
     - Executes `INSERT INTO retailer_profiles ... ON CONFLICT (user_id) DO UPDATE ...` resetting `approval_status = 'PENDING'`, `rejection_reason = NULL`, `updated_at = NOW()`.
     - Catches unique violation `23505` to pinpoint whether `drugLicenseNumber` or `gstin` caused the duplicate, throwing typed `ConflictError` with `field` identifier.
   - `listRetailers(query: ListRetailersQuery)`:
     - Joins `retailer_profiles` with `users` to provide username, phone, and review info.
     - Supports filter by `approval_status` and ILIKE search across `shop_name`, `drug_license_number`, `whatsapp_number`, `username`.
     - Returns `{ rows, totalItems }`.
   - `getRetailerById(userId: string)`:
     - Fetches retailer profile and linked user details (`phone`, `username`, `created_at`).
     - Throws `NotFoundError` if not found.
   - `reviewRetailer(adminId: string, userId: string, decision: 'APPROVE' | 'REJECT', reason?: string)`:
     - Runs in transaction. Checks current `approval_status`.
     - If not `PENDING`, throws `ConflictError({ code: ERROR_CODES.INVALID_STATE_TRANSITION, message: 'Only PENDING applications can be reviewed' })`.
     - If `APPROVE`: sets `approval_status = 'APPROVED'`, `rejection_reason = NULL`, `reviewed_by = adminId`, `reviewed_at = NOW()`.
     - If `REJECT`: sets `approval_status = 'REJECTED'`, `rejection_reason = reason`, `reviewed_by = adminId`, `reviewed_at = NOW()`.
     - Returns updated profile.

3. `retailer.controller.ts`:
   - Wraps service calls with `ok`, `created`, `okList` helpers using `SUCCESS_CODES` (`RETAILER_PROFILE_FETCHED`, `RETAILER_PROFILE_SUBMITTED`, `RETAILERS_LISTED`, `RETAILER_APPROVED`, `RETAILER_REJECTED`).

4. `retailer.route.ts`:
   - Retailer endpoints:
     - `GET /me` -> `authenticate`, `authorize(RETAILER)`, `requirePasswordChanged`
     - `PUT /me` -> `authenticate`, `authorize(RETAILER)`, `requirePasswordChanged`, `validate(upsertProfileSchema)`
   - Admin endpoints:
     - `GET /` -> `authenticate`, `authorize(ADMIN)`, `requirePasswordChanged`, `validate(listRetailersSchema)`
     - `GET /:userId` -> `authenticate`, `authorize(ADMIN)`, `requirePasswordChanged`, `validate(getRetailerSchema)`
     - `POST /:userId/approve` -> `authenticate`, `authorize(ADMIN)`, `requirePasswordChanged`, `validate(approveRetailerSchema)`
     - `POST /:userId/reject` -> `authenticate`, `authorize(ADMIN)`, `requirePasswordChanged`, `validate(rejectRetailerSchema)`

5. `backend/src/middleware/require-approved-retailer.ts`:
   - Reads `req.user`. If `req.user.role === USER_ROLE.RETAILER`:
     - Queries `SELECT approval_status FROM retailer_profiles WHERE user_id = $1`.
     - If row doesn't exist or `approval_status !== 'APPROVED'`: throws `ForbiddenError({ code: ERROR_CODES.RETAILER_NOT_APPROVED, message: 'Account KYC verification is pending admin approval' })`.
   - If user is not `RETAILER`, passes to `next()`.

### 2.3 Frontend Feature Design (`frontend/src/features/retailer`)

1. `api.ts`:
   - `fetchMyProfile()`: calls `GET /api/v1/retailers/me`.
   - `upsertMyProfile(dto)`: calls `PUT /api/v1/retailers/me`.
   - `fetchRetailers(params)`: calls `GET /api/v1/retailers`.
   - `fetchRetailerById(userId)`: calls `GET /api/v1/retailers/${userId}`.
   - `approveRetailer(userId)`: calls `POST /api/v1/retailers/${userId}/approve`.
   - `rejectRetailer(userId, reason)`: calls `POST /api/v1/retailers/${userId}/reject`.

2. `keys.ts`:
   - React Query keys:
     ```typescript
     export const retailerKeys = {
       all: ['retailers'] as const,
       me: () => [...retailerKeys.all, 'me'] as const,
       list: (params?: Record<string, any>) => [...retailerKeys.all, 'list', params] as const,
       detail: (userId: string) => [...retailerKeys.all, 'detail', userId] as const,
     };
     ```

3. `hooks.ts`:
   - `useRetailerProfile()`: reads `retailerKeys.me()`. Exposes `{ profile, approvalStatus, isApproved, isPending, isRejected, isUnsubmitted, isLoading, refetch }`.
   - `useUpsertProfile()`: invalidates `retailerKeys.me()`.
   - `useRetailers(params)`: query for admin queue.
   - `useRetailerDetail(userId)`: query for single retailer.
   - `useApproveRetailer()`: mutation with invalidation of list & detail.
   - `useRejectRetailer()`: mutation with invalidation of list & detail.

4. `schema.ts`:
   - Zod schemas matching backend validation rules, creating types `RetailerProfileFormData`, `RejectReasonFormData`.

### 2.4 Frontend Pages & UX Integration

1. `RetailerLayout` (`frontend/src/app/(retailer)/layout.tsx`):
   - Consumes `useRetailerProfile()`.
   - If not `isApproved`, disables `Catalog`, `Cart`, `Orders` in `BottomNav` with lock badges.
   - If path is not `/profile` and retailer is unapproved, automatically redirects to `/profile`.

2. Retailer Profile Page (`frontend/src/app/(retailer)/profile/page.tsx`):
   - State-driven presentation:
     - **Unsubmitted / Initial:** Form for shop name, address, city, state, pincode, WhatsApp number, email, drug license number, GSTIN with field-level validation and "Submit Profile for Verification" button.
     - **PENDING:** Clean read-only summary card with Amber alert banner: "Application Under Review. Our compliance team is verifying your drug license." Includes on-demand "Check Verification Status" button with icon spinner.
     - **REJECTED:** Persistent red callout: "Application Needs Attention" with exact admin remarks. Pre-populated editable form below with "Resubmit for Review" CTA.
     - **APPROVED:** Emerald "Account Verified" callout with primary "Browse Catalog & Order" button. Informational lock card explaining that verified details are locked and providing support contact info.

3. Admin Retailer Directory (`frontend/src/app/(admin)/retailers/page.tsx`):
   - Tabs: "Pending Review", "Approved", "Rejected", "All" with badge counts.
   - Search input, Table listing shop name, license, phone, status badge, applied date.
   - Quick "Review" action button leading to `/admin/retailers/[userId]`.

4. Admin Retailer Detail (`frontend/src/app/(admin)/retailers/[userId]/page.tsx`):
   - Full KYC inspection card with user account details, applied timestamp, and review audit details.
   - "Approve" button -> Opens `ConfirmDialog` summarizing Shop Name, Drug License, and GSTIN.
   - "Reject" button -> Opens `Modal` with quick preset chips ("Invalid Drug License format", "GSTIN and shop name mismatch", etc.) + 5–300 char textarea with character counter.

---

## 3. Pitfalls & Edge Cases

1. **Duplicate Key Conflict Targeting:**
   - When a 409 occurs from PostgreSQL constraint violation `retailer_profiles_drug_license_number_key` vs `retailer_profiles_gstin_key`, the service MUST detect which constraint failed and pass `errors: [{ field: 'drugLicenseNumber', ... }]` so the UI form attaches the error to the correct input.
2. **Race Conditions on Approval:**
   - If two admins view the same pending retailer and click approve/reject simultaneously, the second call must receive `INVALID_STATE_TRANSITION` (409) rather than overwriting or causing unexpected state drift. Handled via atomic SQL `UPDATE ... WHERE approval_status = 'PENDING'`.
3. **Reactive Unlock Without App Reload:**
   - React Query cache invalidation (`queryClient.invalidateQueries({ queryKey: retailerKeys.me() })`) must immediately flip `isApproved` to true in `RetailerLayout`, removing lock indicators from `BottomNav` without requiring a browser refresh.
4. **Phone Formatting:**
   - WhatsApp number requires E.164 (e.g. `+919876543210`). The form should provide a clean input with prefix helper or validation hint to prevent formatting confusion.

---

## 4. Validation Architecture (Nyquist Validation Plan)

### Automated Test Matrix
1. **Backend Unit & Integration Tests (`backend/src/modules/retailer/__tests__/`):**
   - `PUT /api/v1/retailers/me` (unsubmitted -> PENDING): 200, creates profile row with PENDING status.
   - `GET /api/v1/retailers/me`: 200, returns profile details + approvalStatus.
   - `PUT /api/v1/retailers/me` (duplicate license/GSTIN): 409 `DUPLICATE_RESOURCE` with target field.
   - `POST /api/v1/retailers/:userId/approve` (admin): 200, updates status to `APPROVED`, records `reviewedBy`.
   - `PUT /api/v1/retailers/me` (when APPROVED): 409 `INVALID_STATE_TRANSITION`, direct edit blocked.
   - `POST /api/v1/retailers/:userId/reject` (admin): 200, updates status to `REJECTED` with reason.
   - `POST /api/v1/retailers/:userId/reject` (missing/short reason): 400 `VALIDATION_ERROR`.
   - `PUT /api/v1/retailers/me` (resubmitting REJECTED): 200, resets status to `PENDING` and clears reason.
   - `requireApprovedRetailer` middleware test: 403 `RETAILER_NOT_APPROVED` when pending/rejected; 200 when approved.
   - Non-admin accessing `/api/v1/retailers`: 403 `FORBIDDEN`.

2. **Frontend Component & Integration Tests (`frontend/src/features/retailer/__tests__/`):**
   - Retailer profile page rendering in Unsubmitted, Pending, Rejected, and Approved states.
   - Rejection reason banner and pre-filled editable form on Rejected state.
   - Instant transition to read-only inspector upon submission.
   - Manual "Check Status" button triggering query refetch.
   - Admin retailers tabbed queue filtering by status.
   - Admin rejection modal preset chips populating textarea.
   - Admin approval `ConfirmDialog` flow.

---

## RESEARCH COMPLETE

**Phase:** 2 - Retailer Onboarding  
**Confidence:** HIGH  

### Key Findings
- Baseline database schema already has `retailer_profiles` table and `approval_status` enum.
- Reusable auth middleware, validation regexes, and standard error/success constants already exist.
- Frontend primitives (`Table`, `Modal`, `ConfirmDialog`, `FormField`, `BottomNav`) are ready for composition.
- Clear state machine: Unsubmitted -> PENDING <-> REJECTED -> APPROVED (locked).

### File Created
`.planning/phases/02-retailer-onboarding/02-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|:-----:|--------|
| Standard Stack | HIGH | Express TypeScript + Next.js App Router already established in Phase 0 & 1 |
| Architecture | HIGH | Service/Controller pattern and TanStack Query feature modules proven in codebase |
| Pitfalls | HIGH | State transition locks, duplicate field targeting, and focus refetching fully addressed |

### Ready for Planning
Research complete. Planner can now create PLAN.md files.
