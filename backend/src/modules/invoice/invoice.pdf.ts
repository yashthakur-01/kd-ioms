import PDFDocument from 'pdfkit';
import { numberToWords } from '../../utils/number-to-words.js';

export interface InvoicePdfLine {
  serialNo: number;
  medicineName: string;
  packSize: string;
  batchNumber: string;
  expiryDate: string; // MM/YY or YYYY-MM
  quantity: number;
  mrp: string;
  rate: string; // unit selling price excl GST
  amount: string; // quantity * rate
}

export interface InvoicePdfData {
  invoiceNumber: string;
  invoiceDate: string; // DD/MM/YYYY
  orderNumber: string;
  orderDate: string; // DD/MM/YYYY
  business: {
    name: string;
    address: string;
    gstin: string;
    drugLicenseNumber: string;
    phone: string;
    email: string;
  };
  billedTo: {
    shopName: string;
    contactPerson?: string;
    addressLine: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
    gstin?: string;
    drugLicenseNumber?: string;
  };
  lines: InvoicePdfLine[];
  subtotal: string;
  gstAmount: string; // Single aggregate GST figure (ADR-040)
  roundOff: string;
  total: string;
}

/**
 * Builds a wholesale pharmaceutical GST tax invoice PDF in memory buffer.
 */
