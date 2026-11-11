import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Payment } from '../models/Payment.js';
import {
  createPayPalOrder,
  getPayPalOrder,
  authorizePayPalOrder,
  capturePayPalAuthorization,
} from '../controllers/paypal.js';
import { notifyFamilyOfHold } from '../services/notify.js';

const router = Router();
const LEASE_MS = 60000; // 60 seconds lease for in-flight operations

/**
 * POST /api/orders
 * Creates PayPal order with intent: "AUTHORIZE" using values exclusively from DB.
 * Section 4: Concurrency control prevents duplicate PayPal orders for the same payment.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.body;
    if (!paymentId || !mongoose.isValidObjectId(paymentId)) {
      return res.status(400).json({ error: 'Missing or invalid paymentId.' });
    }

    // Safety Rule #1: Server authority - read stored database values
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found.' });
    }

    // Idempotent return if order already created
    if (payment.paypalOrderId && ['CREATED', 'AUTHORIZED', 'HELD', 'CAPTURED'].includes(payment.status)) {
      return res.status(200).json({ orderId: payment.paypalOrderId });
    }

    const leaseCutoff = new Date(Date.now() - LEASE_MS);

    // Section 4: Atomic transition CHECKED -> PROCESSING (with stale lease recovery) to prevent duplicate order creation
    const claimedPayment = await Payment.findOneAndUpdate(
      {
        _id: paymentId,
        $or: [
          { status: 'CHECKED' },
          {
            status: 'PROCESSING',
            processingAction: 'CREATE_ORDER',
            processingStartedAt: { $lt: leaseCutoff },
          },
        ],
      },
      {
        $set: {
          status: 'PROCESSING',
          processingAction: 'CREATE_ORDER',
          processingStartedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!claimedPayment) {
      const current = await Payment.findById(paymentId);
      if (current?.paypalOrderId && ['CREATED', 'AUTHORIZED', 'HELD', 'CAPTURED'].includes(current.status)) {
        return res.status(200).json({ orderId: current.paypalOrderId });
      }
      if (current?.status === 'PROCESSING') {
        return res.status(409).json({ error: 'Order creation is already in progress.' });
      }
      return res.status(400).json({
        error: `Cannot create order for payment in "${current?.status}" status.`,
      });
    }

    // Call PayPal with intent: "AUTHORIZE"
    try {
      const order = await createPayPalOrder({
        amount: claimedPayment.amount,
        currency: claimedPayment.currency,
        payeeLabel: claimedPayment.payeeLabel,
        referenceId: claimedPayment._id.toString(),
      });

      claimedPayment.paypalOrderId = order.id;
      claimedPayment.status = 'CREATED';
      claimedPayment.processingAction = null;
      claimedPayment.processingStartedAt = null;
      await claimedPayment.save();

      return res.status(201).json({ orderId: order.id });
    } catch (orderErr: any) {
      console.error('[Route: orders] Error calling PayPal create order:', orderErr?.message || orderErr);
      try {
        await Payment.findOneAndUpdate(
          { _id: claimedPayment._id, status: 'PROCESSING', processingAction: 'CREATE_ORDER' },
          { $set: { status: 'CHECKED', processingAction: null, processingStartedAt: null } }
        );
      } catch (revertErr) {
        console.error('[Route: orders] Error reverting CREATE_ORDER lock:', revertErr);
      }

      return res.status(502).json({ error: 'Failed to initialize payment order with payment processor.' });
    }
  } catch (err: any) {
    console.error('[Route: orders] Error creating PayPal order:', err?.message || err);
    return res.status(500).json({ error: 'Failed to initialize payment order.' });
  }
});

/**
 * POST /api/orders/:orderId/authorize
 * Authorizes funds and routes: instant capture if LOW risk, hold if MEDIUM/HIGH risk.
 * Section 1: Persistent idempotency keys, lease recovery, and verification before retry.
 */
