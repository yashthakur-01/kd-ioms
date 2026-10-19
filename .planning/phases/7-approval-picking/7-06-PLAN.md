# Plan 7-06: Scanner Hardware/Camera Integration & Verification

**Phase:** Phase 7 — Order Approval and Batch Picking  
**Plan ID:** `7-06`  
**Wave:** 6 (Hardware/Camera Integration & Full System Verification)  
**Dependencies:** Plan 7-01 through Plan 7-05  
**Responsible Developer:** `dev1`  

---

## 1. Objective

Integrate hardware barcode gun listeners (`useBarcodeScanner`) and camera viewfinder modal (`CameraScannerModal`) into the Admin Order Picking workflow. Implement instant scan-to-pick matching via `POST /api/v1/batches/resolve-scan` with audio chime feedback (`AudioContext`) and emerald flash on success. Execute full end-to-end verification across the entire monorepo (`npm test`, `npm run lint`, `npm run build`), resolve any regressions, and document the phase completion report.

---

## 2. Tasks & Detailed Instructions

### Task 1: Hardware Barcode Gun Listener (`BarcodeScanListener.tsx`)
- In `frontend/src/features/orders/components/BarcodeScanListener.tsx`:
  - Hook into `useBarcodeScanner` from `frontend/src/hooks/useBarcodeScanner.ts`.
  - When a barcode is scanned by an external USB/Bluetooth scanner gun:
    1. Call `resolveScan(scannedPayload)`.
    2. Check if the resolved batch belongs to any line item in the active order.
    3. If matched:
       - Auto-assign the batch to that line item.
       - Increment the picked quantity by 1 (or by the recommended remaining quantity).
       - Mark `captureMethod = 'SCAN_GUN'`.
       - Play a subtle high-frequency success chime using HTML5 `AudioContext`.
       - Trigger a temporary emerald border highlight on the target item card.
    4. If not matched or expired:
       - Play a low-frequency rejection tone.
       - Show error toast: `'Scanned batch does not belong to any line item in this order'` or `'Batch is expired/unusable'`.

### Task 2: Camera Viewfinder Modal Integration
- Connect `CameraScannerModal` from `frontend/src/components/scan/CameraScannerModal.tsx`:
  - Each item card has a "Scan Pack" button that opens `CameraScannerModal`.
  - When a frame detects a barcode or OCR pack text:
    1. Send text/payload to `resolveScan(payload, item.medicineId)`.
    2. Populate allocation with `captureMethod = 'SCAN_CAMERA'`.
    3. Close camera modal and chime.

### Task 3: Admin Orders Queue Enhancements (`frontend/src/app/(admin)/orders/page.tsx`)
- Update the admin orders queue at `/orders`:
  - Add "Pick & Approve" action button on orders in `PLACED` status.
  - Clicking navigates directly to `/orders/[orderId]/pick`.
  - Displays quick metrics: Placed count, Items count, Created timestamp.

### Task 4: Full System Verification & Quality Gate
- Run all automated tests:
  - Backend: `npm test` (all 29+ test files passing).
  - Frontend: `npm test` (all 22+ test files passing).
- Run TypeScript compiler:
  - Backend: `npm run lint`, `npm run build` (`tsc` clean).
  - Frontend: `npm run lint`, `npm run build` (`next build` clean across all static and PPR routes).
- Ensure zero lint errors, zero test regressions, and zero broken types.

### Task 5: Phase Documentation & Report
- Update `.planning/STATE.md` and `.planning/ROADMAP.md` marking Phase 7 completed.
- Generate Phase 7 execution report artifact: `phase_7_execution_report.md`.

---

## 3. Verification Criteria

- [ ] Hardware barcode scanner gun triggers rapid automatic batch matching and incrementing.
- [ ] Camera scanner modal captures barcodes and populates line allocations.
- [ ] Audio tone and visual pulse provide confirmation during rapid warehouse picking.
- [ ] Backend test suite passes 100% cleanly (`npm test` in backend).
- [ ] Frontend test suite passes 100% cleanly (`npm test` in frontend).
- [ ] Production builds finish with 0 errors (`npm run build` in backend and frontend).
