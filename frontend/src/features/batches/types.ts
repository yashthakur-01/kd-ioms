export interface BatchRecord {
  batchId: number;
  medicineId: number;
  medicineName: string;
  medicineCompany: string;
  medicinePackSize: string;
  gstRate: number;
  batchNumber: string;
  expiryDate: string;
  mrp: string;
  sellingPrice: string;
  purchaseRate: string;
  priceInclGst: string;
  quantityOnHand: number;
  status: 'ACTIVE' | 'BLOCKED';
  gtin: string | null;
  daysLeft: number;
  expiryAlertDismissedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerMovementRecord {
  entryId: number;
  batchId: number;
  type: string;
  delta: number;
  balanceAfter: number;
  reason: string | null;
  supplierName: string | null;
  orderId: number | null;
  orderItemId: number | null;
  createdAt: string;
  createdBy: string | null;
  createdByName: string | null;
  createdByUsername: string | null;
}

export interface BatchDetailRecord {
  batch: BatchRecord;
  ledgerEntries: LedgerMovementRecord[];
}

export interface GlobalLedgerRecord extends LedgerMovementRecord {
  batchNumber: string;
  expiryDate: string;
  mrp: string;
  sellingPrice: string;
  medicineId: number;
  medicineName: string;
  medicineCompany: string;
}

export interface ListBatchesParams {
  medicineId?: number;
  status?: 'ACTIVE' | 'BLOCKED';
  expiry?: 'ALL' | 'NEAR' | 'EXPIRED';
  inStock?: boolean;
  q?: string;
  sort?: 'expiryDate' | '-expiryDate' | 'createdAt' | '-createdAt' | 'batchNumber' | '-batchNumber';
  page?: number;
  pageSize?: number;
}

export interface UpdateBatchPayload {
  sellingPrice?: string;
  status?: 'ACTIVE' | 'BLOCKED';
}

export interface AdjustBatchPayload {
  type: 'DAMAGE' | 'CORRECTION' | 'EXPIRY_WRITEOFF';
  quantity: number;
  reason: string;
}

export interface ListLedgerParams {
  batchId?: number;
  medicineId?: number;
  type?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}
