import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { FamilyLink } from '../models/FamilyLink.js';
import { Payment, PaymentRisk } from '../models/Payment.js';
import { evaluateRules } from '../controllers/risk.js';
import { evaluateAiScam } from '../controllers/ai.js';
import { getOrCreateDemoUsers } from './demo.js';

const router = Router();

function maxRisk(r1: PaymentRisk, r2: PaymentRisk): PaymentRisk {
  const scores: Record<PaymentRisk, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
  return scores[r1] >= scores[r2] ? r1 : r2;
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const { elderId, amount, payeeLabel, message } = req.body;

    if (typeof amount !== 'number' || !payeeLabel) {
      return res.status(400).json({
        error: 'Missing required fields: amount (number), and payeeLabel.',
      });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than zero.' });
    }

    // 1. Resolve valid elder and family identity (fallback to seeded demo users)
    let validElderId: mongoose.Types.ObjectId;
    let validFamilyId: mongoose.Types.ObjectId;
    let amountLimit = 100;

    if (!elderId || !mongoose.isValidObjectId(elderId)) {
      const demo = await getOrCreateDemoUsers();
      validElderId = demo.elder._id as mongoose.Types.ObjectId;
      validFamilyId = demo.family._id as mongoose.Types.ObjectId;
      amountLimit = demo.link.amountLimit ?? 100;
    } else {
      validElderId = new mongoose.Types.ObjectId(elderId);
      const link = await FamilyLink.findOne({ elderId: validElderId });
      if (!link) {
        return res.status(400).json({
          error: 'No family link found for the provided elder ID.',
        });
      }
      if (!link.familyId || !mongoose.isValidObjectId(link.familyId)) {
        return res.status(400).json({
          error: 'Invalid family ID associated with elder in family link.',
        });
      }
      validFamilyId = link.familyId as mongoose.Types.ObjectId;
      amountLimit = link.amountLimit ?? 100;
    }

    if (!mongoose.isValidObjectId(validElderId) || !mongoose.isValidObjectId(validFamilyId)) {
      return res.status(400).json({
        error: 'Invalid elder ID or family ID.',
      });
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
    const payment = new Payment({
      elderId: validElderId,
      familyId: validFamilyId,
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
    const paymentId = payment._id.toString();

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
