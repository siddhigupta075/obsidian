import { v4 as uuidv4 } from 'uuid';
import { Payment, IPayment } from '../models/Payment.js';
import {
  capturePayPalAuthorization,
  voidPayPalAuthorization,
} from './paypal.js';

/**
 * Lazy expiry worker: Identifies and voids holds whose timer expired.
 * Complies with free-tier Render constraints (Rule #11).
 */
export async function lazyCheckExpiredHolds(): Promise<number> {
  const now = new Date();
  const expiredPayments = await Payment.find({
    status: 'HELD',
    expiresAt: { $lte: now },
  });

  let voidedCount = 0;

  for (const payment of expiredPayments) {
    // Atomic status transition HELD -> PROCESSING (Rule #5)
    const locked = await Payment.findOneAndUpdate(
      { _id: payment._id, status: 'HELD' },
      { status: 'PROCESSING' },
      { new: true }
    );

    if (!locked) {
      continue;
    }

    try {
      if (locked.paypalAuthorizationId) {
        const idempotencyKey = uuidv4();
        await voidPayPalAuthorization(locked.paypalAuthorizationId, idempotencyKey);
      }

      locked.status = 'VOIDED';
      locked.decision = 'EXPIRED';
      locked.decidedAt = new Date();
      await locked.save();
      voidedCount++;
      console.log(`[Holds] Auto-expired & voided held payment ${locked._id}`);
    } catch (err: any) {
      console.error(`[Holds] Failed to void expired payment ${locked._id}:`, err?.message || err);
      // Revert to HELD so subsequent checks can retry or fail gracefully
      locked.status = 'HELD';
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
    reasons: p.rulesResult.flags.concat(p.aiResult.reasons),
    familySummary: p.aiResult.familySummary || 'Needs review.',
    expiresAt: p.expiresAt,
    status: p.status,
    decision: p.decision,
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
    reasons: p.rulesResult.flags.concat(p.aiResult.reasons),
    familySummary: p.aiResult.familySummary || 'Needs review.',
    expiresAt: p.expiresAt,
    status: p.status,
    decision: p.decision,
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
 */
export async function processFamilyDecision(
  token: string,
  decision: 'approve' | 'decline'
): Promise<DecisionResult> {
  await lazyCheckExpiredHolds();

  // 1. Atomic lock: Only one concurrent request can process this hold
  const lockedPayment = await Payment.findOneAndUpdate(
    { holdToken: token, status: 'HELD' },
    { status: 'PROCESSING' },
    { new: true }
  );

  if (!lockedPayment) {
    return {
      success: false,
      status: 'CONFLICT',
      message: 'Payment has already been processed or expired.',
      error: 'Invalid state or hold already settled.',
    };
  }

  const idempotencyKey = uuidv4();

  try {
    if (decision === 'approve') {
      if (!lockedPayment.paypalAuthorizationId) {
        throw new Error('No PayPal authorization ID found on payment');
      }

      const captureResult = await capturePayPalAuthorization(
        lockedPayment.paypalAuthorizationId,
        idempotencyKey
      );

      lockedPayment.status = 'CAPTURED';
      lockedPayment.decision = 'APPROVED';
      lockedPayment.decidedAt = new Date();
      lockedPayment.paypalCaptureId = captureResult.captureId;
      await lockedPayment.save();

      return {
        success: true,
        status: 'CAPTURED',
        message: 'Payment approved and sent successfully.',
      };
    } else {
      // Decline flow -> VOID authorization immediately
      if (lockedPayment.paypalAuthorizationId) {
        await voidPayPalAuthorization(
          lockedPayment.paypalAuthorizationId,
          idempotencyKey
        );
      }

      lockedPayment.status = 'VOIDED';
      lockedPayment.decision = 'DECLINED';
      lockedPayment.decidedAt = new Date();
      await lockedPayment.save();

      return {
        success: true,
        status: 'VOIDED',
        message: 'Payment was declined and voided. No money left the account.',
      };
    }
  } catch (err: any) {
    console.error(`[Holds] Error processing decision for hold ${token}:`, err?.message || err);
    // Transient failure: revert to HELD to allow retry
    lockedPayment.status = 'HELD';
    await lockedPayment.save();

    return {
      success: false,
      status: 'HELD',
      message: 'Failed to communicate with payment processor. Please try again.',
      error: err?.message || 'Processing error',
    };
  }
}

