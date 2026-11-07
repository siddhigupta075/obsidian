import { Router, Request, Response } from 'express';
import { Payment } from '../models/Payment.js';
import { lazyCheckExpiredHolds } from '../controllers/holds.js';

const router = Router();

/**
 * GET /api/payments/:id/status
 * Elder Polling Endpoint.
 * Never leaks holdToken or approver URLs (Hard Rule #7).
 */
router.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Trigger lazy expiry check (Rule #11)
    await lazyCheckExpiredHolds();

    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found.' });
    }

    let message = 'Processing payment';
    if (payment.status === 'HELD') {
      message = 'Paused for a second look. We asked your family to confirm.';
    } else if (payment.status === 'CAPTURED') {
      message = 'Payment sent successfully.';
    } else if (payment.status === 'VOIDED') {
      if (payment.decision === 'DECLINED') {
        message = 'Not sent. Your family stopped this one.';
      } else if (payment.decision === 'EXPIRED') {
        message = 'Review time expired. The payment was safely cancelled.';
      } else {
        message = 'Payment cancelled. No money left your account.';
      }
    } else if (payment.status === 'FAILED') {
      message = 'Payment could not be completed.';
    }

    // Strictly returns elder-safe fields
    return res.status(200).json({
      status: payment.status,
      decision: payment.decision,
      message,
    });
  } catch (err: any) {
    console.error('[Route: payments] Error fetching status:', err?.message || err);
    return res.status(500).json({ error: 'Failed to retrieve payment status.' });
  }
});

export default router;

