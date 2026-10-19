import { Router } from 'express';
import * as controller from './catalog.controller.js';
import * as schema from './catalog.validation.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { requirePasswordChanged } from '../../middleware/require-password-changed.js';
import { USER_ROLE } from '../../enums/user-role.enum.js';

const router = Router();

// Gating: Only ADMIN can access alert queues
router.use(authenticate, requirePasswordChanged, authorize(USER_ROLE.ADMIN));

// Out-of-Stock alert queue
router.get(
  '/out-of-stock',
  validate(schema.outOfStockAlertsSchema),
  asyncHandler(controller.getOutOfStockAlerts)
);

export default router;
