#!/usr/bin/env node

const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Import and start workers
async function startWorkers() {
  try {
    console.log('🚀 Starting AI Content Workflow Workers...');

    // Dynamically import the workers module
    const { startWorkers } = await import('../src/server/queue/workers/index.js');

    startWorkers();

    console.log('✅ All workers are running');
    console.log('Press Ctrl+C to stop');

    // Keep the process alive
    process.stdin.resume();
  } catch (error) {
    console.error('❌ Failed to start workers:', error);
    process.exit(1);
  }
}

startWorkers();