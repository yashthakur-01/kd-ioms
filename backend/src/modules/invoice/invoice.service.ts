import { query, withTransaction } from '../../config/db.js';
import { toPaise, fromPaise, roundHalfUp, calculateGstAmount } from '../../utils/money.js';
import { todayIst, financialYearOf } from '../../utils/dates.js';
import { env } from '../../config/env.js';
import { uploadInvoicePdf, getInvoicePdfSignedUrl } from '../../utils/storage.js';
import { buildInvoicePdf, type InvoicePdfLine } from './invoice.pdf.js';
import {
  InvoiceDto,
  InvoiceLineDto,
  InvoiceSummaryDto,
  BilledToSnapshot,
  InvoiceNotificationLogDto,
} from './invoice.types.js';
import { NotFoundError, ConflictError, ValidationError } from '../../errors/app-error.js';
import { ERROR_CODES } from '../../constants/error-codes.js';
import { notificationService } from '../notification/notification.service.js';

export class InvoiceService {
  /**
   * Generates a tax invoice for a DELIVERED order.
   * If an invoice already exists for the order, returns it idempotently without generating a new one.
   */
  async generateInvoice(orderId: number, externalClient?: any): Promise<InvoiceDto> {
    const dbClient = externalClient || { query };

    // 1. Idempotency Check
    const existingRes = await dbClient.query(
      `SELECT * FROM invoices WHERE order_id = $1`,
      [orderId]
    );

    if (existingRes.rowCount > 0) {
      return this.mapInvoiceRow(existingRes.rows[0], dbClient);
    }

    // 2. Fetch Order & Retailer Data
    const orderRes = await dbClient.query(
      `SELECT
         o.order_id,
         o.order_number,
         o.status,
         o.created_at,
         o.retailer_id,
         u.username,
         u.phone AS user_phone,
         u.email AS user_email,
         rp.shop_name,
         rp.contact_person,
         rp.address_line,
         rp.city,
         rp.state,
         rp.pincode,
         rp.whatsapp_number,
         rp.gstin,
         rp.drug_license_number
       FROM orders o
       JOIN users u ON o.retailer_id = u.id
       LEFT JOIN retailer_profiles rp ON u.id = rp.user_id
       WHERE o.order_id = $1`,
      [orderId]
    );

    if (orderRes.rowCount === 0) {
      throw new NotFoundError({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Order not found',
      });
    }

    const order = orderRes.rows[0];

    if (order.status !== 'DELIVERED') {
      throw new ConflictError({
        code: ERROR_CODES.INVALID_STATE_TRANSITION,
        message: `Cannot generate invoice for order with status '${order.status}'. Order must be DELIVERED.`,
      });
    }

    // 3. Fetch ONLY Accepted Lines and Their Allocations
    const linesRes = await dbClient.query(
      `SELECT
         oi.order_item_id,
         oi.medicine_id,
         m.name AS medicine_name,
         m.pack_size,
         m.gst_rate,
         oa.allocation_id,
         oa.batch_id,
         oa.quantity AS allocated_quantity,
         b.batch_number,
         b.expiry_date,
         b.mrp,
         b.selling_price
       FROM order_items oi
       JOIN medicines m ON oi.medicine_id = m.medicine_id
       JOIN order_allocations oa ON oi.order_item_id = oa.order_item_id
       JOIN batches b ON oa.batch_id = b.batch_id
       WHERE oi.order_id = $1 AND oi.delivery_status = 'ACCEPTED'
       ORDER BY oi.order_item_id ASC, oa.allocation_id ASC`,
      [orderId]
    );

    if (linesRes.rowCount === 0) {
      throw new ValidationError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Cannot generate invoice for order without accepted line items',
      });
    }

    // 4. Financial Calculations (Integer Paise Mathematics - ADR-006, ADR-040)
    let subtotalPaise = 0;
    let totalGstPaise = 0;
    const lines: InvoiceLineDto[] = [];
    const pdfLines: InvoicePdfLine[] = [];

    linesRes.rows.forEach((row: any, idx: number) => {
      const quantity = Number(row.allocated_quantity);
      const unitSellingPaise = toPaise(row.selling_price);
      const lineTotalPaise = unitSellingPaise * quantity;
      const gstRate = Number(row.gst_rate);
      const lineGstPaise = calculateGstAmount(lineTotalPaise, gstRate);

      subtotalPaise += lineTotalPaise;
      totalGstPaise += lineGstPaise;

      lines.push({
        orderItemId: row.order_item_id,
        medicineId: row.medicine_id,
        medicineName: row.medicine_name,
        packSize: row.pack_size,
        batchId: row.batch_id,
        batchNumber: row.batch_number,
        expiryDate: row.expiry_date instanceof Date ? row.expiry_date.toISOString().slice(0, 10) : String(row.expiry_date).slice(0, 10),
        quantity,
        mrp: parseFloat(row.mrp).toFixed(2),
        unitPrice: fromPaise(unitSellingPaise),
        gstRate,
        gstAmount: fromPaise(lineGstPaise),
        lineTotal: fromPaise(lineTotalPaise),
      });

      // Format expiry for PDF (MM/YY)
      let expFormatted = String(row.expiry_date);
      if (expFormatted.includes('-')) {
        const parts = expFormatted.split('-');
        if (parts.length >= 2) {
          expFormatted = `${parts[1]}/${parts[0]?.slice(-2)}`;
        }
      }

      pdfLines.push({
        serialNo: idx + 1,
        medicineName: row.medicine_name,
        packSize: row.pack_size,
        batchNumber: row.batch_number,
        expiryDate: expFormatted,
        quantity,
        mrp: parseFloat(row.mrp).toFixed(2),
        rate: fromPaise(unitSellingPaise),
        amount: fromPaise(lineTotalPaise),
      });
    });

    const netPaise = subtotalPaise + totalGstPaise;
    const roundedNetPaise = roundHalfUp(netPaise / 100) * 100;
    const roundOffPaise = roundedNetPaise - netPaise;
    const grandTotalPaise = roundedNetPaise;

    const subtotalStr = fromPaise(subtotalPaise);
    const gstAmountStr = fromPaise(totalGstPaise);
    const roundOffStr = fromPaise(roundOffPaise);
    const totalStr = fromPaise(grandTotalPaise);

    // 5. Billed-To Snapshot
    const billedTo: BilledToSnapshot = {
      shopName: order.shop_name || order.username,
      contactPerson: order.contact_person || undefined,
      addressLine: order.address_line || '',
      city: order.city || '',
      state: order.state || 'Gujarat',
      pincode: order.pincode || '',
      phone: order.whatsapp_number || order.user_phone,
      whatsappNumber: order.whatsapp_number || order.user_phone,
      gstin: order.gstin || undefined,
      drugLicenseNumber: order.drug_license_number || undefined,
    };

    // 6. Business Profile
    const settingsRes = await dbClient.query(
      `SELECT value FROM app_settings WHERE key = 'business_profile'`
    );
    const businessProfile = settingsRes.rows[0]?.value || {
      name: 'Kandarp Drugs',
      address: '123 Wholesale Market, Ahmedabad, Gujarat',
      gstin: '24AAAAA0000A1Z5',
      drugLicenseNumber: 'GJ-AHM-123456',
      phone: '+919876543210',
      email: 'billing@kandarpdrugs.com',
    };

    // 7. Indian Financial Year Sequence (ADR-039)
    const today = todayIst();
    const fy = financialYearOf(today);
    let invoiceNumber: string;

    try {
      const seqRes = await dbClient.query(
        `SELECT next_invoice_number_for_fy($1)`,
        [fy]
      );
      invoiceNumber = seqRes.rows[0].next_invoice_number_for_fy;
    } catch {
      // Fallback in environments without the db function loaded
      invoiceNumber = `INV/${fy}/${String(Date.now()).slice(-5)}`;
    }

    // 8. Format Dates for PDF
    const formatDateDmY = (dStr: string | Date) => {
      const d = new Date(dStr);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };

    // 9. Build and Upload PDF
    let pdfPath: string | null = null;
    try {
      const pdfBuffer = await buildInvoicePdf({
        invoiceNumber,
        invoiceDate: formatDateDmY(new Date()),
        orderNumber: order.order_number,
        orderDate: formatDateDmY(order.created_at),
        business: businessProfile,
        billedTo,
        lines: pdfLines,
        subtotal: subtotalStr,
        gstAmount: gstAmountStr,
        roundOff: roundOffStr,
        total: totalStr,
      });

      pdfPath = await uploadInvoicePdf(pdfBuffer, invoiceNumber);
    } catch (pdfErr: any) {
      console.error('[INVOICE PDF ERROR] Failed to generate/upload PDF:', pdfErr.message);
    }

    // 10. Insert Record into Invoices Table
    const insertRes = await dbClient.query(
      `INSERT INTO invoices (
         invoice_number,
         order_id,
         retailer_id,
         billed_to,
         subtotal,
         gst_amount,
         round_off,
         total,
         pdf_path,
         generated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING *`,
      [
        invoiceNumber,
        orderId,
        order.retailer_id,
        JSON.stringify(billedTo),
        subtotalStr,
        gstAmountStr,
        roundOffStr,
        totalStr,
        pdfPath,
      ]
    );

    const insertedRow = insertRes.rows[0];

    // Auto-dispatch notification asynchronously post-creation
    notificationService.sendInvoiceNotification(insertedRow.invoice_id).catch((err) => {
      console.error(`[INVOICE AUTO-NOTIFY FAILED] Invoice #${insertedRow.invoice_id}:`, err.message);
    });

    return {
      invoiceId: insertedRow.invoice_id,
      invoiceNumber: insertedRow.invoice_number,
      orderId: insertedRow.order_id,
      orderNumber: order.order_number,
      retailerId: insertedRow.retailer_id,
      billedTo,
      subtotal: parseFloat(insertedRow.subtotal).toFixed(2),
      gstAmount: parseFloat(insertedRow.gst_amount).toFixed(2),
      roundOff: parseFloat(insertedRow.round_off).toFixed(2),
      total: parseFloat(insertedRow.total).toFixed(2),
      pdfPath: insertedRow.pdf_path,
      generatedAt: new Date(insertedRow.generated_at).toISOString(),
      lines,
    };
  }

  /**
   * Retrieves an invoice by ID with full lines and notification history.
   */
  async getInvoiceById(invoiceId: number, externalClient?: any): Promise<InvoiceDto> {
    const dbClient = externalClient || { query };

    const invRes = await dbClient.query(
      `SELECT * FROM invoices WHERE invoice_id = $1`,
      [invoiceId]
    );

    if (invRes.rowCount === 0) {
      throw new NotFoundError({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Invoice not found',
      });
    }

    return this.mapInvoiceRow(invRes.rows[0], dbClient);
  }

  /**
   * Retrieves an invoice by Order ID.
   */
  async getInvoiceByOrderId(orderId: number, externalClient?: any): Promise<InvoiceDto | null> {
    const dbClient = externalClient || { query };

    const invRes = await dbClient.query(
      `SELECT * FROM invoices WHERE order_id = $1`,
      [orderId]
    );

    if (invRes.rowCount === 0) {
      return null;
    }

    return this.mapInvoiceRow(invRes.rows[0], dbClient);
  }

  /**
   * Lists invoices with filtering and pagination.
   */
  async listInvoices(params: {
    retailerId?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: InvoiceSummaryDto[]; meta: { page: number; pageSize: number; totalItems: number; totalPages: number } }> {
    const { retailerId, from, to, page = 1, pageSize = 20 } = params;
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (retailerId) {
      conditions.push(`i.retailer_id = $${idx++}`);
      values.push(retailerId);
    }
    if (from) {
      conditions.push(`i.generated_at >= $${idx++}::date`);
      values.push(from);
    }
    if (to) {
      conditions.push(`i.generated_at < ($${idx++}::date + interval '1 day')`);
      values.push(to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) FROM invoices i ${whereClause}`;
    const countRes = await query(countSql, values);
    const totalItems = parseInt(countRes.rows[0]?.count || '0', 10);
    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    const listSql = `
      SELECT
        i.invoice_id,
        i.invoice_number,
        i.order_id,
        o.order_number,
        i.retailer_id,
        i.billed_to->>'shopName' AS shop_name,
        i.subtotal,
        i.gst_amount,
        i.round_off,
        i.total,
        i.pdf_path,
        i.generated_at,
        nl.channel AS notif_channel,
        nl.status AS notif_status
      FROM invoices i
      JOIN orders o ON i.order_id = o.order_id
      LEFT JOIN LATERAL (
        SELECT channel, status
        FROM notification_logs
        WHERE invoice_id = i.invoice_id
        ORDER BY log_id DESC
        LIMIT 1
      ) nl ON true
      ${whereClause}
      ORDER BY i.invoice_id DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    const listRes = await query(listSql, [...values, pageSize, offset]);

    const items: InvoiceSummaryDto[] = listRes.rows.map((row: any) => ({
      invoiceId: row.invoice_id,
      invoiceNumber: row.invoice_number,
      orderId: row.order_id,
      orderNumber: row.order_number,
      retailerId: row.retailer_id,
      shopName: row.shop_name || 'Pharmacy',
      subtotal: parseFloat(row.subtotal).toFixed(2),
      gstAmount: parseFloat(row.gst_amount).toFixed(2),
      roundOff: parseFloat(row.round_off).toFixed(2),
      total: parseFloat(row.total).toFixed(2),
      pdfPath: row.pdf_path,
      generatedAt: new Date(row.generated_at).toISOString(),
      latestNotification: row.notif_channel
        ? { channel: row.notif_channel, status: row.notif_status }
        : null,
    }));

    return {
      items,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    };
  }

  /**
   * Helper to map raw database invoice row to InvoiceDto with line items and notification logs.
   */
  private async mapInvoiceRow(row: any, dbClient: any): Promise<InvoiceDto> {
    const orderRes = await dbClient.query(
      `SELECT order_number FROM orders WHERE order_id = $1`,
      [row.order_id]
    );
    const orderNumber = orderRes.rows[0]?.order_number || `ORD-${row.order_id}`;

    // Fetch accepted line items
    const linesRes = await dbClient.query(
      `SELECT
         oi.order_item_id,
         oi.medicine_id,
         m.name AS medicine_name,
         m.pack_size,
         m.gst_rate,
         oa.allocation_id,
         oa.batch_id,
         oa.quantity AS allocated_quantity,
         b.batch_number,
         b.expiry_date,
         b.mrp,
         b.selling_price
       FROM order_items oi
       JOIN medicines m ON oi.medicine_id = m.medicine_id
       JOIN order_allocations oa ON oi.order_item_id = oa.order_item_id
       JOIN batches b ON oa.batch_id = b.batch_id
       WHERE oi.order_id = $1 AND oi.delivery_status = 'ACCEPTED'
       ORDER BY oi.order_item_id ASC, oa.allocation_id ASC`,
      [row.order_id]
    );

    const lines: InvoiceLineDto[] = linesRes.rows.map((r: any) => {
      const quantity = Number(r.allocated_quantity);
      const unitSellingPaise = toPaise(r.selling_price);
      const lineTotalPaise = unitSellingPaise * quantity;
      const gstRate = Number(r.gst_rate);
      const lineGstPaise = calculateGstAmount(lineTotalPaise, gstRate);

      return {
        orderItemId: r.order_item_id,
        medicineId: r.medicine_id,
        medicineName: r.medicine_name,
        packSize: r.pack_size,
        batchId: r.batch_id,
        batchNumber: r.batch_number,
        expiryDate: r.expiry_date instanceof Date ? r.expiry_date.toISOString().slice(0, 10) : String(r.expiry_date).slice(0, 10),
        quantity,
        mrp: parseFloat(r.mrp).toFixed(2),
        unitPrice: fromPaise(unitSellingPaise),
        gstRate,
        gstAmount: fromPaise(lineGstPaise),
        lineTotal: fromPaise(lineTotalPaise),
      };
    });

    // Fetch notification logs
    const notifRes = await dbClient.query(
      `SELECT * FROM notification_logs WHERE invoice_id = $1 ORDER BY log_id ASC`,
      [row.invoice_id]
    );

    const notifications: InvoiceNotificationLogDto[] = notifRes.rows.map((n: any) => ({
      logId: n.log_id,
      channel: n.channel,
      recipient: n.recipient,
      status: n.status,
      attempts: n.attempts,
      providerMessageId: n.provider_message_id,
      errorMessage: n.error_message,
      lastAttemptAt: n.last_attempt_at ? new Date(n.last_attempt_at).toISOString() : null,
      createdAt: new Date(n.created_at).toISOString(),
    }));

    const billedTo = typeof row.billed_to === 'string' ? JSON.parse(row.billed_to) : row.billed_to;

    return {
      invoiceId: row.invoice_id,
      invoiceNumber: row.invoice_number,
      orderId: row.order_id,
      orderNumber,
      retailerId: row.retailer_id,
      billedTo,
      subtotal: parseFloat(row.subtotal).toFixed(2),
      gstAmount: parseFloat(row.gst_amount).toFixed(2),
      roundOff: parseFloat(row.round_off).toFixed(2),
      total: parseFloat(row.total).toFixed(2),
      pdfPath: row.pdf_path,
      generatedAt: new Date(row.generated_at).toISOString(),
      lines,
      notifications,
    };
  }

  /**
   * Ensures that a valid PDF is generated and uploaded to Supabase Storage for the invoice.
   * If the PDF is missing, corrupt, or has a legacy local path, it regenerates the PDF from
   * invoice details and uploads it to Supabase Storage, updating invoices.pdf_path in DB.
   */
  async ensureInvoicePdf(
    invoiceId: number,
    expiresInSeconds: number = 300
  ): Promise<{ url: string; pdfPath: string; pdfBuffer?: Buffer }> {
    const invoice = await this.getInvoiceById(invoiceId);

    const bucketName = env.SUPABASE_STORAGE_BUCKET || 'invoices';
    const isSupabasePath = invoice.pdfPath && invoice.pdfPath.startsWith(`${bucketName}/`);

    // If already in Supabase, test generating a signed URL and check access
    if (isSupabasePath) {
      try {
        const url = await getInvoicePdfSignedUrl(invoice.pdfPath!, expiresInSeconds);
        const checkRes = await fetch(url, { method: 'HEAD' });
        if (checkRes.ok) {
          return { url, pdfPath: invoice.pdfPath! };
        }
      } catch (checkErr: any) {
        console.warn(`[INVOICE PDF CHECK] Storage check warning for invoice #${invoiceId}:`, checkErr.message);
      }
    }

    // Otherwise, generate the real PDF on-demand from database records
    const settingsRes = await query(
      `SELECT value FROM app_settings WHERE key = 'business_profile'`
    );
    const businessProfile = settingsRes.rows[0]?.value || {
      name: 'Kandarp Drugs',
      address: '123 Wholesale Market, Ahmedabad, Gujarat',
      gstin: '24AAAAA0000A1Z5',
      drugLicenseNumber: 'GJ-AHM-123456',
      phone: '+919876543210',
      email: 'billing@kandarpdrugs.com',
    };

    const formatDateDmY = (dStr: string | Date) => {
      const d = new Date(dStr);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };

    const pdfLines: InvoicePdfLine[] = (invoice.lines || []).map((l, idx) => {
      let expFormatted = String(l.expiryDate);
      if (expFormatted.includes('-')) {
        const parts = expFormatted.split('-');
        if (parts.length >= 2) {
          expFormatted = `${parts[1]}/${parts[0]?.slice(-2)}`;
        }
      }
      return {
        serialNo: idx + 1,
        medicineName: l.medicineName,
        packSize: l.packSize,
        batchNumber: l.batchNumber,
        expiryDate: expFormatted,
        quantity: l.quantity,
        mrp: l.mrp,
        rate: l.unitPrice,
        amount: l.lineTotal,
      };
    });

    const pdfBuffer = await buildInvoicePdf({
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: formatDateDmY(invoice.generatedAt),
      orderNumber: invoice.orderNumber,
      orderDate: formatDateDmY(invoice.generatedAt),
      business: businessProfile,
      billedTo: invoice.billedTo,
      lines: pdfLines,
      subtotal: invoice.subtotal,
      gstAmount: invoice.gstAmount,
      roundOff: invoice.roundOff,
      total: invoice.total,
    });

    // Upload to Supabase Storage
    const newPdfPath = await uploadInvoicePdf(pdfBuffer, invoice.invoiceNumber);

    // Update database with the permanent Supabase storage key
    await query(
      `UPDATE invoices SET pdf_path = $1 WHERE invoice_id = $2`,
      [newPdfPath, invoiceId]
    );

    const url = await getInvoicePdfSignedUrl(newPdfPath, expiresInSeconds);
    return { url, pdfPath: newPdfPath, pdfBuffer };
  }
}

export const invoiceService = new InvoiceService();
