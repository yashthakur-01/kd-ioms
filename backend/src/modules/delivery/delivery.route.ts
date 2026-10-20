import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { USER_ROLE } from '../../enums/user-role.enum.js';
import { deliveryController } from './delivery.controller.js';
import { deliveryPhotoUpload, handleUploadErrors } from '../../middleware/upload.js';

const router = Router();

// 1. Dispatch Pool - View unassigned approved orders
router.get(
  '/pool',
  authenticate,
  authorize(USER_ROLE.DELIVERY, USER_ROLE.ADMIN),
  (req: Request, res: Response, next: NextFunction) => {
    deliveryController.getPool(req, res).catch(next);
  }
);

// 2. Claim Order from Pool
router.post(
  '/orders/:orderId/claim',
  authenticate,
  authorize(USER_ROLE.DELIVERY),
  (req: Request, res: Response, next: NextFunction) => {
    deliveryController.claimOrder(req, res).catch(next);
  }
);

// 3. Release Order back to Pool
router.post(
  '/orders/:orderId/release',
  authenticate,
  authorize(USER_ROLE.DELIVERY, USER_ROLE.ADMIN),
  (req: Request, res: Response, next: NextFunction) => {
    deliveryController.releaseOrder(req, res).catch(next);
  }
);

// 4. Admin Override for Out-for-Delivery Orders
router.post(
  '/orders/:orderId/override',
  authenticate,
  authorize(USER_ROLE.ADMIN),
  (req: Request, res: Response, next: NextFunction) => {
    deliveryController.overrideOrder(req, res).catch(next);
  }
);

// 5. Partner's Claimed Orders
router.get(
  '/orders',
  authenticate,
  authorize(USER_ROLE.DELIVERY),
  (req: Request, res: Response, next: NextFunction) => {
    deliveryController.getPartnerOrders(req, res).catch(next);
  }
);

// 6. Delivery Order Detail (Stop & Items)
router.get(
  '/orders/:orderId',
  authenticate,
  authorize(USER_ROLE.DELIVERY, USER_ROLE.ADMIN),
  (req: Request, res: Response, next: NextFunction) => {
    deliveryController.getOrderDetail(req, res).catch(next);
  }
);

// 7. Complete Delivery (Photo + Line Decisions)
router.post(
  '/orders/:orderId/complete',
  authenticate,
  authorize(USER_ROLE.DELIVERY),
  deliveryPhotoUpload.single('photo'),
  handleUploadErrors,
  (req: Request, res: Response, next: NextFunction) => {
    deliveryController.completeDelivery(req, res).catch(next);
  }
);

export default router;
