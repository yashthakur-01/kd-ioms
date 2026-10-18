# Phase 2: Retailer Onboarding - Context

**Gathered:** 2026-10-18  
**Status:** Ready for planning  
**Responsible Developer:** `dev3`  

<domain>
## Phase Boundary

Retailers submit a business KYC profile (shop name, address, GSTIN, drug license, contact details). The admin reviews submitted profiles and either approves or rejects them with rationale. Gated catalog browsing and order placement remain blocked with 403 `RETAILER_NOT_APPROVED` until an admin explicitly approves the retailer.

### In Scope:
- **Backend Endpoints:**
  - `GET /retailers/me`: Retailer gets own profile and current `approvalStatus` (`PENDING`, `APPROVED`, `REJECTED`, or `null` if unsubmitted).
  - `PUT /retailers/me`: Retailer creates or resubmits profile; validates GSTIN and Drug License Number; resets status to `PENDING` and clears previous rejection reason. Rejects edits if currently `APPROVED`.
  - `GET /retailers`: Admin lists retailer applications with filters (`approvalStatus`, query search `q`), pagination, and sorting.
  - `GET /retailers/:userId`: Admin fetches detailed retailer profile including user metadata (phone, username).
  - `POST /retailers/:userId/approve`: Admin approves application; records `reviewedBy` and `reviewedAt`.
  - `POST /retailers/:userId/reject`: Admin rejects application with mandatory 5–300 character rationale.
- **Middleware:**
  - `requireApprovedRetailer`: Enforces `approval_status === 'APPROVED'` on protected routes; returns 403 `RETAILER_NOT_APPROVED` otherwise.
- **Frontend Pages & Features:**
  - Retailer profile page (`/profile`): KYC submission form, read-only summary card, status banners (Amber for Pending, Emerald for Approved, Red for Rejected with reason), manual "Check Status" button, and locked navigation handling.
  - Admin retailer management (`/admin/retailers` and `/admin/retailers/[userId]`): Tabbed queue by status, search, pagination, confirmation modal on approve, preset chips + custom textarea on reject.
  - Reactive state synchronization: Instant nav unlock and celebratory toast without full page reload.

### Out of Scope:
- Order placement and checkout (Phase 6).
- Public / Retailer catalog pricing and availability calculations (Phase 5).
- OCR or automated scanning of physical drug license documents (Phase 4 / future).
- External GSTIN / Drug Authority government portal API verification.
</domain>

<decisions>
## Implementation Decisions

### 1. Onboarding Navigation & Catalog Gating
- **D-01 (Strict Redirect & Locked Navigation):** Unapproved retailers (unsubmitted, `PENDING`, or `REJECTED`) are redirected directly to `/profile`. Navigation items (`BottomNav` links: Catalog, Cart, Orders) are disabled and display a lock badge until status is `APPROVED`.
- **D-02 (Profile Form Presentation):** When status is `PENDING` or `APPROVED`, the profile details are presented in a clean read-only inspector/summary card (not raw disabled inputs) with a prominent color-coded status banner and quick-copy buttons for GSTIN and Drug License Number.
- **D-03 (403 Gated Route Interception):** When an unapproved retailer navigates to a gated route or triggers an API response with 403 `RETAILER_NOT_APPROVED`, `apiFetch` / React Query displays an informative toast ("Verification required: Please complete KYC profile") and redirects to `/profile`.
- **D-04 (Approval Celebration UX):** Upon approval, the `/profile` screen replaces the pending alert with an emerald "Account Verified" banner featuring a primary CTA button "Browse Catalog & Order". Lock icons are removed and navigation items unlock immediately.

### 2. Profile Resubmission & Lock Policy
- **D-05 (Rejection Presentation & Resubmission):** When `REJECTED`, display a persistent red "Application Needs Attention" card detailing the admin's exact rejection remarks. Directly below it, render a pre-filled editable form with a primary "Resubmit for Review" button.
- **D-06 (Approved Profile Lock):** Once `APPROVED`, direct edits are refused (returning 409 `INVALID_STATE_TRANSITION`). The UI renders an informational lock card instructing the retailer to contact Kandarp Drugs admin/support (phone & email) for any verified business detail amendments.
- **D-07 (Duplicate Conflict UI):** When profile submission fails with 409 `DUPLICATE_RESOURCE` targeting GSTIN or Drug License Number, attach field-level error messages directly to the offending input: "Already registered with another account. Contact admin if you believe this is an error."
- **D-08 (Instant Transition on Submit):** Submitting or resubmitting via `PUT /retailers/me` immediately flips the UI to the read-only summary card with the amber "Under Verification" banner and triggers a success toast ("KYC details submitted for review").

### 3. Admin Review Workflow & Rejection Presets
- **D-09 (Tabbed Queue Layout):** `/admin/retailers` features top tabs: "Pending Review (N)", "Approved", "Rejected", and "All", with live badge counts, search by shop name/license/phone, and pagination.
- **D-10 (Rejection Presets & Live Counter):** The rejection modal provides quick-select chip presets ("Invalid Drug License format", "GSTIN and shop name mismatch", "Incomplete address details") that populate a 5–300 character textarea with a live character counter, allowing admin customization before submitting `POST /retailers/:userId/reject`.
- **D-11 (Approval Confirmation):** Clicking "Approve" opens a `ConfirmDialog` displaying a summary of Shop Name, Drug License, and GSTIN to prevent accidental approvals before executing `POST /retailers/:userId/approve`.
- **D-12 (Dedicated Detail Page):** `/admin/retailers/[userId]` serves as a dedicated review page displaying complete KYC fields, user account details, audit timestamps (`reviewedBy`, `reviewedAt`), and sticky Approve / Reject actions.

