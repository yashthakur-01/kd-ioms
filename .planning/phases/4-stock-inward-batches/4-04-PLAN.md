# Plan 4-04: Frontend Scan Heuristics & Hardware Scanner Hook

**Phase:** Phase 4 — Stock Inward, Batches and Append-Only Ledger  
**Plan ID:** `4-04`  
**Wave:** 4  
**Dependencies:** Plan `4-02`  
**Responsible Developer:** `dev1`  

---

## 1. Objective

Implement client-side barcode and packaging OCR heuristics (`parse-pack-text.ts`), a global keystroke listener hook for USB/Bluetooth hardware barcode guns (`useBarcodeScanner`), and an interactive HTML5 camera video scanner modal (`CameraScannerModal`) for mobile and desktop webcams.

---

## 2. Tasks & Detailed Instructions

### Task 1: Packaging OCR Text Heuristics (`frontend/src/lib/scan/parse-pack-text.ts`)
1. Create `frontend/src/lib/scan/parse-pack-text.ts`:
   - Implement `parsePackText(rawText: string): { batchNumber?: string; expiryDate?: string; mrp?: string }`:
     - Clean text: remove extra whitespace, normalize colons and dashes.
     - **Batch/Lot extraction heuristics:**
       - Search for prefixes: `B\.?No\.?`, `Batch(?:\s*No\.?)?`, `Lot(?:\s*No\.?)?` followed by alphanumeric token (length 2–20).
     - **Expiry Date extraction heuristics:**
       - Search for prefixes: `EXP`, `Expiry`, `Exp\.?\s*Date`, `USE\s*BEFORE`.
       - Support formats:
         - `MM/YY` or `MM-YY` -> convert to `20YY-MM-lastDay`.
         - `MM/YYYY` or `MM-YYYY` -> convert to `YYYY-MM-lastDay`.
         - `DD/MM/YYYY` or `DD-MM-YYYY` -> convert to `YYYY-MM-DD`.
     - **MRP extraction heuristics:**
       - Search for prefixes: `M\.?R\.?P\.?`, `Rs\.?`, `₹`, `INCL\.?\s*OF\s*ALL\s*TAXES` followed by positive decimal number.
     - Suggestion-only contract: returns candidates to pre-populate editable form; never auto-saves.
2. Unit tests in `frontend/src/lib/scan/__tests__/parse-pack-text.test.ts`:
   - Multiple noisy OCR text samples representing typical Indian pharmaceutical cartons/strips.
   - Extracting batch numbers with prefixes like `B.No. A23910` or `Batch: B982-1`.
   - Extracting expiry dates across `08/27`, `11/2028`, `15/03/2026`.
   - Extracting MRP across `M.R.P. Rs. 145.50` or `Rs. 89.00`.

### Task 2: Hardware Barcode Scanner Hook (`frontend/src/hooks/useBarcodeScanner.ts`)
1. Create `frontend/src/hooks/useBarcodeScanner.ts`:
   - Listens to global `window.addEventListener('keydown')`.
   - Buffer collection logic:
     - USB/Bluetooth hardware scanners emulate rapid keyboard typing (typically < 30ms between keystrokes).
     - Appends key to buffer if elapsed time since last keystroke is small (< 50ms).
     - If key is `Enter` and buffer length >= 8:
       - Prevents default form submit.
       - Fires `onScan(bufferedString)`.
       - Resets buffer.
     - If elapsed time exceeds timeout (e.g. 100ms), clears buffer (human typing distinction).
   - Allows enabling/disabling listener.

### Task 3: Camera Scanner Modal (`frontend/src/components/scan/CameraScannerModal.tsx`)
1. Create `frontend/src/components/scan/CameraScannerModal.tsx`:
   - Modal wrapper with video element.
   - Uses `html5-qrcode` or modern browser BarcodeDetector API:
     - Accesses back-facing camera (`facingMode: 'environment'`).
     - Scans 1D barcodes (EAN-13, Code 128) and 2D barcodes (GS1 DataMatrix, QR Code).
     - On successful detection -> invokes `onDetected(code)`, triggers audio/haptic feedback, and closes modal.
   - Includes fallback tab: "Upload Image / Packaging Photo" allowing file drop or camera snapshot input (`<input type="file" accept="image/*" capture="environment">`).

---

## 3. Verification & Acceptance Criteria ("Done When")

- [ ] `parsePackText` extracts batch, expiry, and MRP candidates from diverse noisy packaging text.
- [ ] `useBarcodeScanner` detects rapid keystrokes from USB/Bluetooth scanners without interfering with normal typing.
- [ ] `CameraScannerModal` initializes video stream and scans 1D/2D barcodes with file drop fallback.
- [ ] Unit tests pass cleanly (`npm test`).
