/**
 * Worker Process Entry Point
 * Run this file separately to start background job processors
 * Usage: npm run worker
 */

import dotenv from 'dotenv';
dotenv.config();

import { workers, shutdownWorkers } from './workers/index.js';
import logger from './utils/logger.js';

logger.info('🚀 Starting background job workers...');

// Log worker status
Object.keys(workers).forEach((workerName) => {
  logger.info(`✓ ${workerName} worker started`);
});

logger.info('✅ All workers are running');

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('\n🛑 Received SIGTERM, shutting down gracefully...');
  await shutdownWorkers();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('\n🛑 Received SIGINT, shutting down gracefully...');
  await shutdownWorkers();
  process.exit(0);
});

// Keep the process alive
process.on('uncaughtException', (error) => {
  logger.error('❌ Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  logger.error('❌ Unhandled rejection:', reason);
});

// Log every minute
setInterval(() => {
  logger.info(`⏰ Workers alive - ${new Date().toISOString()}`);
}, 60000);
