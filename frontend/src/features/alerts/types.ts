export interface NearExpiryAlertItem {
  batchId: number;
  medicineId: number;
  medicineName: string;
  batchNumber: string;
  expiryDate: string;
  daysLeft: number;
  quantityOnHand: number;
  mrp: string;
  sellingPrice: string;
}

export interface ExpiredStockItem {
  batchId: number;
  medicineId: number;
  medicineName: string;
  batchNumber: string;
  expiryDate: string;
  daysExpired: number;
  quantityOnHand: number;
  mrp: string;
  sellingPrice: string;
}

export interface OutOfStockItem {
  medicineId: number;
  name: string;
  company: string;
  packSize?: string;
  availableQty: number;
}

export interface ListAlertsParams {
  page?: number;
  pageSize?: number;
  search?: string;
}