router.post('/:orderId/authorize', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const existingPayment = await Payment.findOne({ paypalOrderId: orderId });
    if (!existingPayment) {
      return res.status(404).json({ error: 'Payment with specified orderId not found.' });
    }

    // Fast-path: return existing terminal/held states if already completed
    if (existingPayment.status === 'CAPTURED') {
      return res.status(200).json({
        status: 'CAPTURED',
        paymentId: existingPayment._id.toString(),
        message: 'Payment sent successfully',
      });
    }

    if (existingPayment.status === 'HELD') {
      return res.status(200).json({
        status: 'HELD',
        paymentId: existingPayment._id.toString(),
        message: 'Paused for a second look. We asked your family to confirm.',
      });
    }

    if (existingPayment.status === 'VOIDED') {
      return res.status(400).json({
        error: 'Payment has been voided.',
      });
    }

    let payment = existingPayment;

    // Step 1: If payment is not yet AUTHORIZED, claim CREATED -> PROCESSING atomically with lease recovery
    if (payment.status !== 'AUTHORIZED') {
      const leaseCutoff = new Date(Date.now() - LEASE_MS);
      const authRequestId = payment.paypalAuthorizationRequestId || uuidv4();

      const claimedPayment = await Payment.findOneAndUpdate(
        {
          paypalOrderId: orderId,
          $or: [
            { status: 'CREATED' },
            {
              status: 'PROCESSING',
              processingAction: 'AUTHORIZE',
              processingStartedAt: { $lt: leaseCutoff },
            },
          ],
        },
        {
          $set: {
            status: 'PROCESSING',
            processingAction: 'AUTHORIZE',
            processingStartedAt: new Date(),
            paypalAuthorizationRequestId: authRequestId,
          },
        },
        { new: true }
      );

      if (!claimedPayment) {
        // Concurrency check: Another concurrent request claimed it or already changed status
        const current = await Payment.findOne({ paypalOrderId: orderId });
        if (current?.status === 'CAPTURED') {
          return res.status(200).json({
            status: 'CAPTURED',
            paymentId: current._id.toString(),
            message: 'Payment sent successfully',
          });
        }
        if (current?.status === 'HELD') {
          return res.status(200).json({
            status: 'HELD',
            paymentId: current._id.toString(),
            message: 'Paused for a second look. We asked your family to confirm.',
          });
        }
        if (current?.status === 'AUTHORIZED') {
          payment = current;
        } else {
          return res.status(409).json({
            error: 'Payment authorization is already in progress or has been processed.',
          });
        }
      } else {
        // Step 1b: Verify existing PayPal state before retrying ambiguous operation
        let authorizationId = claimedPayment.paypalAuthorizationId;

        if (!authorizationId) {
          try {
            const orderData = await getPayPalOrder(orderId);
            const existingAuth = orderData?.purchase_units?.[0]?.payments?.authorizations?.[0];
            if (
              existingAuth?.id &&
              (existingAuth.status === 'CREATED' || existingAuth.status === 'PENDING')
            ) {
              authorizationId = existingAuth.id;
            }
          } catch (_inspectErr) {
            // If getOrder fails, fall through to idempotent authorizePayPalOrder
          }
        }

        if (!authorizationId) {
          try {
            const authResult = await authorizePayPalOrder(
              orderId,
              claimedPayment.paypalAuthorizationRequestId
            );
            authorizationId = authResult.authorizationId;
          } catch (authErr: any) {
            console.error('[Route: orders] Error calling PayPal authorize:', authErr?.message || authErr);
            // Requirement: Preserve state and same idempotency key for retry. Do not reset to CREATED.
            return res.status(502).json({
              error: 'Payment authorization request failed or timed out with payment provider.',
            });
          }
        }

        // Step 2: Persist authorization BEFORE capture or hold
        claimedPayment.paypalAuthorizationId = authorizationId;
        claimedPayment.status = 'AUTHORIZED';
        claimedPayment.processingAction = null;
        claimedPayment.processingStartedAt = null;
        await claimedPayment.save();
        payment = claimedPayment;
      }
    }

    // Step 3: Payment is in AUTHORIZED status.
    // For LOW risk: Direct capture
    if (payment.risk === 'LOW') {
      const captureRequestId = payment.paypalCaptureRequestId || uuidv4();
      const leaseCutoff = new Date(Date.now() - LEASE_MS);

      // Atomically transition AUTHORIZED -> PROCESSING before capture with lease check
      const capturingPayment = await Payment.findOneAndUpdate(
        {
          _id: payment._id,
          $or: [
            { status: 'AUTHORIZED' },
            {
              status: 'PROCESSING',
              processingAction: 'CAPTURE',
              processingStartedAt: { $lt: leaseCutoff },
            },
          ],
        },
        {
          $set: {
            status: 'PROCESSING',
            processingAction: 'CAPTURE',
            processingStartedAt: new Date(),
            paypalCaptureRequestId: captureRequestId,
          },
        },
        { new: true }
      );

      if (!capturingPayment) {
        const check = await Payment.findById(payment._id);
        if (check?.status === 'CAPTURED') {
          return res.status(200).json({
            status: 'CAPTURED',
            paymentId: check._id.toString(),
            message: 'Payment sent successfully',
          });
        }
        return res.status(409).json({
          error: 'Payment capture is already in progress or completed.',
        });
      }

      try {
        const captureResult = await capturePayPalAuthorization(
          capturingPayment.paypalAuthorizationId!,
          capturingPayment.paypalCaptureRequestId
        );

        // Section 2: Strict PayPal capture validation
        if (!captureResult.captureId || captureResult.status !== 'COMPLETED') {
          throw new Error(`PayPal capture was not completed successfully. Status: ${captureResult.status}`);
        }

        capturingPayment.paypalCaptureId = captureResult.captureId;
        capturingPayment.status = 'CAPTURED';
        capturingPayment.decision = 'APPROVED';
        capturingPayment.decidedAt = new Date();
        capturingPayment.processingAction = null;
        capturingPayment.processingStartedAt = null;
        await capturingPayment.save();

        return res.status(200).json({
          status: 'CAPTURED',
          paymentId: capturingPayment._id.toString(),
          message: 'Payment sent successfully',
        });
      } catch (captureErr: any) {
        console.error('[Route: orders] Error capturing PayPal authorization:', captureErr?.message || captureErr);
        // Restore AUTHORIZED state while preserving authorization & idempotency key for safe retry
        try {
          capturingPayment.status = 'AUTHORIZED';
          capturingPayment.processingAction = null;
          capturingPayment.processingStartedAt = null;
          await capturingPayment.save();
        } catch (revertErr) {
          console.error('[Route: orders] Error restoring AUTHORIZED state after capture failure:', revertErr);
        }
        return res.status(502).json({
          error: 'Payment capture failed or timed out with payment provider. Authorization is preserved.',
        });
      }
    } else {
      // Pause & Hold path for MEDIUM or HIGH risk payments
      const holdMinutes = parseInt(process.env.HOLD_MINUTES || '1440', 10);
      const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000);

      // Atomically transition AUTHORIZED -> HELD so concurrent requests do not duplicate family alerts
      const heldPayment = await Payment.findOneAndUpdate(
        { _id: payment._id, status: 'AUTHORIZED' },
        {
          $set: {
            status: 'HELD',
            expiresAt,
            processingAction: null,
            processingStartedAt: null,
          },
        },
        { new: true }
      );

      if (!heldPayment) {
        const current = await Payment.findById(payment._id);
        if (current?.status === 'HELD') {
          return res.status(200).json({
            status: 'HELD',
            paymentId: current._id.toString(),
            message: 'Paused for a second look. We asked your family to confirm.',
          });
        }
        if (current?.status === 'CAPTURED') {
          return res.status(200).json({
            status: 'CAPTURED',
            paymentId: current._id.toString(),
            message: 'Payment sent successfully',
          });
        }
        return res.status(409).json({
          error: 'Payment state changed concurrently while placing hold.',
        });
      }

      // Dispatch alert to family
      notifyFamilyOfHold({
        familyId: heldPayment.familyId.toString(),
        payeeLabel: heldPayment.payeeLabel,
        amount: heldPayment.amount,
        risk: heldPayment.risk,
        holdToken: heldPayment.holdToken,
        familySummary: heldPayment.aiResult.familySummary,
      }).catch((err) => console.error('[Orders] Notification dispatch error:', err));

      // Rule #7: Protect elder screen - NEVER return holdToken here
      return res.status(200).json({
        status: 'HELD',
        paymentId: heldPayment._id.toString(),
        message: 'Paused for a second look. We asked your family to confirm.',
      });
    }
  } catch (err: any) {
    console.error('[Route: orders] Error authorizing PayPal order:', err?.message || err);
    return res.status(500).json({ error: 'Failed to authorize payment.' });
  }
});

export default router;

