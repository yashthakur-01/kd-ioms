import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { requirePasswordChanged } from '../../middleware/require-password-changed.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { USER_ROLE } from '../../enums/user-role.enum.js';
import { patchSettingsSchema } from './settings.validation.js';
import * as settingsController from './settings.controller.js';

const router = Router();

// Gated strictly to ADMIN
router.use(authenticate, authorize(USER_ROLE.ADMIN), requirePasswordChanged);

router.get('/', asyncHandler(settingsController.handleGetSettings));
router.patch('/', validate(patchSettingsSchema), asyncHandler(settingsController.handlePatchSettings));

export default router;
