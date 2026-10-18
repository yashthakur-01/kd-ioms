import { Router } from 'express';
import healthRouter from '../modules/health/health.route.js';

const router = Router();

router.use('/health', healthRouter);

export default router;
