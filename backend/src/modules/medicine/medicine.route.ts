import { Router } from 'express';
import * as controller from './medicine.controller.js';
import * as schema from './medicine.validation.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { requirePasswordChanged } from '../../middleware/require-password-changed.js';
import { USER_ROLE } from '../../enums/user-role.enum.js';

import { searchScanLimiter } from '../../middleware/rate-limit.js';

const router = Router();

// Base middleware for all medicine endpoints: requires authentication and initial password changed
router.use(authenticate, requirePasswordChanged);

// Search endpoint accessible to ADMIN and DELIVERY roles
router.get(
  '/search',
  searchScanLimiter,
  authorize(USER_ROLE.ADMIN, USER_ROLE.DELIVERY),
  validate(schema.searchMedicinesSchema),
  asyncHandler(controller.searchMedicines)
);

// Admin-only management endpoints
router.post(
  '/',
  authorize(USER_ROLE.ADMIN),
  validate(schema.createMedicineSchema),
  asyncHandler(controller.createMedicine)
);

router.get(
  '/',
  authorize(USER_ROLE.ADMIN),
  validate(schema.listMedicinesSchema),
  asyncHandler(controller.listMedicines)
);

router.get(
  '/:medicineId',
  authorize(USER_ROLE.ADMIN),
  validate(schema.getMedicineSchema),
  asyncHandler(controller.getMedicineById)
);

router.patch(
  '/:medicineId',
  authorize(USER_ROLE.ADMIN),
  validate(schema.updateMedicineSchema),
  asyncHandler(controller.updateMedicine)
);

export default router;
