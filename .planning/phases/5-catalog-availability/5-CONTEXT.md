# Phase 5 Context: Catalog and Availability

**Phase:** Phase 5 — Catalog and Availability  
**Responsible Developer:** `dev2`  
**Status:** Context Gathered & Locked (Ready for `/gsd-plan-phase 5`)  
**Primary Source:** [`tech.md`](file:///home/yash/D/kd-ioms/tech.md) Section 10, Section 2.1, Section 2.9, Section 3.2, and [`ROADMAP.md`](file:///home/yash/D/kd-ioms/.planning/ROADMAP.md) Phase 5  

---

## 1. Phase Objective & Boundary

Establish the unified medicine catalog and real-time sellable inventory availability computation engine for approved retailers, delivery partners, and administrators:
1. **Database Views & Trigram Search Optimization (Migration `003_catalog_views.sql`):**
   - Update `v_medicine_availability` and `v_catalog` to project `salts_text`, `salt_ids`, and accurately calculate sellable on-hand inventory, PLACED reservations, net available quantity, and price ceilings.
   - Add performance indexes: compound index on `batches(medicine_id, status, expiry_date, quantity_on_hand)` and ensure PostgreSQL `pg_trgm` GIN indexes on `medicines(name, company, salts_text)` for sub-100ms full-text catalog search.
2. **Catalog API Endpoints (`backend/src/modules/catalog/`):**
   - `GET /api/v1/catalog`: Searchable, filterable, and paginated catalog for Approved Retailers, Delivery partners, and Admins (`?q&saltId&inStock&page&pageSize&sort`).
   - `GET /api/v1/catalog/:medicineId`: Single medicine catalog record with aggregated price and availability.
   - `GET /api/v1/alerts/out-of-stock`: Admin alert queue returning active medicines with zero available stock.
3. **Core Business & Information Security Invariants:**
   - Real-time availability computation on every read: `available_qty = GREATEST(0, sellable_qty - reserved_qty)`.
   - `sellable_qty`: Sum of `quantity_on_hand` for batches where `status = 'ACTIVE'`, `expiry_date >= today_ist()`, and `quantity_on_hand > 0`.
   - `reserved_qty`: Sum of `requested_quantity` across order items for orders currently in `PLACED` status.
   - Price Ceilings: `maxMrp` is the highest MRP, and `maxPriceInclGst` is the highest selling price × (1 + GST rate) among sellable batches with stock (`quantity_on_hand > 0`). When no sellable stock exists, both are `null` and `inStock` is `false`.
   - Strict Information Masking: Batch numbers, purchase rates, supplier details, individual batch quantities, and expiry dates are strictly hidden from catalog endpoints.
   - Strict Tenant/Role Gating: Unapproved retailers (`PENDING` or `REJECTED`) are blocked with 403 `RETAILER_NOT_APPROVED`. Delivery and Admin have unrestricted read access.
4. **Frontend Retailer Catalog & Admin Alerts UI:**
   - `/catalog`: Debounced hybrid search (300ms) matching brand name, company, and salts text; "In-Stock Only" toggle filter (enabled by default); responsive sorting; medicine cards with `PriceTag` component (selling price incl. GST + struck-through MRP); availability status; interactive quantity stepper clamped to `availableQty`; disabled state when out of stock.
   - Floating Sticky Cart Bar: Appears on `/catalog` when cart has items, displaying item count, subtotal incl. GST, and a "View Cart →" action button leading to `/cart`.
   - Client-side Cart Store: Scoped per authenticated user in `localStorage` (`kd_cart_${userId}`), maintaining clean state until cleared upon order completion.
   - `/admin/alerts`: Out-of-Stock alert tab listing zero-stock medicines with one-click navigation to inward stock receipt (`/stock/inward?medicineId=...`).

---

## 2. Locked Implementation Decisions

### 2.1 Database & View Architecture (Migration `003_catalog_views.sql`)
1. **Fix & Refine `v_medicine_availability`:**
   - Must expose: `medicine_id`, `name`, `company`, `pack_size`, `salts_text`, `salt_ids`, `gst_rate`, `on_hand_qty`, `reserved_qty`, `available_qty`, `max_mrp`, `max_price_incl_gst`, and `in_stock`.
   - `sellable_stock` CTE:
     ```sql
     SELECT
       b.medicine_id,
       COALESCE(SUM(b.quantity_on_hand), 0)::INT AS on_hand_qty,
       MAX(b.mrp) AS max_mrp,
       MAX(ROUND(b.selling_price * (1.0 + (m.gst_rate / 100.0)), 2)) AS max_price_incl_gst
     FROM batches b
     JOIN medicines m ON b.medicine_id = m.medicine_id
     WHERE b.status = 'ACTIVE' 
       AND b.expiry_date >= today_ist() 
       AND b.quantity_on_hand > 0
     GROUP BY b.medicine_id
     ```
   - `reserved_stock` CTE:
     ```sql
     SELECT
       oi.medicine_id,
       COALESCE(SUM(oi.requested_quantity), 0)::INT AS reserved_qty
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.order_id
     WHERE o.status = 'PLACED'
     GROUP BY oi.medicine_id
     ```
   - Net Availability Logic:
     - `on_hand_qty = COALESCE(s.on_hand_qty, 0)`
     - `reserved_qty = COALESCE(r.reserved_qty, 0)`
     - `available_qty = GREATEST(0, COALESCE(s.on_hand_qty, 0) - COALESCE(r.reserved_qty, 0))`
     - `in_stock = (GREATEST(0, COALESCE(s.on_hand_qty, 0) - COALESCE(r.reserved_qty, 0)) > 0)`
     - `max_mrp = CASE WHEN s.on_hand_qty > 0 THEN s.max_mrp ELSE NULL END`
     - `max_price_incl_gst = CASE WHEN s.on_hand_qty > 0 THEN s.max_price_incl_gst ELSE NULL END`
2. **Refine `v_catalog`:**
   - Projects: `medicine_id`, `name`, `company`, `pack_size`, `salts_text`, `salt_ids`, `gst_rate`, `max_mrp`, `max_price_incl_gst`, `available_qty`, `in_stock`.
3. **Performance Optimization:**
   - Compound index on `batches(medicine_id, status, expiry_date, quantity_on_hand)` to make CTE scans index-only.
   - GIN trigram indexes on `medicines(name gin_trgm_ops)`, `medicines(company gin_trgm_ops)`, and `medicines(salts_text gin_trgm_ops)`.

### 2.2 Backend Catalog API Contracts
1. **Catalog Listing (`GET /api/v1/catalog`):**
   - **Access Control:** `authenticate` + `requireApprovedRetailer`.
     - Retailer role: Must have `approval_status === 'APPROVED'` in `retailer_profiles`, else returns 403 `RETAILER_NOT_APPROVED`.
     - Admin & Delivery roles: Unrestricted access.
   - **Query Parameters:**
     - `q`: String (max 100). Searches `name ILIKE %q% OR company ILIKE %q% OR salts_text ILIKE %q%`.
     - `saltId`: Positive integer. Filters by `saltId = ANY(salt_ids)`.
     - `inStock`: Boolean coercion (`true` filters for `available_qty > 0`).
     - `sort`: Enum (`name`, `-name`, `price`, `-price`). Default `name ASC`. For price sorting: `max_price_incl_gst ASC NULLS LAST` and `DESC NULLS LAST`.
     - `page`: Integer >= 1, default 1.
     - `pageSize`: Integer 1–50, default 20.
   - **Response Shape (200 OK):**
     ```json
     {
       "success": true,
       "code": "OK",
       "message": "Catalog retrieved successfully",
       "data": [
         {
           "medicineId": 14,
           "name": "Augmentin 625 Duo Tablet",
           "company": "GSK",
           "packSize": "10 Tablets",
           "saltsText": "Amoxicillin (500mg) + Clavulanic Acid (125mg)",
           "salts": [
             { "saltId": 1, "saltName": "Amoxicillin" },
             { "saltId": 2, "saltName": "Clavulanic Acid" }
           ],
           "gstRate": "12.00",
           "maxMrp": "223.50",
           "maxPriceInclGst": "201.15",
           "availableQty": 120,
           "inStock": true
         }
       ],
       "meta": {
         "page": 1,
         "pageSize": 20,
         "total": 45,
         "totalPages": 3
       }
     }
     ```
2. **Catalog Item Detail (`GET /api/v1/catalog/:medicineId`):**
   - **Access Control:** `authenticate` + `requireApprovedRetailer`.
   - **Response:** Single catalog item of identical shape. Returns 404 `NOT_FOUND` if medicine does not exist or `is_active = FALSE`.
   - **Masking:** Absolutely zero batch details, batch numbers, or supplier costs exposed.
3. **Out-of-Stock Alert Queue (`GET /api/v1/alerts/out-of-stock`):**
   - **Access Control:** `authenticate` + `authorize(['ADMIN'])`.
   - **Query Parameters:** `page`, `pageSize`.
   - **Response Shape:** List of active medicines where `available_qty = 0`, including `onHandQty`, `reservedQty`, `maxMrp`, `gstRate`.

### 2.3 Frontend Retailer UX & Design System
1. **Debounced Hybrid Search & Instant Filtering:**
   - Search box bound to `q` query state with 300ms debounce.
   - "In-Stock Only" toggle button/checkbox enabled by default (`inStock=true`).
   - Active salt filter tags / dropdown.
   - Sort selector with clear labels ("Name: A to Z", "Name: Z to A", "Price: Low to High", "Price: High to Low").
2. **Medicine Card & PriceTag (`PriceTag.tsx`):**
   - When in stock (`inStock === true` and `availableQty > 0`):
     - Displays `maxPriceInclGst` prominently in bold dark text (e.g., `₹201.15`).
     - Struck-through `maxMrp` beside it (e.g., `MRP ₹223.50`).
     - GST inclusive badge (`Incl. 12% GST`).
     - Quantity stepper: `[-] [1] [+]`, clamped between 1 and `availableQty`.
     - "Add to Cart" button.
   - When out of stock (`availableQty === 0`):
     - Prominent "Out of Stock" badge (`bg-slate-100 text-slate-600 border border-slate-300`).
     - Stepper and "Add to Cart" button disabled.
     - "Notify when in stock" or contact warehouse message.
3. **Local Cart Persistence & Floating Bottom Bar:**
   - Scoped per authenticated user: `localStorage.getItem('kd_cart_' + userId)`.
   - Floating sticky bottom drawer:
     - Fixed bottom bar on mobile and desktop viewports when cart has items.
     - Displays: `{totalQuantity} items in cart | Subtotal: ₹{totalPriceInclGst}`.
     - Action button: "View Cart →" routing to `/cart`.
4. **Admin Alerts Out-of-Stock Tab (`/admin/alerts`):**
   - Tabbed view: "Out of Stock" (Active), "Near Expiry" (Phase 10), "Expired" (Phase 10).
   - Clean data table with medicine name, company, pack size, on-hand qty, reserved qty, and a primary action button: `Inward Stock →` prefilling `/stock/inward?medicineId=X`.

---

## 3. Verification & Test Plan

1. **Database & View Verification:**
   - Test that multiple active batches with different selling prices correctly output the highest selling price incl. GST in `v_medicine_availability` and `v_catalog`.
   - Test that expired batches (`expiry_date < today_ist()`) are excluded from `on_hand_qty` and price calculations.
   - Test that blocked batches (`status = 'BLOCKED'`) are excluded from availability.
   - Test that orders in `PLACED` status reduce `available_qty`, and cancelling or moving out of `PLACED` restores `available_qty`.
   - Test that when reservations equal or exceed on-hand stock, `available_qty = 0` and `in_stock = false` (never negative).
2. **Backend Security & API Validation:**
   - Test unapproved retailer (`PENDING` or `REJECTED`) receives 403 `RETAILER_NOT_APPROVED` on `GET /catalog` and `GET /catalog/:medicineId`.
   - Test approved retailer receives 200 OK with sanitized catalog records.
   - Test admin and delivery roles receive 200 OK on `GET /catalog`.
   - Test search parameter `q` matches across name, company, and salts text.
   - Test sorting by name and price (including `NULLS LAST` handling).
   - Test that retailer response payload contains no batch numbers, expiry dates, or cost prices.
   - Test `GET /alerts/out-of-stock` rejects non-admin users with 403 `FORBIDDEN` and returns zero-stock medicines for admin.
3. **Frontend E2E & Component Tests:**
   - Test `PriceTag` formatting: formats INR currency, handles GST calculation, strikes out MRP.
   - Test quantity stepper clamps between 1 and `availableQty`.
   - Test local storage cart persistence survives page refresh and is isolated per user ID.
   - Test floating cart bar triggers correctly when items are added.
