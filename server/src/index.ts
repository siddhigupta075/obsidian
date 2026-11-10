import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import apiRouter from './routes/index.js';
import { lazyCheckExpiredHolds } from './controllers/holds.js';

// Load environment variables from .env in server directory or root directory
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint (does not touch database - Rule #11 & API Spec #8)
app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

// Mount Main API Routes
app.use('/api', apiRouter);

// Serve built frontend if client/dist exists (single-service Render deployment)
const distPath = [
  path.resolve(process.cwd(), '../client/dist'),
  path.resolve(process.cwd(), 'client/dist'),
].find(fs.existsSync);

if (distPath) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // Root informative fallback when frontend is not built
  app.get('/', (_req, res) => {
    res.status(200).json({
      name: 'Second Sight API',
      tagline: 'Pause the payment. Not the person.',
      status: 'online',
      docs: '/api-docs',
      health: '/health',
    });
  });
}

// Secondary Guard: Background lazy check interval every 30 seconds
const BACKGROUND_CHECK_INTERVAL_MS = 30000;
const backgroundTimer = setInterval(async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      await lazyCheckExpiredHolds();
    }
  } catch (err: any) {
    console.error('[Background Expiry Guard] Error checking holds:', err?.message || err);
  }
}, BACKGROUND_CHECK_INTERVAL_MS);

// Connect to MongoDB
async function startServer() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri || mongoUri.includes('username:password')) {
    console.warn(
      '⚠️ [Database] MONGODB_URI is not configured or using default placeholders. Database operations will fail until connected.'
    );
  } else {
    try {
      await mongoose.connect(mongoUri);
      console.log('✅ [Database] Connected successfully to MongoDB Atlas.');
    } catch (err: any) {
      console.error('❌ [Database] MongoDB connection error:', err?.message || err);
    }
  }

  const server = app.listen(PORT, () => {
    console.log(`🚀 [Server] Second Sight backend listening on port ${PORT}`);
    console.log(`🔗 Health check available at http://localhost:${PORT}/health`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[Server] Shutting down gracefully...');
    clearInterval(backgroundTimer);
    server.close(async () => {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
      }
      console.log('[Server] Closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer();

