export interface BatchPickSuggestion {
  batchId: number;
  batchNumber: string;
  expiryDate: string;
  mrp: string;
  sellingPrice: string;
  gstRate: string;
  priceInclGst: string;
  quantityOnHand: number;
  withinQuote: boolean;
  suggestedQty: number;
}

export interface ItemPickSuggestion {
  orderItemId: number;
  medicineId: number;
  medicineName: string;
  company: string;
  packSize: string;
  requestedQuantity: number;
  quotedPriceInclGst: string;
  suggestions: BatchPickSuggestion[];
  batches: BatchPickSuggestion[];
}

export interface OrderPickSuggestionsResult {
  orderId: number;
  orderNumber: string;
  items: ItemPickSuggestion[];
}

export interface ResolveScanResult {
  batchId: number;
  medicineId: number;
  medicineName: string;
  batchNumber: string;
  expiryDate: string;
  mrp: string;
  sellingPrice: string;
  gstRate: string;
  priceInclGst: string;
  quantityOnHand: number;
}
