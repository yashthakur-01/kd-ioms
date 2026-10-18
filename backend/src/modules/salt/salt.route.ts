import { Router } from 'express';
import * as controller from './salt.controller.js';
import * as schema from './salt.validation.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { requirePasswordChanged } from '../../middleware/require-password-changed.js';
import { USER_ROLE } from '../../enums/user-role.enum.js';

const router = Router();

// Enforce authentication, admin role, and completed initial password change
router.use(authenticate, authorize(USER_ROLE.ADMIN), requirePasswordChanged);

router.get('/', validate(schema.listSaltsSchema), asyncHandler(controller.listSalts));
router.get('/suggest', validate(schema.suggestSaltsSchema), asyncHandler(controller.suggestSalts));
router.post('/', validate(schema.createSaltSchema), asyncHandler(controller.createSalt));
router.patch('/:saltId', validate(schema.updateSaltSchema), asyncHandler(controller.updateSalt));

export default router;
