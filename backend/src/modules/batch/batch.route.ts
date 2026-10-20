import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { requirePasswordChanged } from '../../middleware/require-password-changed.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { USER_ROLE } from '../../enums/user-role.enum.js';
import {
  listBatchesSchema,
  getBatchSchema,
  updateBatchSchema,
  adjustBatchSchema,
  removeExpiredSchema,
} from './batch.validation.js';
import * as batchController from './batch.controller.js';
import { allocationController } from '../allocation/allocation.controller.js';

import { searchScanLimiter } from '../../middleware/rate-limit.js';

const router = Router();

// Gated strictly to ADMIN
router.use(authenticate, authorize(USER_ROLE.ADMIN), requirePasswordChanged);

router.post('/resolve-scan', searchScanLimiter, asyncHandler(allocationController.resolveScan));
router.get('/', validate(listBatchesSchema), asyncHandler(batchController.handleListBatches));
router.get('/:batchId', validate(getBatchSchema), asyncHandler(batchController.handleGetBatch));
router.patch('/:batchId', validate(updateBatchSchema), asyncHandler(batchController.handleUpdateBatch));
router.post('/:batchId/adjust', validate(adjustBatchSchema), asyncHandler(batchController.handleAdjustBatch));
router.post('/:batchId/remove-expired', validate(removeExpiredSchema), asyncHandler(batchController.handleRemoveExpired));

export default router;
