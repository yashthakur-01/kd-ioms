import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import * as controller from './health.controller.js';

const router = Router();

router.get('/', asyncHandler(controller.getHealth));

export default router;
