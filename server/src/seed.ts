import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import { User } from './models/User.js';
import { FamilyLink } from './models/FamilyLink.js';
import { Payment } from './models/Payment.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

async function seed() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri || mongoUri.includes('username:password')) {
    console.error('❌ MONGODB_URI not configured in .env. Exiting seed script.');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB.');

    // Clear existing demo records
    await Payment.deleteMany({});
    await FamilyLink.deleteMany({});
    await User.deleteMany({});

    console.log('🧹 Cleaned existing demo data.');

    // Create Elder
    const elder = await User.create({
      name: 'Margaret Davis',
      role: 'elder',
      email: 'margaret.davis@example.com',
      phone: '+15551234567',
    });

    // Create Family Approver
    const family = await User.create({
      name: 'Sarah Davis',
      role: 'family',
      email: 'sarah.davis@example.com',
      phone: '+15559876543',
    });

    // Create Family Link with $100 spending threshold
    const link = await FamilyLink.create({
      elderId: elder._id,
      familyId: family._id,
      amountLimit: 100,
    });

    console.log('🌱 Seeded Demo Users:');
    console.log(`   Elder:  ${elder.name} (ID: ${elder._id})`);
    console.log(`   Family: ${family.name} (ID: ${family._id})`);
    console.log(`   Limit:  $${link.amountLimit}`);

    await mongoose.disconnect();
    console.log('✅ Seeding completed successfully.');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Seeding failed:', err?.message || err);
    process.exit(1);
  }
}

seed();

