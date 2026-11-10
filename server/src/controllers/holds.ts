import { v4 as uuidv4 } from 'uuid';
import { Payment, IPayment } from '../models/Payment.js';
import {
  capturePayPalAuthorization,
  voidPayPalAuthorization,
} from './paypal.js';

const LEASE_MS = 60000;

/**
 * Lazy expiry worker: Identifies and voids holds whose timer expired.
 * Complies with free-tier Render constraints (Rule #11).
 * Section 5: Atomic transition protects in-flight family decisions from auto-expiry.
 */
export async function lazyCheckExpiredHolds(): Promise<number> {
  const now = new Date();
  const expiredPayments = await Payment.find({
    status: 'HELD',
    expiresAt: { $lte: now },
  });

  let voidedCount = 0;
  const leaseCutoff = new Date(Date.now() - LEASE_MS);

  for (const payment of expiredPayments) {
    // Atomic status transition HELD -> PROCESSING (Rule #5)
    // Only claims HELD or expired VOID processing lease; in-flight CAPTURE is untouched
    const locked = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        $or: [
          { status: 'HELD' },
          {
            status: 'PROCESSING',
            processingAction: 'VOID',
            processingStartedAt: { $lt: leaseCutoff },
          },
        ],
        expiresAt: { $lte: now },
      },
      {
        $set: {
          status: 'PROCESSING',
          processingAction: 'VOID',
          processingStartedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!locked) {
      continue;
    }

    try {
      const voidRequestId = locked.paypalVoidRequestId || uuidv4();
      if (!locked.paypalVoidRequestId) {
        locked.paypalVoidRequestId = voidRequestId;
        await locked.save();
      }

      if (locked.paypalAuthorizationId) {
        await voidPayPalAuthorization(locked.paypalAuthorizationId, voidRequestId);
      }

      locked.status = 'VOIDED';
      locked.decision = 'EXPIRED';
      locked.decidedAt = new Date();
      locked.processingAction = null;
      locked.processingStartedAt = null;
      await locked.save();
      voidedCount++;
      console.log(`[Holds] Auto-expired & voided held payment ${locked._id}`);
    } catch (err: any) {
      console.error(`[Holds] Failed to void expired payment ${locked._id}:`, err?.message || err);
      // Revert to HELD so subsequent checks can retry or fail gracefully
      locked.status = 'HELD';
      locked.processingAction = null;
      locked.processingStartedAt = null;
      await locked.save();
    }
  }

  return voidedCount;
}

/**
 * Family dashboard query: lists pending or all holds for a family member.
 * Safe to include hold tokens because this is the authenticated family view.
 */
export async function getFamilyHolds(familyId: string, statusFilter: string = 'pending') {
  await lazyCheckExpiredHolds();

  const query: any = { familyId };
  if (statusFilter === 'pending') {
    query.status = 'HELD';
  }

  const payments = await Payment.find(query).sort({ createdAt: -1 });

  return payments.map((p) => ({
    token: p.holdToken,
    paymentId: p._id.toString(),
    amount: p.amount,
    currency: p.currency,
    payeeLabel: p.payeeLabel,
    message: p.message,
    risk: p.risk,
    reasons: Array.from(new Set([...p.rulesResult.flags, ...p.aiResult.reasons])),
    familySummary: p.aiResult.familySummary || 'Needs review.',
    expiresAt: p.expiresAt,
    status: p.status,
    decision: p.decision,
    decidedAt: p.decidedAt,
    createdAt: p.createdAt,
  }));
}

/**
 * Retrieves a single hold by its unguessable secure holdToken.
 */
export async function getHoldByToken(token: string) {
  await lazyCheckExpiredHolds();

  const p = await Payment.findOne({ holdToken: token });
  if (!p) {
    return null;
  }

  return {
    token: p.holdToken,
    paymentId: p._id.toString(),
    amount: p.amount,
    currency: p.currency,
    payeeLabel: p.payeeLabel,
    message: p.message,
    risk: p.risk,
    reasons: Array.from(new Set([...p.rulesResult.flags, ...p.aiResult.reasons])),
    familySummary: p.aiResult.familySummary || 'Needs review.',
    expiresAt: p.expiresAt,
    status: p.status,
    decision: p.decision,
    decidedAt: p.decidedAt,
    createdAt: p.createdAt,
  };
}

export interface DecisionResult {
  success: boolean;
  status: string;
  message: string;
  error?: string;
}

