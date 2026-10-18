import { Router } from 'express';
import healthRouter from '../modules/health/health.route.js';
import authRouter from '../modules/auth/auth.route.js';
import userRouter from '../modules/user/user.route.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/users', userRouter);

export default router;
