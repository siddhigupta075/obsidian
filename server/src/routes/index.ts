import { Router } from 'express';
import checkRouter from './check.js';
import ordersRouter from './orders.js';
import paymentsRouter from './payments.js';
import holdsRouter from './holds.js';
import demoRouter from './demo.js';
import webhooksRouter from './webhooks.js';

const router = Router();

router.use('/check', checkRouter);
router.use('/orders', ordersRouter);
router.use('/payments', paymentsRouter);
router.use('/holds', holdsRouter);
router.use('/demo', demoRouter);
router.use('/webhooks', webhooksRouter);

export default router;

