# Plan 5-03: Admin Out-of-Stock Alert Queue & Routing

**Phase:** Phase 5 — Catalog and Availability  
**Plan ID:** `5-03`  
**Wave:** 3 (Out-of-Stock Backend & Alerts Route)  
**Dependencies:** Plan 5-01, Plan 5-02  
**Responsible Developer:** `dev2`  

---

## 1. Objective

Deliver the admin out-of-stock alert queue `GET /api/v1/alerts/out-of-stock` powered by `v_medicine_availability`, strictly restricted to `ADMIN` users (`authorize([USER_ROLE.ADMIN])`), returning active medicines with zero sellable stock, on-hand counts, and reservation metrics.

---

## 2. Tasks & Detailed Instructions

### Task 1: Service Method for Out-of-Stock Alerts (`backend/src/modules/catalog/catalog.service.ts`)
- Add `getOutOfStockAlerts(pagination: { page: number; pageSize: number })`:
  - Queries `v_medicine_availability` for records where:
    ```sql
    SELECT
      medicine_id,
      name,
      company,
      pack_size,
      salts_text,
      gst_rate,
      on_hand_qty,
      reserved_qty,
      available_qty,
      max_mrp
    FROM v_medicine_availability
    WHERE available_qty = 0
    ORDER BY name ASC
    LIMIT $1 OFFSET $2
    ```
  - Calculates total count of zero-availability active medicines using `COUNT(*)::INT`.
  - Formats data:
    ```typescript
    {
      medicineId: row.medicine_id,
      name: row.name,
      company: row.company,
      packSize: row.pack_size,
      saltsText: row.salts_text,
      gstRate: parseFloat(row.gst_rate).toFixed(2),
      onHandQty: row.on_hand_qty,
      reservedQty: row.reserved_qty,
      availableQty: row.available_qty,
      maxMrp: row.max_mrp ? parseFloat(row.max_mrp).toFixed(2) : null
    }
    ```
  - Returns `{ items, pagination: { page, pageSize, total, totalPages } }`.

### Task 2: Controller Method (`backend/src/modules/catalog/catalog.controller.ts`)
- Add `getOutOfStockAlerts(req: Request, res: Response)`:
  - Parses `page` (default 1) and `pageSize` (default 20, max 50).
  - Calls `catalogService.getOutOfStockAlerts({ page, pageSize })`.
  - Wraps response in standard envelope:
    ```json
    {
      "success": true,
      "code": "OK",
      "message": "Out of stock alerts retrieved successfully",
      "data": [...],
      "meta": { "page": 1, "pageSize": 20, "total": 8, "totalPages": 1 }
    }
    ```

### Task 3: Alerts Route & Router Mount (`backend/src/modules/catalog/alerts.route.ts` & `backend/src/routes/index.ts`)
- Create `backend/src/modules/catalog/alerts.route.ts`:
  - Mount `GET /out-of-stock`:
    - Middlewares: `authenticate`, `authorize([USER_ROLE.ADMIN])`, `validate(paginationQuerySchema, 'query')`.
    - Handler: `catalogController.getOutOfStockAlerts`.
- Mount `/alerts` in `backend/src/routes/index.ts`:
  ```typescript
  import alertsRouter from '../modules/catalog/alerts.route.js';
  // ...
  router.use('/alerts', alertsRouter);
  ```

### Task 4: Integration Tests (`backend/src/modules/catalog/__tests__/alerts.test.ts`)
- Automated tests verifying:
  1. `RETAILER` or `DELIVERY` role receives 403 `FORBIDDEN`.
  2. `ADMIN` role receives 200 OK with list of medicines where `availableQty = 0`.
  3. Medicines with positive availability (`availableQty > 0`) are excluded from the results.
  4. Medicines with physical on-hand stock that are 100% reserved by `PLACED` orders (`availableQty = 0`) are included in the results.
  5. Pagination (page navigation and pageSize limit) operates accurately.

---

## 3. Verification & Acceptance Criteria
- [ ] `GET /api/v1/alerts/out-of-stock` is registered and functional.
- [ ] Strict role protection restricts access to `ADMIN`.
- [ ] Only medicines with `availableQty === 0` appear in the alerts queue.
- [ ] Tests in `backend/src/modules/catalog/__tests__/alerts.test.ts` pass cleanly.
