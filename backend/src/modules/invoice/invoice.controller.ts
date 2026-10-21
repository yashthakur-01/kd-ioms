import { Request, Response } from 'express';
import { invoiceService } from './invoice.service.js';
import { notificationService } from '../notification/notification.service.js';
import { getInvoicePdfSignedUrl } from '../../utils/storage.js';
import {
  listInvoicesQuerySchema,
  invoiceIdParamSchema,
  resendInvoiceBodySchema,
} from './invoice.validation.js';
import { ok } from '../../utils/response.js';
import { ValidationError, NotFoundError } from '../../errors/app-error.js';
import { ERROR_CODES } from '../../constants/error-codes.js';
import { USER_ROLE } from '../../enums/user-role.enum.js';

export class InvoiceController {
  /**
   * GET /api/v1/invoices
   */
  async listInvoices(req: Request, res: Response) {
    const parsed = listInvoicesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid invoices query parameters',
        errors: parsed.error.issues.map((i) => ({
          field: i.path.join('.'),
          code: i.code,
          message: i.message,
        })),
      });
    }

    const user = (req as any).user;
    let targetRetailerId = parsed.data.retailerId;

    // Retailer is strictly locked to their own invoices (ADR-043)
    if (user.role === USER_ROLE.RETAILER) {
      targetRetailerId = user.userId;
    }

    const { items, meta } = await invoiceService.listInvoices({
      retailerId: targetRetailerId,
      from: parsed.data.from,
      to: parsed.data.to,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });

    return ok(res, {
      code: 'INVOICES_RETRIEVED',
      message: 'Invoices retrieved successfully',
      data: items,
      meta,
    });
  }

  /**
   * GET /api/v1/invoices/:invoiceId
   */
  async getInvoiceById(req: Request, res: Response) {
    const paramParsed = invoiceIdParamSchema.safeParse(req.params);
    if (!paramParsed.success) {
      throw new ValidationError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'A valid positive integer invoiceId is required in path parameter',
      });
    }

    const { invoiceId } = paramParsed.data;
    const user = (req as any).user;
    const invoice = await invoiceService.getInvoiceById(invoiceId);

    // Tenant Isolation Check
    if (user.role === USER_ROLE.RETAILER && invoice.retailerId !== user.userId) {
      throw new NotFoundError({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Invoice not found',
      });
    }

    return ok(res, {
      code: 'INVOICE_RETRIEVED',
      message: 'Invoice retrieved successfully',
      data: invoice,
    });
  }

  /**
   * GET /api/v1/invoices/:invoiceId/pdf
   */
  async getInvoicePdf(req: Request, res: Response) {
    const paramParsed = invoiceIdParamSchema.safeParse(req.params);
    if (!paramParsed.success) {
      throw new ValidationError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'A valid positive integer invoiceId is required in path parameter',
      });
    }

    const { invoiceId } = paramParsed.data;
    const user = (req as any).user;
    const invoice = await invoiceService.getInvoiceById(invoiceId);

    // Tenant Isolation Check
    if (user.role === USER_ROLE.RETAILER && invoice.retailerId !== user.userId) {
      throw new NotFoundError({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Invoice not found',
      });
    }

    // Ensure PDF is generated and uploaded to Supabase Storage
    const { url, pdfPath } = await invoiceService.ensureInvoicePdf(invoiceId, 300);

    return ok(res, {
      code: 'INVOICE_PDF_URL_GENERATED',
      message: 'Signed PDF download URL generated successfully',
      data: {
        url,
        pdfPath,
        expiresIn: 300,
      },
    });
  }

  /**
   * GET /api/v1/invoices/:invoiceId/download
   * Streams PDF directly or redirects to signed Supabase URL
   */
  async downloadInvoicePdf(req: Request, res: Response) {
    const paramParsed = invoiceIdParamSchema.safeParse(req.params);
    if (!paramParsed.success) {
      throw new ValidationError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'A valid positive integer invoiceId is required in path parameter',
      });
    }

    const { invoiceId } = paramParsed.data;
    const user = (req as any).user;
    const invoice = await invoiceService.getInvoiceById(invoiceId);

    if (user.role === USER_ROLE.RETAILER && invoice.retailerId !== user.userId) {
      throw new NotFoundError({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Invoice not found',
      });
    }

    const { url, pdfBuffer } = await invoiceService.ensureInvoicePdf(invoiceId, 300);

    if (pdfBuffer) {
      const safeName = invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Invoice-${safeName}.pdf"`);
      return res.send(pdfBuffer);
    }

    return res.redirect(302, url);
  }

  /**
   * POST /api/v1/invoices/generate/:orderId
   * Explicitly generates or retrieves invoice for any DELIVERED order
   */
  async generateInvoiceForOrder(req: Request, res: Response) {
    const orderId = parseInt(String(req.params.orderId), 10);
    if (isNaN(orderId) || orderId <= 0) {
      throw new ValidationError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'A valid positive integer orderId is required',
      });
    }

    const invoice = await invoiceService.generateInvoice(orderId);
    return ok(res, {
      code: 'INVOICE_GENERATED',
      message: 'Invoice generated successfully for order',
      data: invoice,
    });
  }

  /**
   * POST /api/v1/invoices/:invoiceId/resend
   */
  async resendNotification(req: Request, res: Response) {
    const paramParsed = invoiceIdParamSchema.safeParse(req.params);
    if (!paramParsed.success) {
      throw new ValidationError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'A valid positive integer invoiceId is required in path parameter',
      });
    }

    const bodyParsed = resendInvoiceBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      throw new ValidationError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid notification resend payload',
        errors: bodyParsed.error.issues.map((i) => ({
          field: i.path.join('.'),
          code: i.code,
          message: i.message,
        })),
      });
    }

    const { invoiceId } = paramParsed.data;
    const logs = await notificationService.sendInvoiceNotification(invoiceId, {
      forceChannel: bodyParsed.data.channel,
    });

    return res.status(202).json({
      success: true,
      code: 'NOTIFICATION_RESENT',
      message: 'Invoice notification dispatch queued',
      data: {
        invoiceId,
        logs,
      },
    });
  }
}

export const invoiceController = new InvoiceController();
