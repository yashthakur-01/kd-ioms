import { query } from '../config/db.js';
import { getInvoicePdfSignedUrl } from '../utils/storage.js';
import { whatsappProvider } from '../modules/notification/providers/whatsapp.provider.js';
import { emailProvider } from '../modules/notification/providers/email.provider.js';

export interface RetryJobResult {
  processed: number;
  succeeded: number;
  failed: number;
}

/**
 * Background worker job that selects notification logs that are not SENT
 * with fewer than 3 attempts and retries them.
 */
export async function processNotificationRetries(): Promise<RetryJobResult> {
  const pendingRes = await query(
    `SELECT
       nl.log_id,
       nl.invoice_id,
       nl.channel,
       nl.recipient,
       nl.attempts,
       i.invoice_number,
       i.total,
       i.pdf_path,
       i.billed_to,
       rp.shop_name
     FROM notification_logs nl
     JOIN invoices i ON nl.invoice_id = i.invoice_id
     LEFT JOIN retailer_profiles rp ON i.retailer_id = rp.user_id
     WHERE nl.status != 'SENT' AND nl.attempts < 3
     ORDER BY nl.log_id ASC
     LIMIT 50`
  );

  let succeeded = 0;
  let failed = 0;

  for (const row of pendingRes.rows) {
    const attempts = row.attempts + 1;
    const billedTo = typeof row.billed_to === 'string' ? JSON.parse(row.billed_to) : row.billed_to;
    const shopName = row.shop_name || billedTo?.shopName || 'Pharmacy';
    const totalAmount = parseFloat(row.total).toFixed(2);
    const pdfUrl = await getInvoicePdfSignedUrl(row.pdf_path || '', 86400);

    try {
      let sendResult;
      if (row.channel === 'WHATSAPP') {
        sendResult = await whatsappProvider.sendInvoiceMessage({
          recipientPhone: row.recipient,
          invoiceNumber: row.invoice_number,
          pdfUrl,
          totalAmount,
          shopName,
        });
      } else {
        sendResult = await emailProvider.sendInvoiceEmail({
          recipientEmail: row.recipient,
          invoiceNumber: row.invoice_number,
          pdfUrl,
          totalAmount,
          shopName,
        });
      }

      await query(
        `UPDATE notification_logs
         SET status = 'SENT',
             attempts = $1,
             provider_message_id = $2,
             last_attempt_at = NOW(),
             error_message = NULL
         WHERE log_id = $3`,
        [attempts, sendResult.providerMessageId, row.log_id]
      );
      succeeded++;
    } catch (err: any) {
      await query(
        `UPDATE notification_logs
         SET attempts = $1,
             error_message = $2,
             last_attempt_at = NOW(),
             status = CASE WHEN $1 >= 3 THEN 'FAILED' ELSE status END
         WHERE log_id = $3`,
        [attempts, err.message, row.log_id]
      );
      failed++;
    }
  }

  return {
    processed: pendingRes.rowCount || 0,
    succeeded,
    failed,
  };
}
