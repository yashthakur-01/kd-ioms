import nodemailer from 'nodemailer';
import { env } from '../../../config/env.js';
import { EmailSendParams, ProviderSendResult } from '../notification.types.js';

export class EmailProvider {
  /**
   * Sends an email notification with the invoice summary and PDF link/attachment.
   */
  async sendInvoiceEmail(params: EmailSendParams): Promise<ProviderSendResult> {
    const { recipientEmail, invoiceNumber, pdfUrl, totalAmount, shopName } = params;

    // Simulated test failure or mock mode
    if (process.env.MOCK_EMAIL_FAIL === 'true') {
      throw new Error('SMTP simulated service error: 535 Authentication Credentials Invalid');
    }

    // Live Nodemailer SMTP call
    if (env.SMTP_HOST && env.SMTP_USER) {
      try {
        const transporter = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
          auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          },
        });

        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #0f172a; margin-top: 0;">Kandarp Drugs — Wholesale Pharmaceuticals</h2>
            <p>Dear <strong>${shopName}</strong>,</p>
            <p>Your order has been delivered and your Tax Invoice has been generated.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Invoice Number:</td>
                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${invoiceNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Total Amount:</td>
                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">Rs ${totalAmount}</td>
              </tr>
            </table>
            <p style="margin-top: 25px;">
              <a href="${pdfUrl}" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Download Invoice PDF</a>
            </p>
            <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
              This is an automated tax invoice notification from Kandarp Drugs. If you have questions regarding your order, please contact billing support.
            </p>
          </div>
        `;

        const info = await transporter.sendMail({
          from: env.EMAIL_FROM || '"Kandarp Drugs" <no-reply@kandarpdrugs.com>',
          to: recipientEmail,
          subject: `Tax Invoice ${invoiceNumber} — Kandarp Drugs`,
          html,
        });

        return {
          success: true,
          providerMessageId: info.messageId,
        };
      } catch (err: any) {
        throw new Error(`Email SMTP error: ${err.message}`);
      }
    }

    // Default development/CI mock simulator (auto-succeed)
    return {
      success: true,
      providerMessageId: `mock-email-${Date.now()}`,
    };
  }
}

export const emailProvider = new EmailProvider();
