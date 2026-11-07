import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Payment } from '../models/Payment.js';
import {
  createPayPalOrder,
  authorizePayPalOrder,
  capturePayPalAuthorization,
} from '../controllers/paypal.js';
import { notifyFamilyOfHold } from '../services/notify.js';

const router = Router();

/**
 * POST /api/orders
 * Creates PayPal order with intent: "AUTHORIZE" using values exclusively from DB.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.body;
    if (!paymentId) {
      return res.status(400).json({ error: 'Missing required paymentId.' });
    }

    // Safety Rule #1: Server authority - read stored database values
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found.' });
    }

    if (payment.status !== 'CHECKED') {
      return res.status(400).json({
        error: `Cannot create order for payment in "${payment.status}" status.`,
      });
    }

    // Call PayPal with intent: "AUTHORIZE"
    const order = await createPayPalOrder({
      amount: payment.amount,
      currency: payment.currency,
      payeeLabel: payment.payeeLabel,
      referenceId: payment._id.toString(),
    });

    payment.paypalOrderId = order.id;
    payment.status = 'CREATED';
    await payment.save();

    return res.status(201).json({ orderId: order.id });
  } catch (err: any) {
    console.error('[Route: orders] Error creating PayPal order:', err?.message || err);
    return res.status(500).json({ error: 'Failed to initialize payment order.' });
  }
});

/**
 * POST /api/orders/:orderId/authorize
 * Authorizes funds and routes: instant capture if LOW risk, hold if MEDIUM/HIGH risk.
 */
router.post('/:orderId/authorize', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const payment = await Payment.findOne({ paypalOrderId: orderId });
    if (!payment) {
      return res.status(404).json({ error: 'Payment with specified orderId not found.' });
    }

    // Authorize order on PayPal sandbox
    const { authorizationId } = await authorizePayPalOrder(orderId);
    payment.paypalAuthorizationId = authorizationId;

    if (payment.risk === 'LOW') {
      // Direct Capture path for legitimate low-risk payments
      payment.status = 'PROCESSING';
      await payment.save();

      const idempotencyKey = uuidv4();
      const captureResult = await capturePayPalAuthorization(
        authorizationId,
        idempotencyKey
      );

      payment.paypalCaptureId = captureResult.captureId;
      payment.status = 'CAPTURED';
      payment.decision = 'APPROVED';
      payment.decidedAt = new Date();
      await payment.save();

      return res.status(200).json({
        status: 'CAPTURED',
        paymentId: payment._id.toString(),
        message: 'Payment sent successfully',
      });
    } else {
      // Pause & Hold path for MEDIUM or HIGH risk payments
      const holdMinutes = parseInt(process.env.HOLD_MINUTES || '1440', 10);
      const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000);

      payment.status = 'HELD';
      payment.expiresAt = expiresAt;
      await payment.save();

      // Dispatch alert to family
      notifyFamilyOfHold({
        familyId: payment.familyId.toString(),
        payeeLabel: payment.payeeLabel,
        amount: payment.amount,
        risk: payment.risk,
        holdToken: payment.holdToken,
        familySummary: payment.aiResult.familySummary,
      }).catch((err) => console.error('[Orders] Notification dispatch error:', err));

      // Rule #7: Protect elder screen - NEVER return holdToken here
      return res.status(200).json({
        status: 'HELD',
        paymentId: payment._id.toString(),
        message: 'Paused for a second look. We asked your family to confirm.',
      });
    }
  } catch (err: any) {
    console.error('[Route: orders] Error authorizing PayPal order:', err?.message || err);
    return res.status(500).json({ error: 'Failed to authorize payment.' });
  }
});

export default router;

