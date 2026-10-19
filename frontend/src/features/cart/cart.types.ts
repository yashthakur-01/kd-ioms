export interface CartItem {
  medicineId: number;
  name: string;
  company: string;
  packSize: string;
  priceInclGst: string; // Two-decimal string, e.g. "201.15"
  mrp: string;          // Two-decimal string, e.g. "223.50"
  gstRate: string;
  quantity: number;     // Clamped to [1, maxAvailable]
  maxAvailable: number; // Dynamic availability ceiling at time of add
}

export interface CartSummary {
  items: CartItem[];
  totalQuantity: number;
  subtotal: string;     // Formatted INR string
}
