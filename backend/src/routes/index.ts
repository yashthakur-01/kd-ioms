import { Router } from 'express';
import healthRouter from '../modules/health/health.route.js';
import authRouter from '../modules/auth/auth.route.js';
import userRouter from '../modules/user/user.route.js';
import saltRouter from '../modules/salt/salt.route.js';
import medicineRouter from '../modules/medicine/medicine.route.js';
import stockInwardRouter from '../modules/stock-inward/stock-inward.route.js';
import batchRouter from '../modules/batch/batch.route.js';
import retailerRouter from '../modules/retailer/retailer.route.js';
import catalogRouter from '../modules/catalog/catalog.route.js';
import alertsRouter from '../modules/catalog/alerts.route.js';
import { orderRouter } from '../modules/order/order.route.js';
import settingsRouter from '../modules/settings/settings.route.js';
import alertRouter from '../modules/alert/alert.route.js';
import dashboardRouter from '../modules/dashboard/dashboard.route.js';
import deliveryRouter from '../modules/delivery/delivery.route.js';
import invoiceRouter from '../modules/invoice/invoice.route.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/users', userRouter);
router.use('/salts', saltRouter);
router.use('/medicines', medicineRouter);
router.use('/stock', stockInwardRouter);
router.use('/batches', batchRouter);
router.use('/retailers', retailerRouter);
router.use('/catalog', catalogRouter);
router.use('/alerts', alertsRouter);
router.use('/orders', orderRouter);
router.use('/settings', settingsRouter);
router.use('/alerts', alertRouter);
router.use('/dashboard', dashboardRouter);
router.use('/delivery', deliveryRouter);
router.use('/invoices', invoiceRouter);

export default router;
