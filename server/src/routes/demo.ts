import { Router, Request, Response } from 'express';
import { User } from '../models/User.js';
import { FamilyLink } from '../models/FamilyLink.js';

const router = Router();

export async function getOrCreateDemoUsers() {
  let elder = await User.findOne({ role: 'elder' });
  if (!elder) {
    elder = await User.create({
      name: 'Margaret Davis',
      role: 'elder',
      email: 'margaret@example.com',
      phone: '+15551234567',
    });
  }

  let family = await User.findOne({ role: 'family' });
  if (!family) {
    family = await User.create({
      name: 'Sarah Davis',
      role: 'family',
      email: 'sarah@example.com',
      phone: '+15559876543',
    });
  }

  let link = await FamilyLink.findOne({ elderId: elder._id });
  if (!link) {
    link = await FamilyLink.create({
      elderId: elder._id,
      familyId: family._id,
      amountLimit: 100,
    });
  }

  return { elder, family, link };
}

/**
 * GET /api/demo/users
 * Returns seeded demo elder and family member identities for rapid testing.
 */
router.get('/users', async (_req: Request, res: Response) => {
  try {
    const { elder, family, link } = await getOrCreateDemoUsers();

    return res.status(200).json({
      elder: {
        _id: elder._id.toString(),
        name: elder.name,
        role: elder.role,
        email: elder.email,
      },
      family: {
        _id: family._id.toString(),
        name: family.name,
        role: family.role,
        email: family.email,
      },
      familyLink: {
        amountLimit: link.amountLimit,
      },
    });
  } catch (err: any) {
    console.error('[Route: demo] Error retrieving demo users:', err?.message || err);
    return res.status(500).json({ error: 'Failed to retrieve demo users.' });
  }
});

/**
 * POST /api/demo/seed
 * Explicit seeding endpoint for database setup.
 */
router.post('/seed', async (_req: Request, res: Response) => {
  try {
    const { elder, family, link } = await getOrCreateDemoUsers();
    return res.status(200).json({
      message: 'Demo users seeded successfully.',
      elderId: elder._id,
      familyId: family._id,
      amountLimit: link.amountLimit,
    });
  } catch (err: any) {
    console.error('[Route: demo] Error seeding demo users:', err?.message || err);
    return res.status(500).json({ error: 'Failed to seed demo users.' });
  }
});

export default router;

