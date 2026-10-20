<!-- generated-by: gsd-doc-writer -->
# Administrator Operations Manual

This guide provides operational procedures for warehouse managers, operations leads, and administrators managing the Kandarp Drugs Inventory & Order Management System (KD-IOMS).

---

## Table of Contents
1. [Initial Setup & System Settings](#1-initial-setup--system-settings)
2. [Retailer Account Provisioning & KYC Approval](#2-retailer-account-provisioning--kyc-approval)
3. [Master Catalog Management](#3-master-catalog-management)
4. [Stock Inwarding & GS1 DataMatrix Ingestion](#4-stock-inwarding--gs1-datamatrix-ingestion)
5. [Order Review & FEFO Pick Allocation](#5-order-review--fefo-pick-allocation)
6. [Dispatch Management & Overrides](#6-dispatch-management--overrides)
7. [Inventory Health, Alerts & Batch Adjustments](#7-inventory-health-alerts--batch-adjustments)
8. [Tax Invoicing & Statutory Compliance](#8-tax-invoicing--statutory-compliance)

---

## 1. Initial Setup & System Settings

Access the system settings via the left navigation panel at `/settings`.

### 1.1 Business Profile & Statutory Details
Ensure the legal entity details are configured accurately prior to issuing wholesale invoices:
- **Trade Name**: Registered pharmaceutical distribution entity name (e.g., `Kandarp Drugs Private Limited`).
- **Registered Address**: Warehouse and corporate dispatch location.
- **GSTIN**: 15-character Goods & Services Tax Identification Number (e.g., `24AAACT1234F1Z8`).
- **Wholesale Drug License Numbers**: Form 20B and Form 21B drug licenses issued by the Food & Drugs Control Administration (FDCA).
- **Contact Details**: Official billing email and customer support phone line printed on tax invoices.

### 1.2 Inventory Alert Thresholds
- **Expiry Warning Window**: Configurable alert horizon (default: 60 days). Batches expiring within this window appear on the Expiry Alert dashboard.
- **Stock Depletion Threshold**: Minimum units alert trigger for high-velocity pharmaceutical stock.

---

## 2. Retailer Account Provisioning & KYC Approval

KD-IOMS enforces strict authorization controls: only verified licensed pharmacies can place wholesale orders.

### 2.1 Provisioning Retailer Logins
1. Navigate to `/users` and select **Add New User**.
2. Select role **RETAILER** and supply the retailer's mobile number and unique username.
3. The system generates a temporary password and flags `must_change_password: true`.
4. The retailer must change their password on first login.

### 2.2 KYC Verification & Approval Pipeline
1. When a retailer logs in, they submit their pharmacy profile under `/profile`:
   - Pharmacy Shop Name, Address, City, State, and Pincode.
   - Drug License Number (Form 20/21) and statutory GSTIN.
   - WhatsApp-enabled contact phone for dispatch tracking.
2. The submission enters the **Pending Review** queue at `/retailers`.
3. Open `/retailers/[userId]` to inspect credentials:
   - Verify drug license number against the FDCA portal.
   - Verify GSTIN validity on the GST portal.
4. Click **Approve Retailer** to unlock wholesale catalog access. If discrepancies are detected, click **Reject Application** and specify required clarifications.

---

## 3. Master Catalog Management

### 3.1 Chemical Salt Composition Master
Salts represent active pharmaceutical ingredients (APIs) used for regulatory grouping and substitute matching:
- Navigate to `/salts`.
- Add new salt compositions (e.g., `Paracetamol`, `Amoxicillin`, `Ibuprofen`).
- The system prevents duplicate compositions using trigram similarity checks.

### 3.2 Branded Medicine Master
- Navigate to `/medicines`.
- Register branded products specifying:
  - Product Name, Manufacturer / Marketing Company.
  - Pack Size (e.g., `10x10 Tablets`, `100ml Syrup`).
  - HSN Code (typically `30049099` for allopathic formulations) and GST slab (`12%` or `18%`).
  - Associated active chemical salts with strength proportions.

### 3.3 Bulk Master Data CSV Ingestion
For large inventory catalogs, use the command-line bulk import tools:
```bash
# 1. Preview salt imports without database modification
npm run import:salts -- --file=data/salts.csv --dry-run

# 2. Ingest chemical salts
npm run import:salts -- --file=data/salts.csv

# 3. Preview and validate medicines catalog
npm run import:medicines -- --file=data/medicines.csv --dry-run

# 4. Ingest medicines catalog
npm run import:medicines -- --file=data/medicines.csv
```

---

## 4. Stock Inwarding & GS1 DataMatrix Ingestion

Navigate to `/stock/inward` when receiving physical shipments from pharmaceutical manufacturers.

### 4.1 GS1 Barcode Scanning Workflow
1. Use an attached 2D barcode scanner or USB camera to scan the GS1 DataMatrix on the outer carton.
2. The scanner extracts:
   - Application Identifier `(01)`: 14-digit Global Trade Item Number (GTIN).
   - Application Identifier `(17)`: Expiration date in `YYMMDD` format.
   - Application Identifier `(10)`: Manufacturer batch / lot number.
3. The system automatically populates the inwarding form with the matched medicine and expiry date.

### 4.2 Manual Batch Entry
If the manufacturer carton lacks GS1 DataMatrix barcodes:
1. Search and select the medicine from the catalog dropdown.
2. Enter the Batch Number exactly as printed on the strip or vial.
3. Set the Expiry Date (must be in the future).
4. Enter Received Quantity, Maximum Retail Price (MRP), Purchase Rate, and Wholesale Selling Price.
5. Click **Confirm Inwarding**.

The system updates available stock and records an immutable `INWARD` entry in the double-entry Stock Ledger.

---

## 5. Order Review & FEFO Pick Allocation

### 5.1 Order Evaluation Pipeline
1. Incoming retailer orders arrive with status `PLACED` at `/orders`.
2. Click **Review & Pick** on an order to open `/orders/[orderId]/pick`.
3. The system's **First-Expiry-First-Out (FEFO)** algorithm automatically recommends batches:
   - Batches with the earliest expiration date are suggested first.
   - Near-expiry or quarantined batches are excluded.
   - If a batch has insufficient quantity, the algorithm cascades across available batches.

### 5.2 Warehouse Scan-to-Pick Verification
1. Warehouse staff physically retrieve items from designated shelf locations.
2. Scan the barcode on the retrieved batch.
3. The pick interface highlights green when the scanned batch matches the FEFO suggestion.
4. Click **Approve Order**:
   - Stock is immediately deducted from the allocated batches.
   - The order transitions to `APPROVED` status and enters the Delivery Dispatch Pool.
   - Inventory reservation is atomic and protected against concurrent race conditions.

---

## 6. Dispatch Management & Overrides

### 6.1 Dispatch Pool Monitoring
Navigate to `/delivery/pool` to monitor pending deliveries:
- Orders approved by warehouse leads automatically appear in the open dispatch pool.
- Delivery agents claim orders via mobile or tablet.
- If an agent is delayed or unavailable, administrators can use the **Admin Override** button to unassign the order or reassign it to an alternate delivery agent.

### 6.2 Managing Whole-Line Delivery Refusals
If a pharmacy refuses items at the doorstep (e.g., damaged transit packaging or incorrect ordering):
1. The delivery agent marks the specific line item as `REFUSED` with a mandatory reason.
2. Upon submission:
   - The returned items are automatically credited back to inventory via an immediate `RETURN_IN` stock ledger entry.
   - The tax invoice reflects only accepted line items.
3. Administrators can review the delivery photo proof and refusal note under `/invoices/[invoiceId]`.

---

## 7. Inventory Health, Alerts & Batch Adjustments

### 7.1 Near-Expiry Alerts (`/alerts/near-expiry`)
- Displays all batches reaching expiry within the configured window (e.g., 60 days).
- Sorts by urgency and displays value at risk.
- Facilitates proactive clearance discounts or return-to-vendor (RTV) claims with manufacturers.

### 7.2 Out-of-Stock Alerts (`/alerts/out-of-stock`)
- Surfaces high-demand medicines whose aggregate inventory is zero or below safety buffer.
- Highlights missed order demand to guide reordering cycles.

### 7.3 Batch Quantity Adjustments (`/batches`)
In the event of warehouse breakage, leakage, or physical audit reconciliation:
1. Locate the batch at `/batches`.
2. Click **Adjust Stock**.
3. Select Adjustment Type:
   - `BREAKAGE`: Physical transit or handling loss.
   - `DISPOSAL`: Safe destruction of expired medications.
   - `AUDIT_CORRECTION`: Physical stock count alignment.
4. Supply the delta and mandatory audit explanation.
5. The system adjusts available batch quantity and creates a matching ledger record.

---

## 8. Tax Invoicing & Statutory Compliance

### 8.1 Automated Invoicing
Tax invoices are automatically generated upon successful delivery completion:
- Sequential invoice numbering: `KD/YYYY-YY/XXXX` format.
- Statutory GST breakdown: CGST (6%) and SGST (6%) for intra-state sales; IGST (12%) for inter-state.
- Recipient GSTIN, drug license numbers, and HSN-level line item itemization.

### 8.2 Invoice Downloads & Archival
- Navigate to `/invoices`.
- Search by invoice number, retailer name, or date range.
- Click **Download PDF** to retrieve the signed PDF invoice for accounting, GST filing, or retailer reprints.
