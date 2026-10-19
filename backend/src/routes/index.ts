import { Router } from 'express';
import healthRouter from '../modules/health/health.route.js';
import authRouter from '../modules/auth/auth.route.js';
import userRouter from '../modules/user/user.route.js';
import saltRouter from '../modules/salt/salt.route.js';
import medicineRouter from '../modules/medicine/medicine.route.js';
import stockInwardRouter from '../modules/stock-inward/stock-inward.route.js';
import batchRouter from '../modules/batch/batch.route.js';
import retailerRouter from '../modules/retailer/retailer.route.js';
import settingsRouter from '../modules/settings/settings.route.js';
import alertRouter from '../modules/alert/alert.route.js';
import dashboardRouter from '../modules/dashboard/dashboard.route.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/users', userRouter);
router.use('/salts', saltRouter);
router.use('/medicines', medicineRouter);
router.use('/stock', stockInwardRouter);
router.use('/batches', batchRouter);
router.use('/retailers', retailerRouter);
router.use('/settings', settingsRouter);
router.use('/alerts', alertRouter);
router.use('/dashboard', dashboardRouter);

export default router;
