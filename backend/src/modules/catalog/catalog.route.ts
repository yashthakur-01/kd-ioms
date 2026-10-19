import { Router } from 'express';
import * as controller from './catalog.controller.js';
import * as schema from './catalog.validation.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePasswordChanged } from '../../middleware/require-password-changed.js';
import { requireApprovedRetailer } from '../../middleware/require-approved-retailer.js';

const router = Router();

// Gating: Must be authenticated, initial password changed, and if Retailer must be APPROVED
router.use(authenticate, requirePasswordChanged, requireApprovedRetailer);

// Public / Retailer / Admin / Delivery Catalog Endpoints
router.get(
  '/',
  validate(schema.listCatalogSchema),
  asyncHandler(controller.getCatalog)
);

router.get(
  '/:medicineId',
  validate(schema.getCatalogItemSchema),
  asyncHandler(controller.getCatalogItem)
);

export default router;
