import scrapingWorker from './scraping.worker';
import aiProcessingWorker from './ai-processing.worker';
import publishingWorker from './publishing.worker';

// Start all workers
export function startWorkers() {
  console.log('Starting queue workers...');

  // Workers are automatically started when imported
  console.log('✅ Scraping worker started');
  console.log('✅ AI processing worker started');
  console.log('✅ Publishing worker started');
}

// Graceful shutdown
export async function stopWorkers() {
  console.log('Stopping queue workers...');

  await Promise.all([
    scrapingWorker.close(),
    aiProcessingWorker.close(),
    publishingWorker.close(),
  ]);

  console.log('✅ All workers stopped');
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await stopWorkers();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await stopWorkers();
  process.exit(0);
});

export { scrapingWorker, aiProcessingWorker, publishingWorker };