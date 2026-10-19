# Plan 3-05: Frontend Medicine Management & Reusable Search Component

**Phase:** Phase 3 — Medicines and Salts Master  
**Plan ID:** `3-05`  
**Wave:** 5 (Frontend Medicine Management)  
**Dependencies:** Plan 3-03, Plan 3-04  
**Responsible Developer:** `dev2`  

---

## 1. Objective

Build the frontend Medicine Master user interface: TanStack Query feature hooks, Admin `/medicines` directory page, creation and edit workflows (`/medicines/new`, `/medicines/:id/edit`), standard GST quick-presets with custom override, a hybrid `SaltChipSelector` featuring an inline "+ Add New Salt" modal shortcut, and a reusable `MedicineSearch` component for downstream operations.

---

## 2. Tasks & Detailed Instructions

### Task 1: Medicine Feature Layer (`frontend/src/features/medicines/`)
- Implement:
  - `types.ts`:
    - `MedicineRecord`: `{ medicineId: number; name: string; company: string; packSize: string; gstRate: string; saltIds: number[]; saltsText: string; salts: Array<{ saltId: number; saltName: string }>; isActive: boolean; onHand?: number; activeBatchCount?: number; createdAt: string; updatedAt: string; }`
    - `CreateMedicinePayload`: `{ name: string; company: string; packSize?: string; gstRate: number; saltIds: number[]; }`
    - `UpdateMedicinePayload`: `{ name?: string; company?: string; packSize?: string; gstRate?: number; saltIds?: number[]; isActive?: boolean; }`
    - `ListMedicinesParams`: `{ q?: string; saltId?: number; company?: string; isActive?: boolean; page?: number; pageSize?: number; sort?: string; }`
  - `schema.ts`:
    - Zod schemas matching backend constraints.
  - `api.ts`:
    - `fetchMedicines(params)`: Calls `GET /api/v1/medicines`.
    - `fetchMedicineById(id)`: Calls `GET /api/v1/medicines/${id}`.
    - `searchMedicines(q)`: Calls `GET /api/v1/medicines/search?q=${encodeURIComponent(q)}`.
    - `createMedicine(payload)`: Calls `POST /api/v1/medicines`.
    - `updateMedicine(id, payload)`: Calls `PATCH /api/v1/medicines/${id}`.
  - `hooks.ts`:
    - `useMedicines(params)`: Query hook.
    - `useMedicine(id)`: Query hook for single medicine with stock aggregates.
    - `useSearchMedicines(q)`: Debounced search query hook.
    - `useCreateMedicine()`: Mutation hook invalidating `medicines` query cache.
    - `useUpdateMedicine()`: Mutation hook invalidating `medicines` and single medicine caches.

### Task 2: Hybrid Salt Chip Selector (`frontend/src/features/medicines/components/SaltChipSelector.tsx`)
- Hybrid interaction pattern:
  - Displays selected salts as removable chip tags with `x` icons.
  - Below chips, provides a searchable combobox populated with active salts from `useSalts({ isActive: true })`.
  - When typing, filters the predefined salts list.
  - Inline "+ Add New Salt" Shortcut:
    - If a needed salt does not exist or user clicks "+ Add New Salt" button:
    - Opens a lightweight inline modal dialog without leaving the medicine form.
    - Uses `AddSaltModal` logic (with near-match detection).
    - Upon creation of the new salt, automatically appends it to the medicine form's selected chips and closes the modal.
  - Enforces 0–10 salt limit with clean visual counter (`3 / 10 salts selected`).

### Task 3: Medicine Form & GST Presets (`frontend/src/features/medicines/components/MedicineForm.tsx`)
- Form inputs:
  - Brand/Medicine Name (text input).
  - Company/Manufacturer (text input).
  - Packaging Size (e.g. `10 Tablets`, `100ml Syrup`, `1 Vial`).
  - GST Rate Selector:
    - Quick-toggle pill buttons for standard GST slabs: `0%`, `5%`, `12%`, `18%`, `28%`.
    - Custom rate input allowing any numeric value between `0.00` and `40.00%`.
  - Embeds `SaltChipSelector`.
- Error Handling:
  - Maps 409 `DUPLICATE_RESOURCE` to form error banner.
  - Maps 422 `PRICE_EXCEEDS_MRP` to error banner explaining that existing batch selling prices prevent increasing GST rate.

### Task 4: Reusable `MedicineSearch` (`frontend/src/features/medicines/components/MedicineSearch.tsx`)
- Props: `{ onSelect: (medicine: MedicineRecord) => void; placeholder?: string; autoFocus?: boolean; }`
- Search bar with magnifying glass icon and clear button.
- Debounced (250ms) call to `useSearchMedicines(q)`.
- Dropdown results list:
  - Highlights matched query text.
  - Shows Medicine Name, Company, Pack Size badge, and `saltsText`.
  - Keyboard accessible (Up/Down arrow navigation and Enter to select).
- Ready for immediate use in Phase 4 (Stock Inward scanning/manual entry), Phase 6 (Order Placement), and Phase 7 (Order Picking).

### Task 5: Admin Medicine Pages (`frontend/src/app/(admin)/medicines/`)
- `page.tsx`:
  - Header: Title "Medicines Catalog", "+ Add Medicine" button.
  - Filter bar: Search input, Salt filter dropdown, Company filter input, Status toggle, and Sort dropdown.
  - Responsive table displaying Name, Company, Pack Size, Salts chips, GST Rate, Status badge, and Actions (Edit link).
  - Pagination controls.
- `new/page.tsx`:
  - Clean page containing `MedicineForm` initialized for creation.
  - On submit success, redirects to `/medicines` with success toast.
- `[medicineId]/edit/page.tsx`:
  - Fetches existing medicine data and stock aggregates (`onHand` and `activeBatchCount`).
  - Displays stock badge (e.g. `140 units on hand across 3 active batches`).
  - Allows editing details, GST rate, active status, and salts.

### Task 6: Frontend Tests (`frontend/src/features/medicines/__tests__/medicines.test.tsx`)
- Vitest tests:
  - Renders `MedicineTable` with multi-salt chips.
  - `MedicineForm` toggles GST rate presets and custom input.
  - `SaltChipSelector` selects existing salts, prevents adding >10 salts, and integrates "+ Add New Salt" modal.
  - `MedicineSearch` triggers search API and triggers `onSelect` callback.

---

## 3. Verification & Acceptance Criteria
- [ ] Admin can browse, filter, and paginate medicines on `/medicines`.
- [ ] Admin can create multi-salt medicines on `/medicines/new` with GST presets.
- [ ] Inline "+ Add New Salt" adds new salts into the form without losing input values.
- [ ] Reusable `MedicineSearch` component searches both medicine brand names and salt texts.
- [ ] Frontend tests pass cleanly in `frontend/src/features/medicines/__tests__/medicines.test.tsx`.
