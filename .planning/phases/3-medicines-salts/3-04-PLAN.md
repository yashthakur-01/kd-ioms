# Plan 3-04: Frontend Salt Master Management (`/salts`, Modals & Collision Alerts)

**Phase:** Phase 3 — Medicines and Salts Master  
**Plan ID:** `3-04`  
**Wave:** 4 (Frontend Salt Management)  
**Dependencies:** Plan 3-02  
**Responsible Developer:** `dev2`  

---

## 1. Objective

Build the frontend Salt Master user interface: TanStack Query feature hooks, Admin `/salts` directory page, responsive `SaltTable`, `AddSaltModal` with live typeahead near-match warning ("Did you mean Paracetamol?") and confirm override checkbox, `EditSaltModal` with `SALT_IN_USE` handling, and component tests.

---

## 2. Tasks & Detailed Instructions

### Task 1: Salt Feature Layer (`frontend/src/features/salts/`)
- Implement:
  - `types.ts`:
    - `SaltRecord`: `{ saltId: number; saltName: string; isActive: boolean; medicineCount: number; createdAt: string; updatedAt: string; }`
    - `SaltSuggestion`: `{ saltId: number; saltName: string; similarity: number; isActive: boolean; }`
    - `CreateSaltPayload`: `{ saltName: string; confirmSimilar?: boolean; }`
    - `UpdateSaltPayload`: `{ saltName?: string; isActive?: boolean; }`
    - `ListSaltsParams`: `{ q?: string; isActive?: boolean; page?: number; pageSize?: number; sort?: string; }`
  - `schema.ts`:
    - Zod schemas for `createSaltSchema` and `updateSaltSchema`.
  - `api.ts`:
    - `fetchSalts(params)`: Calls `GET /api/v1/salts`.
    - `fetchSaltSuggestions(q)`: Calls `GET /api/v1/salts/suggest?q=${encodeURIComponent(q)}`.
    - `createSalt(payload)`: Calls `POST /api/v1/salts`.
    - `updateSalt(saltId, payload)`: Calls `PATCH /api/v1/salts/${saltId}`.
  - `hooks.ts`:
    - `useSalts(params)`: Query hook with `salts` query key.
    - `useSaltSuggestions(q)`: Query hook debounced with 250ms delay, enabled when `q.length >= 2`.
    - `useCreateSalt()`: Mutation hook invalidating `salts` cache on success.
    - `useUpdateSalt()`: Mutation hook invalidating `salts` and `medicines` caches on success.

### Task 2: Modals & Interactive Components (`frontend/src/features/salts/components/`)
- `SaltTable.tsx`:
  - Columns: Salt Name, Active Status (emerald/slate Badge), Linked Active Medicines count badge, Created Date, Actions (Edit button).
  - Empty state when no salts match search filters.
- `AddSaltModal.tsx`:
  - Controlled input for `saltName`.
  - Live query to `useSaltSuggestions(saltName)`.
  - Collision Detection Banner:
    - If suggestions exist with similarity > 0.4:
      - Renders an amber alert banner: `"Similar salts found in catalog:"` followed by clickable badges of near matches.
      - Renders checkbox: `[ ] Confirm this is a distinct new salt`.
      - Submit button remains disabled or warns until either no high collisions exist OR the confirm checkbox is checked (`confirmSimilar: true`).
    - Catches 409 `SALT_SIMILAR_EXISTS` and `DUPLICATE_RESOURCE` with inline `ErrorBanner`.
- `EditSaltModal.tsx`:
  - Form to update name and toggle active status.
  - Catches 409 `SALT_IN_USE` and displays a descriptive banner: `"Cannot deactivate this salt because it is linked to active medicines. Remove or reassign it from those medicines first."`

### Task 3: Admin Salts Directory Page (`frontend/src/app/(admin)/salts/page.tsx`)
- App Router page wrapped in Admin layout.
- Header: Title "Salts Master", subtitle "Manage standardized pharmaceutical salts and formulas", and primary button "+ Add Salt".
- Controls row:
  - Search input with clear button and 300ms debounce.
  - Status filter tabs: `All`, `Active`, `Inactive`.
- Renders `SaltTable` with loading skeleton/spinner and error display.
- Pagination controls using existing `Pagination` primitive.
- Manages state for `AddSaltModal` and `EditSaltModal`.

### Task 4: Frontend Tests (`frontend/src/features/salts/__tests__/salts.test.tsx`)
- Vitest + Testing Library tests:
  - Renders `SaltTable` with mock salts data.
  - Opens `AddSaltModal`; typing triggers suggestion query.
  - Warning banner appears when suggestions exist; checking confirm box enables submission.
  - Submitting form executes mutation with payload `{ saltName: '...', confirmSimilar: true }`.
  - Deactivating in-use salt displays the `SALT_IN_USE` error message.

---

## 3. Verification & Acceptance Criteria
- [ ] Admin can view, paginate, and search the salts table at `/salts`.
- [ ] Live typeahead highlights near matches and enforces confirm flag to prevent duplicate entries.
- [ ] Deactivation errors are surfaced with actionable feedback.
- [ ] Frontend unit tests pass in `frontend/src/features/salts/__tests__/salts.test.tsx`.
