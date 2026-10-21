export type CaptureMethod = 'SCAN_BARCODE' | 'SCAN_OCR' | 'MANUAL';

export interface InwardStockPayload {
  medicineId: number;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  mrp: string;
  sellingPrice: string;
  purchaseRate?: string;
  quantity: number;
  supplierName?: string;
  gtin?: string;
  qrPayload?: string;
  captureMethod: CaptureMethod;
}

export interface InwardStockResult {
  action: 'CREATED' | 'TOPPED_UP';
  batch: {
    batchId: number;
    medicineId: number;
    batchNumber: string;
    expiryDate: string;
    mrp: string;
    sellingPrice: string;
    purchaseRate: string;
    quantityOnHand: number;
    status: string;
    gtin: string | null;
  };
  ledgerEntry: {
    entryId: number;
    type: string;
    delta: number;
    balanceAfter: number;
  };
}

export interface ScanResolvePayload {
  payload: string;
}

export interface ScanResolveResult {
  gtin?: string;
  batchNumber?: string;
  expiryDate?: string;
  mrp?: string;
  parsedGs1?: {
    gtin?: string;
    batchNumber?: string;
    expiryDate?: string;
    serialNumber?: string;
  };
  matchedMedicine?: {
    medicineId: number;
    name: string;
    company: string;
    packSize: string;
    gstRate: number;
    saltsText?: string;
  };
  matchedBatch?: {
    batchId: number;
    batchNumber: string;
    expiryDate: string;
    mrp: string;
    sellingPrice: string;
    purchaseRate?: string;
    quantityOnHand: number;
  };
  medicineSuggestions?: Array<{
    medicineId: number;
    name: string;
    company: string;
    packSize: string;
    gstRate: number;
  }>;
}
