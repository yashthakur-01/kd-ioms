# Plan 9-02: PDFKit Wholesale Invoice Template Engine

**Phase:** Phase 9 — Invoicing and Multi-Channel Notifications  
**Plan ID:** `9-02`  
**Wave:** 2 (PDF Rendering Engine)  
**Dependencies:** Plan 9-01  
**Responsible Developer:** `dev3`  

---

## 1. Objective

Build the wholesale pharmaceutical invoice PDF generator using PDFKit (`backend/src/modules/invoice/invoice.pdf.ts`). The layout adheres to Indian wholesale pharma standards, displaying the business profile with GSTIN/Drug License, buyer pharmacy details, itemized batch details, a single GST aggregate summary line, integer rupee round-off, and amount in words.

---

## 2. Tasks & Detailed Instructions

### Task 1: Amount in Words Helper (`backend/src/utils/number-to-words.ts`)
- Implement Indian numbering system words converter (Lakhs, Crores, Thousands, Hundreds, Rupees, and Paise).
- Example: `2352.00` -> `"Two Thousand Three Hundred Fifty-Two Rupees Only"`.

### Task 2: PDFKit Template Implementation (`backend/src/modules/invoice/invoice.pdf.ts`)
- Interface `InvoicePdfData`:
  ```ts
  export interface InvoicePdfData {
    invoiceNumber: string;
    invoiceDate: string; // DD/MM/YYYY
    orderNumber: string;
    orderDate: string; // DD/MM/YYYY
    business: {
      name: string;
      address: string;
      gstin: string;
      drugLicenseNumber: string;
      phone: string;
      email: string;
    };
    billedTo: {
      shopName: string;
      contactPerson?: string;
      addressLine: string;
      city: string;
      state: string;
      pincode: string;
      phone: string;
      gstin?: string;
      drugLicenseNumber?: string;
    };
    lines: Array<{
      serialNo: number;
      medicineName: string;
      packSize: string;
      batchNumber: string;
      expiryDate: string; // MM/YY
      quantity: number;
      mrp: string;
      rate: string; // unit rate excl GST
      amount: string; // quantity * rate
    }>;
    subtotal: string;
    gstAmount: string; // single GST line
    roundOff: string;
    total: string;
    totalInWords: string;
  }
  ```
- Function `buildInvoicePdf(data: InvoicePdfData): Promise<Buffer>`:
  - Generates A4 PDF using PDFKit in memory buffer.
  - Top Header: Business name (bold, large font), full address, GSTIN, DL Number, contact info.
  - Subheader: "TAX INVOICE" title bar with Invoice #, Invoice Date, Order #, Order Date.
  - Billed To Card: Pharmacy name, DL Number, GSTIN, Full Address, Phone.
  - Items Table:
    - Headers: `#`, `Description / Medicine`, `Pack`, `Batch`, `Exp`, `Qty`, `MRP`, `Rate (₹)`, `Amount (₹)`.
    - Alternating row styling with clean borders and right-aligned numeric amounts.
  - Bottom Financial Summary Block (Right Aligned):
    - Subtotal: `₹...`
    - Output GST: `₹...` (Single aggregate GST line)
    - Round Off: `(+/-) ₹...`
    - Grand Total: `₹...` (Bold, highlighted)
  - Bottom Left: Amount in Words, Bank Details (if configured) or Declaration.
  - Footer: Terms ("Goods once sold will not be taken back", "Subject to Ahmedabad Jurisdiction", "This is a computer generated invoice").

### Task 3: Unit Tests (`backend/src/modules/invoice/__tests__/invoice-pdf.test.ts`)
- Test cases:
  1. `buildInvoicePdf` compiles a valid non-empty PDF Buffer starting with `%PDF-`.
  2. PDF generation handles long item lists spanning across multiple pages gracefully without overflow.
  3. Verifies amount in words helper across varied figures (e.g. ₹100, ₹1,250, ₹1,00,000).

---

## 3. Verification Criteria

- [ ] `buildInvoicePdf` returns a valid, properly styled PDF buffer.
- [ ] Layout includes all mandatory tax invoice fields, single GST aggregate, and round-off.
- [ ] Unit tests pass cleanly with `npm test`.
