import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { requirePasswordChanged } from '../../middleware/require-password-changed.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { USER_ROLE } from '../../enums/user-role.enum.js';
import { inwardStockSchema, scanResolveSchema } from './stock-inward.validation.js';
import * as stockInwardController from './stock-inward.controller.js';
import { listLedgerSchema } from '../batch/batch.validation.js';
import * as batchController from '../batch/batch.controller.js';

const router = Router();

// Gated strictly to ADMIN
router.use(authenticate, authorize(USER_ROLE.ADMIN), requirePasswordChanged);

router.post('/inward', validate(inwardStockSchema), asyncHandler(stockInwardController.handleInwardStock));
router.post('/scan/resolve', validate(scanResolveSchema), asyncHandler(stockInwardController.handleResolveScan));
router.get('/ledger', validate(listLedgerSchema), asyncHandler(batchController.handleListLedger));

export default router;
