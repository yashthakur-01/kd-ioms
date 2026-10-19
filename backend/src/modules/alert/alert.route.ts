import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { requirePasswordChanged } from '../../middleware/require-password-changed.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { USER_ROLE } from '../../enums/user-role.enum.js';
import { listAlertsSchema, dismissAlertSchema } from './alert.validation.js';
import * as alertController from './alert.controller.js';

const router = Router();

// Gated strictly to ADMIN
router.use(authenticate, authorize(USER_ROLE.ADMIN), requirePasswordChanged);

router.get('/near-expiry', validate(listAlertsSchema), asyncHandler(alertController.handleListNearExpiry));
router.get('/expired', validate(listAlertsSchema), asyncHandler(alertController.handleListExpired));
router.post('/near-expiry/:batchId/dismiss', validate(dismissAlertSchema), asyncHandler(alertController.handleDismissNearExpiry));

export default router;
