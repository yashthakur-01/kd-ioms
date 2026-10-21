import { Router } from 'express';
import * as controller from './retailer.controller.js';
import * as schema from './retailer.validation.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { requirePasswordChanged } from '../../middleware/require-password-changed.js';
import { USER_ROLE } from '../../enums/user-role.enum.js';

const router = Router();

// Retailer endpoints
router.get(
  '/me',
  authenticate,
  authorize(USER_ROLE.RETAILER),
  requirePasswordChanged,
  asyncHandler(controller.getMine)
);

router.put(
  '/me',
  authenticate,
  authorize(USER_ROLE.RETAILER),
  requirePasswordChanged,
  validate(schema.upsertProfileSchema),
  asyncHandler(controller.upsertMine)
);

// Admin & Delivery endpoints
router.get(
  '/',
  authenticate,
  authorize(USER_ROLE.ADMIN, USER_ROLE.DELIVERY),
  requirePasswordChanged,
  validate(schema.listRetailersSchema),
  asyncHandler(controller.listRetailers)
);

router.get(
  '/:userId',
  authenticate,
  authorize(USER_ROLE.ADMIN, USER_ROLE.DELIVERY),
  requirePasswordChanged,
  validate(schema.getRetailerSchema),
  asyncHandler(controller.getRetailerById)
);

router.post(
  '/:userId/approve',
  authenticate,
  authorize(USER_ROLE.ADMIN),
  requirePasswordChanged,
  validate(schema.approveRetailerSchema),
  asyncHandler(controller.approveRetailer)
);

router.post(
  '/:userId/reject',
  authenticate,
  authorize(USER_ROLE.ADMIN),
  requirePasswordChanged,
  validate(schema.rejectRetailerSchema),
  asyncHandler(controller.rejectRetailer)
);

export default router;
