import { env } from '../../../config/env.js';
import { WhatsAppSendParams, ProviderSendResult } from '../notification.types.js';

export class WhatsAppProvider {
  /**
   * Sends a WhatsApp document template message with the invoice PDF link.
   */
  async sendInvoiceMessage(params: WhatsAppSendParams): Promise<ProviderSendResult> {
    const { recipientPhone, invoiceNumber, pdfUrl, totalAmount, shopName } = params;

    // Simulated test failure or mock mode
    if (process.env.MOCK_WHATSAPP_FAIL === 'true') {
      throw new Error('Meta Cloud API simulated service error: 500 Internal Server Error');
    }

    // Live Meta WhatsApp Cloud API call
    if (env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID) {
      try {
        // Clean phone number (Indian format: 10 digits or with +91)
        let phone = recipientPhone.replace(/\D/g, '');
        if (phone.length === 10) {
          phone = `91${phone}`;
        }

        const url = `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
        const payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phone,
          type: 'template',
          template: {
            name: 'invoice_delivery_v1',
            language: { code: 'en' },
            components: [
              {
                type: 'header',
                parameters: [
                  {
                    type: 'document',
                    document: {
                      link: pdfUrl,
                      filename: `${invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
                    },
                  },
                ],
              },
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: shopName },
                  { type: 'text', text: invoiceNumber },
                  { type: 'text', text: totalAmount },
                ],
              },
            ],
          },
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData: any = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `Meta Cloud API HTTP ${res.status}`);
        }

        const data: any = await res.json();
        const messageId = data?.messages?.[0]?.id || `wamid.${Date.now()}`;
        return {
          success: true,
          providerMessageId: messageId,
        };
      } catch (err: any) {
        throw new Error(`WhatsApp Meta API error: ${err.message}`);
      }
    }

    // Default development/CI mock simulator (auto-succeed)
    return {
      success: true,
      providerMessageId: `mock-wamid-${Date.now()}`,
    };
  }
}

export const whatsappProvider = new WhatsAppProvider();
