import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import { FamilyLink } from '../models/FamilyLink.js';
import { Payment, PaymentRisk } from '../models/Payment.js';
import { evaluateRules } from '../controllers/risk.js';
import { evaluateAiScam } from '../controllers/ai.js';

const router = Router();

function maxRisk(r1: PaymentRisk, r2: PaymentRisk): PaymentRisk {
  const scores: Record<PaymentRisk, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
  return scores[r1] >= scores[r2] ? r1 : r2;
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const { elderId, amount, payeeLabel, message } = req.body;

    if (!elderId || typeof amount !== 'number' || !payeeLabel) {
      return res.status(400).json({
        error: 'Missing required fields: elderId, amount (number), and payeeLabel.',
      });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than zero.' });
    }

    // 1. Fetch spending limits & family link
    let amountLimit = 100;
    let familyId = elderId;
    if (mongoose.connection.readyState === 1) {
      const link = await FamilyLink.findOne({ elderId });
      amountLimit = link?.amountLimit ?? 100;
      familyId = link?.familyId || elderId; // Fallback to elderId if not yet linked
    }

    // 2. Deterministic Rule Evaluation (risk.ts)
    const rulesResult = evaluateRules({
      amount,
      payeeLabel,
      message,
      amountLimit,
    });

    // 3. AI Semantic Scam Evaluation (ai.ts)
    const { aiResult, aiFailed } = await evaluateAiScam({
      amount,
      payeeLabel,
      message,
    });

    // 4. Risk Aggregator: finalRisk = max(rules, AI)
    const finalRisk = maxRisk(rulesResult.risk, aiResult.risk);
    const willHold = finalRisk === 'MEDIUM' || finalRisk === 'HIGH';

    // Combine explanation reasons
    const reasons = Array.from(new Set([...rulesResult.flags, ...aiResult.reasons]));

    // Generate secure hold token for family access (NEVER leaked to elder screen)
    const holdToken = uuidv4();

    // 5. Persist locked payment record (Rule #1: Server sets amount and payee)
    let paymentId = uuidv4();
    if (mongoose.connection.readyState === 1) {
      const payment = new Payment({
        elderId,
        familyId,
        amount,
        currency: 'USD',
        payeeLabel,
        message: message || '',
        rulesResult,
        aiResult,
        aiFailed,
        risk: finalRisk,
        status: 'CHECKED',
        holdToken,
      });

      await payment.save();
      paymentId = payment._id.toString();
    }

    return res.status(200).json({
      paymentId,
      risk: finalRisk,
      reasons: reasons.slice(0, 4),
      questionForElder:
        aiResult.questionForElder ||
        'Did someone ask you to send this money right now?',
      willHold,
    });
  } catch (err: any) {
    console.error('[Route: check] Error processing payment check:', err?.message || err);
    return res.status(500).json({ error: 'Failed to evaluate transaction.' });
  }
});

export default router;

