import { Router } from 'express';
import healthRouter from '../modules/health/health.route.js';
import authRouter from '../modules/auth/auth.route.js';
import userRouter from '../modules/user/user.route.js';
import saltRouter from '../modules/salt/salt.route.js';
import medicineRouter from '../modules/medicine/medicine.route.js';
import retailerRouter from '../modules/retailer/retailer.route.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/users', userRouter);
router.use('/salts', saltRouter);
router.use('/medicines', medicineRouter);
router.use('/retailers', retailerRouter);

export default router;
