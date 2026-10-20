import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { USER_ROLE } from '../../enums/user-role.enum.js';
import { invoiceController } from './invoice.controller.js';

const router = Router();

// 1. List Invoices (Admin sees all; Retailer sees own)
router.get(
  '/',
  authenticate,
  authorize(USER_ROLE.ADMIN, USER_ROLE.RETAILER),
  (req: Request, res: Response, next: NextFunction) => {
    invoiceController.listInvoices(req, res).catch(next);
  }
);

// 2. Get Invoice Details (with lines and notification history)
router.get(
  '/:invoiceId',
  authenticate,
  authorize(USER_ROLE.ADMIN, USER_ROLE.RETAILER),
  (req: Request, res: Response, next: NextFunction) => {
    invoiceController.getInvoiceById(req, res).catch(next);
  }
);

// 3. Get Signed PDF Download URL (expires in 300 seconds)
router.get(
  '/:invoiceId/pdf',
  authenticate,
  authorize(USER_ROLE.ADMIN, USER_ROLE.RETAILER),
  (req: Request, res: Response, next: NextFunction) => {
    invoiceController.getInvoicePdf(req, res).catch(next);
  }
);

// 4. Admin Resend Notification (WhatsApp or Email)
router.post(
  '/:invoiceId/resend',
  authenticate,
  authorize(USER_ROLE.ADMIN),
  (req: Request, res: Response, next: NextFunction) => {
    invoiceController.resendNotification(req, res).catch(next);
  }
);

export default router;
