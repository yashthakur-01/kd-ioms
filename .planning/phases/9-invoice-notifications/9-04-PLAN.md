# Plan 9-04: Multi-Channel Cascade Notification Service & Providers

**Phase:** Phase 9 — Invoicing and Multi-Channel Notifications  
**Plan ID:** `9-04`  
**Wave:** 4 (Notification Engine & Fallback Cascade)  
**Dependencies:** Plan 9-03  
**Responsible Developer:** `dev3`  

---

## 1. Objective

Implement the multi-channel notification infrastructure: WhatsApp provider using Meta Cloud API, Email provider using Nodemailer SMTP, cascade dispatcher with automatic email fallback, mock simulator for local/CI environments, and a scheduled background worker `jobs/notification-retry.ts` to retry failed dispatches with exponential backoff up to 3 attempts.

---

## 2. Tasks & Detailed Instructions

### Task 1: Notification Providers (`backend/src/modules/notification/providers/`)
- `whatsapp.provider.ts`:
  - Interface `WhatsAppSendParams`: `{ recipientPhone: string, invoiceNumber: string, pdfUrl: string, totalAmount: string, shopName: string }`.
  - When `env.WHATSAPP_ACCESS_TOKEN` and `env.WHATSAPP_PHONE_NUMBER_ID` are configured:
    - Post to Meta Graph API endpoint: `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`.
    - Payload uses configured template with invoice document URL parameter.
    - Returns `{ success: true, providerMessageId: res.messages[0].id }` or throws error.
  - When credentials are unset (local dev / CI):
    - Check for simulated test failure flag (`process.env.MOCK_WHATSAPP_FAIL === 'true'`).
    - If failure simulated, throws `new Error('Simulated Meta Cloud API network failure')`.
    - Otherwise, logs info and returns `{ success: true, providerMessageId: 'mock-wamid-' + Date.now() }`.
- `email.provider.ts`:
  - Interface `EmailSendParams`: `{ recipientEmail: string, invoiceNumber: string, pdfBuffer?: Buffer, pdfUrl?: string, totalAmount: string, shopName: string }`.
  - When `env.SMTP_HOST` is configured:
    - Sends email via `nodemailer.createTransport(...)`.
    - Subject: `Tax Invoice ${invoiceNumber} from Kandarp Drugs`.
    - HTML body with wholesale invoice summary and download button, plus attached PDF buffer if available.
    - Returns `{ success: true, providerMessageId: info.messageId }`.
  - When credentials are unset:
    - Check for simulated failure flag (`process.env.MOCK_EMAIL_FAIL === 'true'`).
    - If failure simulated, throws `new Error('Simulated SMTP connection failure')`.
    - Otherwise, logs info and returns `{ success: true, providerMessageId: 'mock-email-' + Date.now() }`.

### Task 2: Notification Service & Cascade Logic (`backend/src/modules/notification/notification.service.ts`)
- Implement `sendInvoiceNotification(invoiceId: number, options?: { forceChannel?: 'WHATSAPP' | 'EMAIL' }): Promise<NotificationLogDto[]>`:
  - Fetch invoice record, order, and retailer profile (including phone, whatsapp_number, and email).
  - Generate temporary signed PDF URL via `getInvoicePdfSignedUrl(invoice.pdf_path, 86400)` (24-hour validity for notification).
  - If channel is not forced or is `WHATSAPP`:
    - Insert row into `notification_logs` (`invoice_id`, channel `'WHATSAPP'`, recipient phone, status `'PENDING'`, attempts 1, last_attempt_at `NOW()`).
    - Attempt `whatsappProvider.send(...)`.
    - On success: update row status to `'SENT'`, set `provider_message_id`.
    - On failure: update row status to `'FAILED'`, record `error_message`.
      - **Trigger Email Fallback:** If retailer has a valid email address:
        - Insert row into `notification_logs` (`invoice_id`, channel `'EMAIL'`, recipient email, status `'PENDING'`, attempts 1, last_attempt_at `NOW()`).
        - Attempt `emailProvider.send(...)`.
        - On success: update row status to `'SENT'`, set `provider_message_id`.
        - On failure: update row status to `'FAILED'`, record `error_message`.
  - If forced channel is `EMAIL`:
    - Directly attempt email send and log outcomes.
  - Return all updated `notification_logs` for this dispatch.

### Task 3: Retry Background Job (`backend/src/jobs/notification-retry.ts`)
- Implement `processNotificationRetries(): Promise<{ retriedCount: number, successCount: number, failedCount: number }>`:
  - Query rows in `notification_logs` where `status != 'SENT'` and `attempts < 3`.
  - For each row:
    - Increment `attempts`, update `last_attempt_at = NOW()`.
    - Retry dispatch via respective provider.
    - If successful, mark `status = 'SENT'`, set `provider_message_id`.
    - If failed and `attempts >= 3`, mark final status `'FAILED'`.

### Task 4: Unit & Integration Tests (`backend/src/modules/notification/__tests__/notification.test.ts`)
- Test cases:
  1. WhatsApp primary success creates 1 `notification_logs` row with status `SENT`.
  2. WhatsApp failure triggers immediate email fallback, resulting in 2 log rows (WhatsApp: `FAILED`, Email: `SENT`).
  3. Retailer without email only receives WhatsApp attempt; when failed, no email row is created.
  4. Retry worker picks failed rows, retries them, and caps at 3 attempts.

---

## 3. Verification Criteria

- [ ] Multi-channel cascade runs automatically on invoice generation.
- [ ] WhatsApp failure correctly triggers Nodemailer email fallback.
- [ ] Retry job terminates after 3 failed attempts.
- [ ] Automated tests pass cleanly with `npm test`.
