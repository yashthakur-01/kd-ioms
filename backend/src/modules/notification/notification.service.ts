import { query } from '../../config/db.js';
import { getInvoicePdfSignedUrl } from '../../utils/storage.js';
import { whatsappProvider } from './providers/whatsapp.provider.js';
import { emailProvider } from './providers/email.provider.js';
import {
  NotificationChannel,
  NotificationLogRecord,
} from './notification.types.js';
import { NotFoundError, ValidationError } from '../../errors/app-error.js';
import { ERROR_CODES } from '../../constants/error-codes.js';

export class NotificationService {
  /**
   * Dispatches invoice notification using cascade strategy:
   * 1. Try WhatsApp primary.
   * 2. If WhatsApp fails and retailer has an email, cascade to Email fallback.
   * If forceChannel is specified (e.g. via admin resend), only dispatches on that channel.
   */
  async sendInvoiceNotification(
    invoiceId: number,
    options?: { forceChannel?: NotificationChannel }
  ): Promise<NotificationLogRecord[]> {
    const invRes = await query(
      `SELECT
         i.invoice_id,
         i.invoice_number,
         i.total,
         i.pdf_path,
         i.billed_to,
         u.email AS user_email,
         u.phone AS user_phone,
         rp.shop_name,
         rp.whatsapp_number
       FROM invoices i
       JOIN users u ON i.retailer_id = u.id
       LEFT JOIN retailer_profiles rp ON u.id = rp.user_id
       WHERE i.invoice_id = $1`,
      [invoiceId]
    );

    if (invRes.rowCount === 0) {
      throw new NotFoundError({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Invoice not found',
      });
    }

    const invoice = invRes.rows[0];
    const billedTo = typeof invoice.billed_to === 'string' ? JSON.parse(invoice.billed_to) : invoice.billed_to;
    const shopName = invoice.shop_name || billedTo?.shopName || 'Valued Pharmacy';
    const recipientPhone = invoice.whatsapp_number || billedTo?.phone || invoice.user_phone;
    const recipientEmail = invoice.user_email;

    const pdfUrl = await getInvoicePdfSignedUrl(invoice.pdf_path || '', 86400);
    const totalAmount = parseFloat(invoice.total).toFixed(2);

    const createdLogs: NotificationLogRecord[] = [];
    const forceChannel = options?.forceChannel;

    // DIRECT EMAIL CHANNEL DISPATCH
    if (forceChannel === 'EMAIL') {
      if (!recipientEmail) {
        throw new ValidationError({
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Retailer has no email address configured for email notification',
        });
      }

      const logRes = await query(
        `INSERT INTO notification_logs (
           invoice_id, channel, recipient, status, attempts, last_attempt_at
         )
         VALUES ($1, 'EMAIL', $2, 'PENDING', 1, NOW())
         RETURNING *`,
        [invoiceId, recipientEmail]
      );
      const log = logRes.rows[0];

      try {
        const sendResult = await emailProvider.sendInvoiceEmail({
          recipientEmail,
          invoiceNumber: invoice.invoice_number,
          pdfUrl,
          totalAmount,
          shopName,
        });

        const updateRes = await query(
          `UPDATE notification_logs
           SET status = 'SENT',
               provider_message_id = $1,
               last_attempt_at = NOW()
           WHERE log_id = $2
           RETURNING *`,
          [sendResult.providerMessageId, log.log_id]
        );
        createdLogs.push(this.mapLogRow(updateRes.rows[0]));
      } catch (err: any) {
        const updateRes = await query(
          `UPDATE notification_logs
           SET status = 'FAILED',
               error_message = $1,
               last_attempt_at = NOW()
           WHERE log_id = $2
           RETURNING *`,
          [err.message, log.log_id]
        );
        createdLogs.push(this.mapLogRow(updateRes.rows[0]));
      }

      return createdLogs;
    }

    // PRIMARY WHATSAPP DISPATCH (or forceChannel === 'WHATSAPP')
    const waLogRes = await query(
      `INSERT INTO notification_logs (
         invoice_id, channel, recipient, status, attempts, last_attempt_at
       )
       VALUES ($1, 'WHATSAPP', $2, 'PENDING', 1, NOW())
       RETURNING *`,
      [invoiceId, recipientPhone]
    );
    const waLog = waLogRes.rows[0];

    let waSuccess = false;
    try {
      const sendResult = await whatsappProvider.sendInvoiceMessage({
        recipientPhone,
        invoiceNumber: invoice.invoice_number,
        pdfUrl,
        totalAmount,
        shopName,
      });

      const updateRes = await query(
        `UPDATE notification_logs
         SET status = 'SENT',
             provider_message_id = $1,
             last_attempt_at = NOW()
         WHERE log_id = $2
         RETURNING *`,
        [sendResult.providerMessageId, waLog.log_id]
      );
      createdLogs.push(this.mapLogRow(updateRes.rows[0]));
      waSuccess = true;
    } catch (err: any) {
      const updateRes = await query(
        `UPDATE notification_logs
         SET status = 'FAILED',
             error_message = $1,
             last_attempt_at = NOW()
         WHERE log_id = $2
         RETURNING *`,
        [err.message, waLog.log_id]
      );
      createdLogs.push(this.mapLogRow(updateRes.rows[0]));
    }

    // CASCADE TO EMAIL ON WHATSAPP FAILURE (ADR-042)
    if (!waSuccess && !forceChannel && recipientEmail) {
      const emailLogRes = await query(
        `INSERT INTO notification_logs (
           invoice_id, channel, recipient, status, attempts, last_attempt_at
         )
         VALUES ($1, 'EMAIL', $2, 'PENDING', 1, NOW())
         RETURNING *`,
        [invoiceId, recipientEmail]
      );
      const emailLog = emailLogRes.rows[0];

      try {
        const sendResult = await emailProvider.sendInvoiceEmail({
          recipientEmail,
          invoiceNumber: invoice.invoice_number,
          pdfUrl,
          totalAmount,
          shopName,
        });

        const updateRes = await query(
          `UPDATE notification_logs
           SET status = 'SENT',
               provider_message_id = $1,
               last_attempt_at = NOW()
           WHERE log_id = $2
           RETURNING *`,
          [sendResult.providerMessageId, emailLog.log_id]
        );
        createdLogs.push(this.mapLogRow(updateRes.rows[0]));
      } catch (err: any) {
        const updateRes = await query(
          `UPDATE notification_logs
           SET status = 'FAILED',
               error_message = $1,
               last_attempt_at = NOW()
           WHERE log_id = $2
           RETURNING *`,
          [err.message, emailLog.log_id]
        );
        createdLogs.push(this.mapLogRow(updateRes.rows[0]));
      }
    }

    return createdLogs;
  }

  private mapLogRow(row: any): NotificationLogRecord {
    return {
      logId: row.log_id,
      invoiceId: row.invoice_id,
      channel: row.channel,
      recipient: row.recipient,
      status: row.status,
      attempts: row.attempts,
      providerMessageId: row.provider_message_id || null,
      errorMessage: row.error_message || null,
      lastAttemptAt: row.last_attempt_at ? new Date(row.last_attempt_at).toISOString() : null,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }
}

export const notificationService = new NotificationService();