### 4. Live Verification State Synchronization
- **D-13 (Window Focus Refetching):** React Query checks `GET /retailers/me` upon window and tab refocus without an active background interval timer, conserving battery and bandwidth.
- **D-14 (Manual Check Status Button):** The amber `PENDING` banner on `/profile` includes an on-demand "Check Verification Status" button with an icon spinner, enabling retailers to verify status instantly without reloading the browser.
- **D-15 (Dedicated useRetailerProfile Hook):** Encapsulate profile and verification state in a dedicated React Query hook (`useRetailerProfile`) with query key `['retailers', 'me']`. `RetailerLayout` and `BottomNav` subscribe directly to reactively unlock navigation across the app.
- **D-16 (Celebratory Toast Notification):** When the query detects a status transition from `PENDING` to `APPROVED`, trigger a celebratory toast: "🎉 Your KYC is approved! Catalog access is now unlocked."
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture and API Specifications
- `tech.md` §7 — Phase 2: Retailer Onboarding (endpoints, validation rules, DTOs, workflow)
- `tech.md` §2.1 & 2.2 — Standard response envelope, error codes (`RETAILER_NOT_APPROVED`, `DUPLICATE_RESOURCE`, `INVALID_STATE_TRANSITION`), and HTTP status mappings
- `tech.md` §4.1 — Component primitives and frontend architecture

### Requirements and State
- `.planning/REQUIREMENTS.md` §Phase 2 — FR-RET-01 through FR-RET-07
- `.planning/ROADMAP.md` §Phase 2 — Retailer Onboarding deliverables and acceptance criteria
- `.planning/STATE.md` §Key Architecture Decisions Log — ADR-001 through ADR-012

### Database Schema
- `backend/migrations/001_init.sql` L114–L132 — `retailer_profiles` table definition and `approval_status` enum type
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Backend Validation Constants:** `REGEX.GSTIN`, `REGEX.DRUG_LICENSE`, `REGEX.PINCODE_INDIAN`, `REGEX.PHONE_E164` in `backend/src/constants/regex.ts`.
- **Backend Middleware & Utils:** `authenticate`, `authorize`, `validate`, `AppError` hierarchy, `asyncHandler`, `src/utils/response.ts` (`ok`, `created`, `okList`, `fail`), and `src/utils/pagination.ts`.
- **Backend Enums:** `ApprovalStatus` (`PENDING`, `APPROVED`, `REJECTED`) in `backend/src/enums/approval-status.enum.ts` and `UserRole` in `backend/src/enums/user-role.enum.ts`.
- **Frontend UI Components:** `Button`, `Input`, `Select`, `Modal`, `Table`, `Badge`, `Spinner`, `EmptyState`, `Pagination`, `ConfirmDialog`, `FormField`, `FieldError`, `ErrorBanner` in `frontend/src/components/ui/` and `feedback/`.
- **Frontend Layouts:** `BottomNav` in `frontend/src/components/layout/BottomNav.tsx`, `RetailerLayout` in `frontend/src/app/(retailer)/layout.tsx`, and `AdminLayout` in `frontend/src/app/(admin)/layout.tsx`.
- **Frontend Client:** `apiFetch` in `frontend/src/lib/api/client.ts` with error envelope mapping and `AuthProvider` in `frontend/src/providers/AuthProvider.tsx`.

### Established Patterns
- Express Router -> Controller -> Service -> DB layer isolation with raw SQL queries.
- Next.js App Router with React Hook Form + Zod validation.
- TanStack Query for server state management with invalidation triggers.
- Error code mapping into user-friendly UI banners and toast notifications.

### Integration Points
- `backend/src/routes/index.ts`: Register `/retailers` route module.
- `backend/src/middleware/require-approved-retailer.ts`: Inject into future Phase 5 & 6 catalog and order routes.
- `frontend/src/app/(retailer)/profile/page.tsx`: Retailer onboarding and KYC inspection screen.
- `frontend/src/app/(retailer)/layout.tsx`: Gated navigation links based on `useRetailerProfile`.
- `frontend/src/app/(admin)/retailers/page.tsx`: Admin review queue dashboard.
- `frontend/src/app/(admin)/retailers/[userId]/page.tsx`: Admin application detail review page.
</code_context>

<specifics>
## Specific Ideas
- Indian pharmaceutical compliance mandates locking verified drug licenses and GSTIN to prevent unauthorized medicine dispensing.
- Verification exit criterion: A retailer moves from `PENDING` to `APPROVED` in the UI and gated features unlock without a full page reload.
</specifics>

<deferred>
## Deferred Ideas
- Automated GSTIN lookup via external Government/ClearTax API (deferred to future backlog).
- PDF / image upload for physical drug license certificates (deferred to attachment storage phase).
</deferred>

---

*Phase: 2-Retailer Onboarding*  
*Context gathered: 2026-10-18*  
