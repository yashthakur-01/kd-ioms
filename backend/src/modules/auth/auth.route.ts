import { Router } from 'express';
import * as controller from './auth.controller.js';
import * as schema from './auth.validation.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { loginLimiter } from '../../middleware/rate-limit.js';
import { authenticate } from '../../middleware/authenticate.js';

const router = Router();

router.post('/login', loginLimiter, validate(schema.loginSchema), asyncHandler(controller.login));
router.post('/refresh', asyncHandler(controller.refresh));
router.post('/logout', asyncHandler(controller.logout));
router.post('/change-password', authenticate, validate(schema.changePasswordSchema), asyncHandler(controller.changePassword));
router.get('/me', authenticate, asyncHandler(controller.me));

export default router;
