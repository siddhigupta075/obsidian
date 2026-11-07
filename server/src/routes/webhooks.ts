import { Router } from 'express';
import { handlePayPalWebhook } from '../controllers/webhooks.js';

const router = Router();

router.post('/', handlePayPalWebhook);

export default router;