export async function buildInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const pageWidth = 595.28;
      const margin = 30;
      const printableWidth = pageWidth - margin * 2; // 535.28

      // =========================================================================
      // 1. TOP HEADER (SELLER INFO)
      // =========================================================================
      doc.rect(margin, margin, printableWidth, 75).stroke('#cbd5e1');

      doc.font('Helvetica-Bold').fontSize(15).fillColor('#0f172a')
        .text(data.business.name.toUpperCase(), margin + 10, margin + 8, { width: printableWidth - 20, align: 'left' });

      doc.font('Helvetica').fontSize(8.5).fillColor('#334155')
        .text(data.business.address, margin + 10, margin + 26, { width: 330 })
        .text(`Phone: ${data.business.phone}  |  Email: ${data.business.email}`, margin + 10, margin + 38, { width: 330 });

      // Right header box for Tax & Licenses
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a')
        .text('TAX INVOICE', margin + 350, margin + 8, { width: 175, align: 'right' });
      doc.font('Helvetica').fontSize(8).fillColor('#334155')
        .text(`GSTIN: ${data.business.gstin}`, margin + 350, margin + 22, { width: 175, align: 'right' })
        .text(`D.L. No: ${data.business.drugLicenseNumber}`, margin + 350, margin + 34, { width: 175, align: 'right' });

      // =========================================================================
      // 2. INVOICE & BUYER DETAILS BAR
      // =========================================================================
      const metaY = margin + 80;
      const metaHeight = 65;
      doc.rect(margin, metaY, printableWidth, metaHeight).stroke('#cbd5e1');

      // Left Box: Billed To (Buyer Pharmacy)
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a')
        .text('BILLED TO (BUYER):', margin + 10, metaY + 6);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e293b')
        .text(data.billedTo.shopName, margin + 10, metaY + 18);
      
      const buyerAddress = [
        data.billedTo.addressLine,
        data.billedTo.city,
        data.billedTo.state ? `${data.billedTo.state} - ${data.billedTo.pincode}` : data.billedTo.pincode
      ].filter(Boolean).join(', ');

      doc.font('Helvetica').fontSize(8).fillColor('#475569')
        .text(buyerAddress, margin + 10, metaY + 30, { width: 280, height: 20 })
        .text(`Phone: ${data.billedTo.phone}  |  GSTIN: ${data.billedTo.gstin || 'Unregistered'}  |  D.L.: ${data.billedTo.drugLicenseNumber || 'N/A'}`, margin + 10, metaY + 48, { width: 300 });

      // Divider between buyer and invoice meta
      doc.moveTo(margin + 330, metaY).lineTo(margin + 330, metaY + metaHeight).stroke('#cbd5e1');

      // Right Box: Invoice Reference & Dates
      const rightX = margin + 340;
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a')
        .text('Invoice Number:', rightX, metaY + 6)
        .text('Invoice Date:', rightX, metaY + 20)
        .text('Order Number:', rightX, metaY + 34)
        .text('Order Date:', rightX, metaY + 48);

      doc.font('Helvetica').fontSize(8).fillColor('#1e293b')
        .text(data.invoiceNumber, rightX + 80, metaY + 6, { align: 'right', width: 105 })
        .text(data.invoiceDate, rightX + 80, metaY + 20, { align: 'right', width: 105 })
        .text(data.orderNumber, rightX + 80, metaY + 34, { align: 'right', width: 105 })
        .text(data.orderDate, rightX + 80, metaY + 48, { align: 'right', width: 105 });

      // =========================================================================
      // 3. TABLE OF LINE ITEMS
      // =========================================================================
      let tableY = metaY + metaHeight + 10;
      const rowHeight = 20;

      // Table columns layout
      const cols = {
        sn: { x: margin + 4, w: 20, align: 'left' as const },
        desc: { x: margin + 26, w: 160, align: 'left' as const },
        pack: { x: margin + 188, w: 45, align: 'left' as const },
        batch: { x: margin + 235, w: 55, align: 'left' as const },
        exp: { x: margin + 292, w: 45, align: 'center' as const },
        qty: { x: margin + 339, w: 35, align: 'right' as const },
        mrp: { x: margin + 376, w: 48, align: 'right' as const },
        rate: { x: margin + 426, w: 48, align: 'right' as const },
        amount: { x: margin + 476, w: 55, align: 'right' as const },
      };

      function drawTableHeader(y: number) {
        doc.rect(margin, y, printableWidth, 18).fillAndStroke('#f8fafc', '#cbd5e1');
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a');
        doc.text('#', cols.sn.x, y + 5, { width: cols.sn.w, align: cols.sn.align });
        doc.text('ITEM DESCRIPTION', cols.desc.x, y + 5, { width: cols.desc.w, align: cols.desc.align });
        doc.text('PACK', cols.pack.x, y + 5, { width: cols.pack.w, align: cols.pack.align });
        doc.text('BATCH', cols.batch.x, y + 5, { width: cols.batch.w, align: cols.batch.align });
        doc.text('EXP', cols.exp.x, y + 5, { width: cols.exp.w, align: cols.exp.align });
        doc.text('QTY', cols.qty.x, y + 5, { width: cols.qty.w, align: cols.qty.align });
        doc.text('MRP (Rs)', cols.mrp.x, y + 5, { width: cols.mrp.w, align: cols.mrp.align });
        doc.text('RATE (Rs)', cols.rate.x, y + 5, { width: cols.rate.w, align: cols.rate.align });
        doc.text('AMOUNT (Rs)', cols.amount.x, y + 5, { width: cols.amount.w, align: cols.amount.align });
      }

      drawTableHeader(tableY);
      tableY += 18;

      let currentY = tableY;
      data.lines.forEach((line, index) => {
        // Page break if nearing bottom
        if (currentY > 710) {
          doc.addPage();
          currentY = margin;
          drawTableHeader(currentY);
          currentY += 18;
        }

        const bg = index % 2 === 1 ? '#f8fafc' : '#ffffff';
        if (bg !== '#ffffff') {
          doc.rect(margin, currentY, printableWidth, rowHeight).fill(bg);
        }
        doc.rect(margin, currentY, printableWidth, rowHeight).stroke('#e2e8f0');

        doc.font('Helvetica').fontSize(8).fillColor('#1e293b');
        doc.text(String(line.serialNo), cols.sn.x, currentY + 6, { width: cols.sn.w, align: cols.sn.align });
        doc.font('Helvetica-Bold').text(line.medicineName, cols.desc.x, currentY + 6, { width: cols.desc.w, align: cols.desc.align });
        doc.font('Helvetica');
        doc.text(line.packSize, cols.pack.x, currentY + 6, { width: cols.pack.w, align: cols.pack.align });
        doc.text(line.batchNumber, cols.batch.x, currentY + 6, { width: cols.batch.w, align: cols.batch.align });
        doc.text(line.expiryDate, cols.exp.x, currentY + 6, { width: cols.exp.w, align: cols.exp.align });
        doc.text(String(line.quantity), cols.qty.x, currentY + 6, { width: cols.qty.w, align: cols.qty.align });
        doc.text(line.mrp, cols.mrp.x, currentY + 6, { width: cols.mrp.w, align: cols.mrp.align });
        doc.text(line.rate, cols.rate.x, currentY + 6, { width: cols.rate.w, align: cols.rate.align });
        doc.font('Helvetica-Bold').text(line.amount, cols.amount.x, currentY + 6, { width: cols.amount.w, align: cols.amount.align });

        currentY += rowHeight;
      });

      // =========================================================================
      // 4. FINANCIAL TOTALS BLOCK & AMOUNT IN WORDS
      // =========================================================================
      if (currentY > 670) {
        doc.addPage();
        currentY = margin;
      }

      currentY += 10;
      const summaryY = currentY;
      const summaryHeight = 90;

      // Left Box: Amount in words & Bank Terms
      const leftSummaryWidth = 320;
      doc.rect(margin, summaryY, leftSummaryWidth, summaryHeight).stroke('#cbd5e1');

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a')
        .text('AMOUNT IN WORDS:', margin + 8, summaryY + 8);
      const totalWords = numberToWords(data.total);
      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#1e293b')
        .text(totalWords, margin + 8, summaryY + 20, { width: leftSummaryWidth - 16 });

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a')
        .text('TERMS & CONDITIONS:', margin + 8, summaryY + 45);
      doc.font('Helvetica').fontSize(7).fillColor('#64748b')
        .text('1. Goods once sold will not be accepted back or exchanged.', margin + 8, summaryY + 56)
        .text('2. Subject to Ahmedabad jurisdiction only.', margin + 8, summaryY + 66)
        .text('3. This is a computer-generated tax invoice and requires no physical signature.', margin + 8, summaryY + 76);

      // Right Box: Financial Summary Table
      const rightSummaryX = margin + leftSummaryWidth + 10;
      const rightSummaryWidth = printableWidth - leftSummaryWidth - 10;
      doc.rect(rightSummaryX, summaryY, rightSummaryWidth, summaryHeight).stroke('#cbd5e1');

      const sumLines = [
        { label: 'Subtotal:', value: `Rs ${data.subtotal}` },
        { label: 'Output GST (Single Line):', value: `Rs ${data.gstAmount}` },
        { label: 'Round Off:', value: `Rs ${data.roundOff}` },
      ];

      let sumLineY = summaryY + 8;
      sumLines.forEach((item) => {
        doc.font('Helvetica').fontSize(8).fillColor('#334155')
          .text(item.label, rightSummaryX + 8, sumLineY, { width: 110, align: 'left' });
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a')
          .text(item.value, rightSummaryX + 115, sumLineY, { width: rightSummaryWidth - 123, align: 'right' });
        sumLineY += 16;
      });

      // Grand Total Highlight Bar
      doc.rect(rightSummaryX, summaryY + 60, rightSummaryWidth, 30).fill('#0f172a');
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff')
        .text('TOTAL AMOUNT:', rightSummaryX + 8, summaryY + 70, { width: 100, align: 'left' });
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff')
        .text(`Rs ${data.total}`, rightSummaryX + 105, summaryY + 69, { width: rightSummaryWidth - 113, align: 'right' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
