import { Router, Request, Response } from 'express';
import {
  getFamilyHolds,
  getHoldByToken,
  processFamilyDecision,
} from '../controllers/holds.js';

const router = Router();

/**
 * GET /api/holds
 * Family dashboard query: returns holds for a family member.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const familyId = req.query.familyId as string;
    const status = (req.query.status as string) || 'pending';

    if (!familyId) {
      return res.status(400).json({ error: 'Missing required familyId query parameter.' });
    }

    const holds = await getFamilyHolds(familyId, status);
    return res.status(200).json({ holds });
  } catch (err: any) {
    console.error('[Route: holds] Error fetching family holds:', err?.message || err);
    return res.status(500).json({ error: 'Failed to retrieve holds.' });
  }
});

/**
 * GET /api/holds/:token
 * Single hold detail for the family approval screen.
 */
router.get('/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const hold = await getHoldByToken(token);

    if (!hold) {
      return res.status(404).json({ error: 'Hold not found or invalid token.' });
    }

    return res.status(200).json(hold);
  } catch (err: any) {
    console.error('[Route: holds] Error fetching hold by token:', err?.message || err);
    return res.status(500).json({ error: 'Failed to retrieve hold detail.' });
  }
});

/**
 * POST /api/holds/:token/decision
 * Approves or declines a held transaction.
 */
router.post('/:token/decision', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { decision } = req.body;

    if (!decision || (decision !== 'approve' && decision !== 'decline')) {
      return res.status(400).json({
        error: 'Invalid decision. Must be "approve" or "decline".',
      });
    }

    const result = await processFamilyDecision(token, decision);

    if (!result.success) {
      const statusCode = result.status === 'CONFLICT' ? 409 : 500;
      return res.status(statusCode).json({ error: result.message });
    }

    return res.status(200).json({
      status: result.status,
      message: result.message,
    });
  } catch (err: any) {
    console.error('[Route: holds] Error processing hold decision:', err?.message || err);
    return res.status(500).json({ error: 'Failed to submit decision.' });
  }
});

export default router;

