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
} from './batch.validation.js';
import * as batchController from './batch.controller.js';

const router = Router();

// Gated strictly to ADMIN
router.use(authenticate, authorize(USER_ROLE.ADMIN), requirePasswordChanged);

router.get('/', validate(listBatchesSchema), asyncHandler(batchController.handleListBatches));
router.get('/:batchId', validate(getBatchSchema), asyncHandler(batchController.handleGetBatch));
router.patch('/:batchId', validate(updateBatchSchema), asyncHandler(batchController.handleUpdateBatch));
router.post('/:batchId/adjust', validate(adjustBatchSchema), asyncHandler(batchController.handleAdjustBatch));

export default router;
