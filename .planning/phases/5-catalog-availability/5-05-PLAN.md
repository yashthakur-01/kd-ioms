# Plan 5-05: Retailer Catalog Interactive Screen & Search

**Phase:** Phase 5 — Catalog and Availability  
**Plan ID:** `5-05`  
**Wave:** 5 (Retailer Catalog Portal)  
**Dependencies:** Plan 5-02, Plan 5-04  
**Responsible Developer:** `dev2`  

---

## 1. Objective

Deliver the full-featured, interactive Retailer Catalog screen at `/catalog`, replacing the temporary placeholder with debounced hybrid search (300ms), "In-Stock Only" filtering (enabled by default), responsive sorting, medicine catalog cards with live quantity steppers, integrated cart interaction, and floating summary bar.

---

## 2. Tasks & Detailed Instructions

### Task 1: Catalog API Client & React Hook (`frontend/src/features/catalog/`)
- Create `frontend/src/features/catalog/catalog.api.ts`:
  - `fetchCatalog(params: CatalogQueryParams): Promise<CatalogResponse>`: Invokes `GET /api/v1/catalog`.
  - `fetchCatalogItem(medicineId: number): Promise<CatalogItem>`: Invokes `GET /api/v1/catalog/:medicineId`.
- Create `frontend/src/features/catalog/hooks/useCatalog.ts`:
  - Manages filter state: `q` (string), `debouncedQ` (300ms timer), `inStock` (boolean, default `true`), `saltId` (number | null), `sort` (`'name' | '-name' | 'price' | '-price'`), `page` (number, default 1).
  - Fetches data using `useQuery` or `useEffect` + abort controller.
  - Returns `{ medicines, pagination, isLoading, isError, filters, setFilter, resetFilters }`.

### Task 2: Catalog UI Components (`frontend/src/features/catalog/components/`)
- Create `CatalogSearchHeader.tsx`:
  - Search Input: Debounced text input with clear button (`X`), placeholder `"Search by brand name, company, or salt..."`.
  - Filter Bar:
    - Toggle button / checkbox: `"In-Stock Only"` (default checked, emerald active state).
    - Sort Selector dropdown: `"Name: A → Z"`, `"Name: Z → A"`, `"Price: Low → High"`, `"Price: High → Low"`.
    - Active filter chip row with "Clear all filters" action.
- Create `MedicineCatalogCard.tsx`:
  - Medicine Header: Name in bold slate-900, company in slate-500, pack size in subtle rounded badge.
  - Composition: `saltsText` displayed with clean pill tags or truncated description.
  - Price Section: `PriceTag` component (shows price incl. GST and struck-through MRP, or "Out of Stock").
  - Stock Indicator:
    - `availableQty > 10`: Emerald badge `"In Stock"`.
    - `1 <= availableQty <= 10`: Amber badge `"Only {availableQty} left"`.
    - `availableQty === 0`: Slate badge `"Out of Stock"`.
  - Action Controls:
    - If in stock:
      - Interactive quantity stepper: `[-] [quantity] [+]`, minimum 1, maximum `availableQty`.
      - "Add to Cart" button with cart icon. If item is already in cart, displays `"In Cart ({qty})"` and allows updating count directly from card.
    - If out of stock:
      - Stepper hidden / disabled.
      - "Out of Stock" disabled button.
- Create `MedicineCatalogGrid.tsx`:
  - Responsive layout: 1 column on mobile phones, 2 columns on tablets, 3 columns on large desktop screens.
  - Loading State: Skeleton cards mirroring the exact layout.
  - Empty State: Informative `EmptyState` component when no medicines match the search/filter criteria with a `"Reset Filters"` CTA.

### Task 3: Assemble `/catalog/page.tsx` (`frontend/src/app/(retailer)/catalog/page.tsx`)
- Replace the existing placeholder with the full interactive catalog:
  - Page header: `"Medicine Catalog"` with live total product count badge.
  - Mounts `CatalogSearchHeader`.
  - Mounts `MedicineCatalogGrid`.
  - Mounts `Pagination` controls at bottom.
  - Mounts `FloatingCartBar` sticky at the bottom for instant checkout awareness.

### Task 4: Component & Page Tests (`frontend/src/features/catalog/__tests__/CatalogPage.test.tsx`)
- Automated tests verifying:
  1. Default load shows only in-stock items (`inStock=true`).
  2. Toggling "In-Stock Only" off triggers re-fetch showing out-of-stock items.
  3. Search query debounces by 300ms before sending API request.
  4. Quantity stepper increments and decrements within `[1, availableQty]`.
  5. Stepper and Add to Cart button are disabled for zero-stock medicines.
  6. Adding item to cart updates local cart state and displays `FloatingCartBar`.

---

## 3. Verification & Acceptance Criteria
- [ ] `/catalog` renders medicine cards with responsive mobile/desktop layouts.
- [ ] Search debounce functions without flicker or redundant network calls.
- [ ] Steppers strictly enforce `availableQty` ceilings.
- [ ] Cart updates seamlessly sync to `FloatingCartBar`.
- [ ] All tests in `frontend/src/features/catalog/__tests__/CatalogPage.test.tsx` pass.
