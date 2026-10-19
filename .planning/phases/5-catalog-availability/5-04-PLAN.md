# Plan 5-04: Frontend Client Cart Store & UI Design Primitives

**Phase:** Phase 5 — Catalog and Availability  
**Plan ID:** `5-04`  
**Wave:** 4 (Design Primitives & Cart Store)  
**Dependencies:** Plan 5-02  
**Responsible Developer:** `dev2`  

---

## 1. Objective

Build the frontend UI primitives and client-side cart state management foundation: the `PriceTag` component displaying price incl. GST with struck-through MRP, the user-scoped reactive `useCart` store backed by `localStorage` (`kd_cart_${userId}`), and the `FloatingCartBar` sticky summary component.

---

## 2. Tasks & Detailed Instructions

### Task 1: `PriceTag` Component (`frontend/src/components/ui/PriceTag.tsx`)
- Implement:
  ```typescript
  interface PriceTagProps {
    priceInclGst: string | number | null;
    mrp: string | number | null;
    gstRate?: string | number;
    inStock?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
  }
  ```
- Formatting & UX details:
  - If `!inStock` or `priceInclGst === null`: renders a stylish `Out of Stock` badge (`bg-slate-100 text-slate-600 border border-slate-300 font-medium px-2 py-0.5 rounded-md text-xs`).
  - If in stock:
    - Formats numbers in Indian Rupee format (`₹{val}`) with standard 2 decimal places.
    - Selling Price: bold dark text (e.g. `₹201.15`).
    - MRP: struck-through muted text (e.g. `<span className="line-through text-slate-400 text-xs">₹223.50</span>`).
    - Calculates savings percentage if MRP > Price: `[X% OFF]` badge in subtle emerald pill.
    - GST indicator: `(Incl. {gstRate}% GST)`.
- Export from `frontend/src/components/ui/PriceTag.tsx` and register in `frontend/src/components/ui/index.ts`.
- Component tests: `frontend/src/components/ui/__tests__/PriceTag.test.tsx`.

### Task 2: LocalStorage Cart State Management (`frontend/src/features/cart/`)
- Create `frontend/src/features/cart/cart.types.ts`:
  ```typescript
  export interface CartItem {
    medicineId: number;
    name: string;
    company: string;
    packSize: string;
    priceInclGst: string; // two-decimal string
    mrp: string;          // two-decimal string
    gstRate: string;
    quantity: number;
    maxAvailable: number; // live availableQty ceiling
  }

  export interface CartSummary {
    items: CartItem[];
    totalQuantity: number;
    subtotal: string; // two-decimal formatted INR string
  }
  ```
- Create `frontend/src/features/cart/useCart.ts`:
  - Hook reading authenticated user's ID from `useAuth` or session context.
  - Storage key: `kd_cart_${userId}` (ensures full multi-tenant isolation on shared devices).
  - Listens to window `storage` events for seamless multi-tab synchronization.
  - Operations:
    - `addItem(item: Omit<CartItem, 'quantity'>, quantity: number)`: Adds item or increments existing quantity up to `maxAvailable`.
    - `updateQuantity(medicineId: number, quantity: number)`: Clamps quantity to `[1, maxAvailable]`. Removes if quantity is 0.
    - `removeItem(medicineId: number)`: Removes item from cart.
    - `clearCart()`: Empties cart and clears `localStorage`.
    - `getItemQuantity(medicineId: number)`: Returns current quantity in cart (0 if not added).
  - Computes `totalQuantity` and `subtotal` (paise summation to avoid floating point drift).
- Unit tests: `frontend/src/features/cart/__tests__/useCart.test.ts`.

### Task 3: Floating Sticky Cart Bar (`frontend/src/features/catalog/components/FloatingCartBar.tsx`)
- Implement:
  - Sticky bottom floating pill/bar positioned above bottom navigation on mobile (`bottom-20 sm:bottom-6`), centered, with smooth slide-up animation (`transition-all duration-300`).
  - Render condition: Only visible when `totalQuantity > 0`.
  - Content:
    - Left: Shopping bag icon + item count badge (`{totalQuantity} {totalQuantity === 1 ? 'item' : 'items'}`).
    - Center: Total estimated order value (`₹{subtotal}`).
    - Right: Button `View Cart →` navigating to `/cart` (`variant="primary" size="sm"`).
- Component tests: `frontend/src/features/catalog/components/__tests__/FloatingCartBar.test.tsx`.

---

## 3. Verification & Acceptance Criteria
- [ ] `PriceTag` correctly handles null pricing, MRP strikeout, and savings badge.
- [ ] `useCart` persists cart per user ID and enforces `maxAvailable` constraints.
- [ ] Multi-tab cart synchronization behaves reliably via `storage` events.
- [ ] `FloatingCartBar` appears only when items exist in cart.
- [ ] Tests in `useCart.test.ts` and `PriceTag.test.tsx` pass cleanly.
