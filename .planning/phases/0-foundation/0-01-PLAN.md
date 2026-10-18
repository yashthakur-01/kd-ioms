# Plan 0-01: Shared Workspace, Tooling & Root Orchestration

**Phase:** Phase 0 — Foundation  
**Plan ID:** `0-01`  
**Wave:** 1 (Foundation Setup)  
**Dependencies:** None  
**Responsible Developer:** **Shared Foundation (Lead: `dev1`)**  

---

## 1. Objective

Configure the root monorepo workspace, orchestration scripts, shared backend enums, frontend enum synchronization tooling, and GitHub Actions CI pipeline.

---

## 2. Tasks & Detailed Instructions

### Task 1: Root Monorepo Configuration
- Create `package.json` at repository root `d:\coding\Projects\kd-ioms\package.json` configuring npm workspaces for `backend` and `frontend`.
- Add dependencies for development orchestration: `concurrently` (as devDependency).
- Define root scripts:
  - `"dev"`: Runs `concurrently "npm run dev --workspace=backend" "npm run dev --workspace=frontend"`.
  - `"dev:backend"`: `npm run dev --workspace=backend`.
  - `"dev:frontend"`: `npm run dev --workspace=frontend`.
  - `"build"`: `npm run build --workspace=backend && npm run build --workspace=frontend`.
  - `"test"`: `npm run test --workspace=backend && npm run test --workspace=frontend`.
  - `"lint"`: `npm run lint --workspace=backend && npm run lint --workspace=frontend`.
  - `"db:migrate"`: `npm run db:migrate --workspace=backend`.
  - `"sync-enums"`: `npm run sync-enums --workspace=frontend`.

### Task 2: Backend Shared Enums (`backend/src/enums/`)
Author each domain enum in TypeScript as a frozen object plus a values array (as mandated in `tech.md` Section 2.5 & 3.1):
- `user-role.enum.ts`: `USER_ROLE = { ADMIN: 'ADMIN', RETAILER: 'RETAILER', DELIVERY: 'DELIVERY' } as const`.
- `approval-status.enum.ts`: `APPROVAL_STATUS = { PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED' } as const`.
- `order-status.enum.ts`: `ORDER_STATUS = { PLACED: 'PLACED', APPROVED: 'APPROVED', REJECTED: 'REJECTED', OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY', DELIVERED: 'DELIVERED', CANCELLED: 'CANCELLED' } as const`.
- `fulfilment-status.enum.ts`: `FULFILMENT_STATUS = { FULL: 'FULL', PARTIAL: 'PARTIAL', NONE: 'NONE' } as const`.
- `delivery-item-status.enum.ts`: `DELIVERY_ITEM_STATUS = { PENDING: 'PENDING', ACCEPTED: 'ACCEPTED', REFUSED: 'REFUSED' } as const`.
- `batch-status.enum.ts`: `BATCH_STATUS = { ACTIVE: 'ACTIVE', BLOCKED: 'BLOCKED' } as const`.
- `ledger-entry-type.enum.ts`: `LEDGER_ENTRY_TYPE = { INWARD: 'INWARD', RESTOCK: 'RESTOCK', RETURN_IN: 'RETURN_IN', OUTWARD: 'OUTWARD', EXPIRY_WRITEOFF: 'EXPIRY_WRITEOFF', DAMAGE: 'DAMAGE', CORRECTION: 'CORRECTION' } as const`.
- `capture-method.enum.ts`: `CAPTURE_METHOD = { SCAN_BARCODE: 'SCAN_BARCODE', SCAN_OCR: 'SCAN_OCR', MANUAL: 'MANUAL' } as const`.
- `notification-channel.enum.ts`: `NOTIFICATION_CHANNEL = { WHATSAPP: 'WHATSAPP', EMAIL: 'EMAIL' } as const`.
- `notification-status.enum.ts`: `NOTIFICATION_STATUS = { PENDING: 'PENDING', SENT: 'SENT', FAILED: 'FAILED' } as const`.
- `gst-slab.enum.ts`: `GST_SLAB = [0, 5, 12, 18, 28] as const`.
- `index.ts`: Re-export all enums and helper `enum<T>()` types.

### Task 3: Enum Synchronization Tooling (`frontend/scripts/sync-enums.ts`)
- Create `frontend/scripts/sync-enums.ts` (or `.js` runnable via `tsx` or `node`).
- Reads `backend/src/enums/` and generates mirror TypeScript definitions in `frontend/src/lib/enums/`.
- Includes `--check` mode: compares existing files in `frontend/src/lib/enums/` against backend definitions and exits with code 1 if drift is detected.
- Wire into `frontend/package.json` as `"sync-enums"` and `"sync-enums:check"`.

### Task 4: GitHub Actions CI Pipeline (`.github/workflows/ci.yml`)
- Define `.github/workflows/ci.yml` triggering on pushes to `main`, `dev1`, `dev2`, `dev3` and all Pull Requests.
- Steps:
  1. Checkout code.
  2. Setup Node.js (v20+).
  3. Install dependencies (`npm ci`).
  4. Run enum sync drift check (`npm run sync-enums --workspace=frontend -- --check`).
  5. Run TypeScript typecheck (`tsc --noEmit` in backend and frontend).
  6. Run linting (`npm run lint`).
  7. Run automated test suites (`npm run test`).

---

## 3. Verification & Acceptance Criteria

- [x] Running `npm run sync-enums` cleanly populates `frontend/src/lib/enums/` from backend enums.
- [x] Running `npm run sync-enums:check` succeeds with code 0 on matched enums and fails with code 1 if an enum is modified only on one side.
- [x] Root `npm run test` executes tests in both workspaces.
- [x] CI workflow YAML passes linting and syntax validation.
