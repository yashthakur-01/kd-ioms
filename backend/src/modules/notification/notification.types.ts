export type NotificationChannel = 'WHATSAPP' | 'EMAIL';
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface WhatsAppSendParams {
  recipientPhone: string;
  invoiceNumber: string;
  pdfUrl: string;
  totalAmount: string;
  shopName: string;
}

export interface EmailSendParams {
  recipientEmail: string;
  invoiceNumber: string;
  pdfUrl: string;
  totalAmount: string;
  shopName: string;
  pdfBuffer?: Buffer;
}

export interface ProviderSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface NotificationLogRecord {
  logId: number;
  invoiceId: number;
  channel: NotificationChannel;
  recipient: string;
  status: NotificationStatus;
  attempts: number;
  providerMessageId: string | null;
  errorMessage: string | null;
  lastAttemptAt: string | null;
  createdAt: string;
}
