export interface BilledToSnapshot {
  shopName: string;
  contactPerson?: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  whatsappNumber?: string;
  gstin?: string;
  drugLicenseNumber?: string;
}

export interface InvoiceLineDto {
  orderItemId: number;
  medicineId: number;
  medicineName: string;
  packSize: string;
  batchId: number;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  mrp: string;
  unitPrice: string; // Rate excl GST
  gstRate: number;
  gstAmount: string;
  lineTotal: string;
}

export interface InvoiceNotificationLogDto {
  logId: number;
  channel: 'WHATSAPP' | 'EMAIL';
  recipient: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  attempts: number;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  lastAttemptAt?: string | null;
  createdAt: string;
}

export interface InvoiceDto {
  invoiceId: number;
  invoiceNumber: string;
  orderId: number;
  orderNumber: string;
  retailerId: string;
  billedTo: BilledToSnapshot;
  subtotal: string;
  gstAmount: string; // Single aggregate GST line (ADR-040)
  roundOff: string;
  total: string;
  pdfPath: string | null;
  generatedAt: string;
  lines?: InvoiceLineDto[];
  notifications?: InvoiceNotificationLogDto[];
}

export interface InvoiceSummaryDto {
  invoiceId: number;
  invoiceNumber: string;
  orderId: number;
  orderNumber: string;
  retailerId: string;
  shopName: string;
  subtotal: string;
  gstAmount: string;
  roundOff: string;
  total: string;
  pdfPath: string | null;
  generatedAt: string;
  latestNotification?: {
    channel: 'WHATSAPP' | 'EMAIL';
    status: 'PENDING' | 'SENT' | 'FAILED';
  } | null;
}
