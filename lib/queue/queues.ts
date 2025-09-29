import { Queue } from 'bullmq'
import redisConnection from './connection'

// Define queue names
export const QUEUE_NAMES = {
  SCRAPING: 'scraping',
  AI_PROCESSING: 'ai-processing',
  PUBLISHING: 'publishing',
} as const

// Create queues
export const scrapingQueue = new Queue(QUEUE_NAMES.SCRAPING, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
})

export const aiProcessingQueue = new Queue(QUEUE_NAMES.AI_PROCESSING, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
  },
})

export const publishingQueue = new Queue(QUEUE_NAMES.PUBLISHING, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 20,
    removeOnFail: 5,
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
})

// Export all queues
export const queues = {
  scraping: scrapingQueue,
  aiProcessing: aiProcessingQueue,
  publishing: publishingQueue,
}