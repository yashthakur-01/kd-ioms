import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { requirePasswordChanged } from '../../middleware/require-password-changed.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { USER_ROLE } from '../../enums/user-role.enum.js';
import * as dashboardController from './dashboard.controller.js';

const router = Router();

// Gated strictly to ADMIN
router.use(authenticate, authorize(USER_ROLE.ADMIN), requirePasswordChanged);

router.get('/summary', asyncHandler(dashboardController.handleGetDashboardSummary));

export default router;
