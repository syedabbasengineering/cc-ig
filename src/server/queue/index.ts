import { Queue, Worker, QueueEvents } from 'bullmq';
import { getRedisConnection } from '@/src/lib/redis';
import type { QueueJobData } from '@/src/types/workflow.types';

const connection = getRedisConnection();

// Queue instances
export const scrapingQueue = new Queue<QueueJobData['scraping']>('scraping', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
});

export const aiProcessingQueue = new Queue<QueueJobData['aiProcessing']>('ai-processing', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 3600,
      count: 50,
    },
    removeOnFail: {
      age: 7 * 24 * 3600,
    },
  },
});

export const publishingQueue = new Queue<QueueJobData['publishing']>('publishing', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
    removeOnComplete: {
      age: 7 * 24 * 3600,
      count: 100,
    },
    removeOnFail: {
      age: 30 * 24 * 3600,
    },
  },
});

// Queue Events for monitoring
export const scrapingQueueEvents = new QueueEvents('scraping', { connection });
export const aiProcessingQueueEvents = new QueueEvents('ai-processing', { connection });
export const publishingQueueEvents = new QueueEvents('publishing', { connection });

// Queue monitoring
scrapingQueueEvents.on('completed', ({ jobId, returnvalue }) => {
  console.log(`Scraping job ${jobId} completed:`, returnvalue);
});

scrapingQueueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`Scraping job ${jobId} failed:`, failedReason);
});

aiProcessingQueueEvents.on('completed', ({ jobId, returnvalue }) => {
  console.log(`AI processing job ${jobId} completed:`, returnvalue);
});

aiProcessingQueueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`AI processing job ${jobId} failed:`, failedReason);
});

publishingQueueEvents.on('completed', ({ jobId, returnvalue }) => {
  console.log(`Publishing job ${jobId} completed:`, returnvalue);
});

publishingQueueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`Publishing job ${jobId} failed:`, failedReason);
});

// Utility functions
export const getQueueStatus = async (queueName: 'scraping' | 'ai-processing' | 'publishing') => {
  const queue = queueName === 'scraping'
    ? scrapingQueue
    : queueName === 'ai-processing'
    ? aiProcessingQueue
    : publishingQueue;

  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    total: waiting + active + completed + failed,
  };
};

export const cleanQueues = async () => {
  await Promise.all([
    scrapingQueue.obliterate({ force: true }),
    aiProcessingQueue.obliterate({ force: true }),
    publishingQueue.obliterate({ force: true }),
  ]);
};

const queueManager = {
  scrapingQueue,
  aiProcessingQueue,
  publishingQueue,
  getQueueStatus,
  cleanQueues,
};

export default queueManager;