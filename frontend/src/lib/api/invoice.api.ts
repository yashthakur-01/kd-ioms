import { apiFetch, type ApiResponse } from './client';

export interface InvoiceListItem {
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

export interface InvoiceLine {
  orderItemId: number;
  medicineId: number;
  medicineName: string;
  packSize: string;
  batchId: number;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  mrp: string;
  unitPrice: string;
  gstRate: number;
  gstAmount: string;
  lineTotal: string;
}

export interface InvoiceNotificationLog {
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

export interface InvoiceDetail {
  invoiceId: number;
  invoiceNumber: string;
  orderId: number;
  orderNumber: string;
  retailerId: string;
  billedTo: {
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
  };
  subtotal: string;
  gstAmount: string;
  roundOff: string;
  total: string;
  pdfPath: string | null;
  generatedAt: string;
  lines?: InvoiceLine[];
  notifications?: InvoiceNotificationLog[];
}

export interface InvoicePdfResponse {
  url: string;
  expiresIn: number;
}

export interface ResendNotificationResponse {
  invoiceId: number;
  logs: InvoiceNotificationLog[];
}

export interface InvoicesQueryParams {
  from?: string;
  to?: string;
  retailerId?: string;
  page?: number;
  pageSize?: number;
}

export async function getInvoices(
  params: InvoicesQueryParams = {}
): Promise<ApiResponse<InvoiceListItem[]>> {
  return apiFetch<InvoiceListItem[]>('/invoices', {
    query: {
      from: params.from,
      to: params.to,
      retailerId: params.retailerId,
      page: params.page,
      pageSize: params.pageSize,
    },
  });
}

export async function getInvoiceById(
  invoiceId: number
): Promise<ApiResponse<InvoiceDetail>> {
  return apiFetch<InvoiceDetail>(`/invoices/${invoiceId}`);
}

export async function getInvoicePdfUrl(
  invoiceId: number
): Promise<ApiResponse<InvoicePdfResponse>> {
  return apiFetch<InvoicePdfResponse>(`/invoices/${invoiceId}/pdf`);
}

export async function resendInvoiceNotification(
  invoiceId: number,
  channel?: 'WHATSAPP' | 'EMAIL'
): Promise<ApiResponse<ResendNotificationResponse>> {
  return apiFetch<ResendNotificationResponse>(`/invoices/${invoiceId}/resend`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ channel }),
  });
}