/**
 * Family Decision: Approve (CAPTURE) or Decline (VOID).
 * Strict atomic transition HELD -> PROCESSING (Rule #5) and idempotency key (Rule #6).
 * Section 5: Protects against race conditions, supports lease recovery, strictly validates capture.
 */
export async function processFamilyDecision(
  token: string,
  decision: 'approve' | 'decline'
): Promise<DecisionResult> {
  await lazyCheckExpiredHolds();

  const leaseCutoff = new Date(Date.now() - LEASE_MS);
  const action = decision === 'approve' ? 'CAPTURE' : 'VOID';

  // 1. Atomic lock: Only one concurrent request can process this hold
  const lockedPayment = await Payment.findOneAndUpdate(
    {
      holdToken: token,
      $or: [
        { status: 'HELD' },
        {
          status: 'PROCESSING',
          processingAction: action,
          processingStartedAt: { $lt: leaseCutoff },
        },
      ],
    },
    {
      $set: {
        status: 'PROCESSING',
        processingAction: action,
        processingStartedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!lockedPayment) {
    const current = await Payment.findOne({ holdToken: token });
    if (current?.status === 'CAPTURED') {
      return {
        success: true,
        status: 'CAPTURED',
        message: 'Payment has already been approved and captured.',
      };
    }
    if (current?.status === 'VOIDED') {
      return {
        success: true,
        status: 'VOIDED',
        message: 'Payment has already been voided.',
      };
    }
    return {
      success: false,
      status: 'CONFLICT',
      message: 'Payment decision is already in progress or hold has expired.',
      error: 'Invalid state or hold already settled.',
    };
  }

  try {
    if (decision === 'approve') {
      if (!lockedPayment.paypalAuthorizationId) {
        lockedPayment.status = 'HELD';
        lockedPayment.processingAction = null;
        lockedPayment.processingStartedAt = null;
        await lockedPayment.save();
        throw new Error('No PayPal authorization ID found on payment');
      }

      // Use persisted capture idempotency key, generating one only if not present
      const captureRequestId = lockedPayment.paypalCaptureRequestId || uuidv4();
      if (!lockedPayment.paypalCaptureRequestId) {
        lockedPayment.paypalCaptureRequestId = captureRequestId;
        await lockedPayment.save();
      }

      const captureResult = await capturePayPalAuthorization(
        lockedPayment.paypalAuthorizationId,
        captureRequestId
      );

      // Section 2: Strict capture validation
      if (!captureResult.captureId || captureResult.status !== 'COMPLETED') {
        throw new Error(`PayPal capture was not completed. Status: ${captureResult.status}`);
      }

      lockedPayment.status = 'CAPTURED';
      lockedPayment.decision = 'APPROVED';
      lockedPayment.decidedAt = new Date();
      lockedPayment.paypalCaptureId = captureResult.captureId;
      lockedPayment.processingAction = null;
      lockedPayment.processingStartedAt = null;
      await lockedPayment.save();

      return {
        success: true,
        status: 'CAPTURED',
        message: 'Payment approved and sent successfully.',
      };
    } else {
      // Decline flow -> VOID authorization immediately
      const voidRequestId = lockedPayment.paypalVoidRequestId || uuidv4();
      if (!lockedPayment.paypalVoidRequestId) {
        lockedPayment.paypalVoidRequestId = voidRequestId;
        await lockedPayment.save();
      }

      if (lockedPayment.paypalAuthorizationId) {
        await voidPayPalAuthorization(
          lockedPayment.paypalAuthorizationId,
          voidRequestId
        );
      }

      lockedPayment.status = 'VOIDED';
      lockedPayment.decision = 'DECLINED';
      lockedPayment.decidedAt = new Date();
      lockedPayment.processingAction = null;
      lockedPayment.processingStartedAt = null;
      await lockedPayment.save();

      return {
        success: true,
        status: 'VOIDED',
        message: 'Payment was declined and voided. No money left the account.',
      };
    }
  } catch (err: any) {
    console.error(`[Holds] Error processing decision for hold ${token}:`, err?.message || err);
    // Transient failure: revert to HELD to allow retry with same persisted idempotency keys
    lockedPayment.status = 'HELD';
    lockedPayment.processingAction = null;
    lockedPayment.processingStartedAt = null;
    await lockedPayment.save();

    return {
      success: false,
      status: 'HELD',
      message: 'Failed to communicate with payment processor. Please try again.',
      error: err?.message || 'Processing error',
    };
  }
}

