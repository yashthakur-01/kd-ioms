import { Router } from 'express';
import * as controller from './user.controller.js';
import * as schema from './user.validation.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { requirePasswordChanged } from '../../middleware/require-password-changed.js';
import { USER_ROLE } from '../../enums/user-role.enum.js';

const router = Router();

// Enforce authentication, admin role, and completed initial password change
router.use(authenticate, authorize(USER_ROLE.ADMIN), requirePasswordChanged);

router.post('/', validate(schema.createUserSchema), asyncHandler(controller.createUser));
router.get('/', validate(schema.listUsersSchema), asyncHandler(controller.listUsers));
router.get('/:userId', validate(schema.getUserSchema), asyncHandler(controller.getUserById));
router.patch('/:userId', validate(schema.updateUserSchema), asyncHandler(controller.updateUser));
router.post('/:userId/reset-password', validate(schema.resetPasswordSchema), asyncHandler(controller.resetPassword));

export default router;
