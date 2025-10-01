import { Queue, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { prisma } from '../db/client';

/**
 * Dead Letter Queue system for failed jobs
 */

export interface FailedJob {
  id: string;
  queueName: string;
  jobName: string;
  data: any;
  error: string;
  stackTrace?: string;
  attemptsMade: number;
  failedAt: Date;
  originalJobId: string;
}

export class DeadLetterQueueManager {
  private redis: Redis;
  private dlqQueue: Queue;
  private queueEvents: Map<string, QueueEvents> = new Map();

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
    });

    this.dlqQueue = new Queue('dead-letter-queue', {
      connection: this.redis,
    });
  }

  /**
   * Setup DLQ monitoring for a queue
   */
  setupDLQ(queueName: string): void {
    const events = new QueueEvents(queueName, {
      connection: this.redis,
    });

    events.on('failed', async ({ jobId, failedReason, prev }) => {
      await this.handleFailedJob(queueName, jobId, failedReason);
    });

    this.queueEvents.set(queueName, events);
  }

  /**
   * Handle a failed job
   */
  private async handleFailedJob(
    queueName: string,
    jobId: string,
    failedReason: string
  ): Promise<void> {
    try {
      const queue = new Queue(queueName, { connection: this.redis });
      const job = await queue.getJob(jobId);

      if (!job) {
        console.error(`Job ${jobId} not found in queue ${queueName}`);
        return;
      }

      const failedJob: FailedJob = {
        id: `dlq-${Date.now()}-${jobId}`,
        queueName,
        jobName: job.name,
        data: job.data,
        error: failedReason,
        stackTrace: job.stacktrace?.join('\n'),
        attemptsMade: job.attemptsMade,
        failedAt: new Date(),
        originalJobId: jobId,
      };

      // Store in DLQ
      await this.dlqQueue.add('failed-job', failedJob, {
        removeOnComplete: false,
        removeOnFail: false,
      });

      // Log to database for persistence
      await this.logFailedJob(failedJob);

      console.log(`Job ${jobId} moved to dead letter queue`);
    } catch (error) {
      console.error('Error handling failed job:', error);
    }
  }

  /**
   * Log failed job to database
   */
  private async logFailedJob(failedJob: FailedJob): Promise<void> {
    try {
      // This would require a FailedJob model in Prisma
      // For now, we'll log it
      console.log('Failed job logged:', {
        id: failedJob.id,
        queue: failedJob.queueName,
        job: failedJob.jobName,
        error: failedJob.error,
        attempts: failedJob.attemptsMade,
      });
    } catch (error) {
      console.error('Error logging failed job:', error);
    }
  }

  /**
   * Get all failed jobs
   */
  async getFailedJobs(limit: number = 50): Promise<FailedJob[]> {
    const jobs = await this.dlqQueue.getJobs(['completed', 'waiting'], 0, limit);
    return jobs.map((job) => job.data as FailedJob);
  }

  /**
   * Retry a failed job
   */
  async retryJob(failedJobId: string): Promise<boolean> {
    try {
      const jobs = await this.dlqQueue.getJobs(['completed', 'waiting']);
      const failedJob = jobs.find((j) => j.data.id === failedJobId);

      if (!failedJob) {
        console.error(`Failed job ${failedJobId} not found`);
        return false;
      }

      const data = failedJob.data as FailedJob;

      // Add back to original queue
      const originalQueue = new Queue(data.queueName, {
        connection: this.redis,
      });

      await originalQueue.add(data.jobName, data.data, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      // Remove from DLQ
      await failedJob.remove();

      console.log(`Retried job ${failedJobId} in queue ${data.queueName}`);
      return true;
    } catch (error) {
      console.error('Error retrying job:', error);
      return false;
    }
  }

  /**
   * Retry all failed jobs for a specific queue
   */
  async retryQueueJobs(queueName: string): Promise<number> {
    const jobs = await this.getFailedJobs(1000);
    const queueJobs = jobs.filter((j) => j.queueName === queueName);

    let retriedCount = 0;
    for (const job of queueJobs) {
      const success = await this.retryJob(job.id);
      if (success) retriedCount++;
    }

    return retriedCount;
  }

  /**
   * Delete a failed job permanently
   */
  async deleteJob(failedJobId: string): Promise<boolean> {
    try {
      const jobs = await this.dlqQueue.getJobs(['completed', 'waiting']);
      const failedJob = jobs.find((j) => j.data.id === failedJobId);

      if (!failedJob) {
        return false;
      }

      await failedJob.remove();
      console.log(`Deleted failed job ${failedJobId}`);
      return true;
    } catch (error) {
      console.error('Error deleting job:', error);
      return false;
    }
  }

  /**
   * Get failure statistics
   */
  async getStatistics(): Promise<{
    totalFailed: number;
    failuresByQueue: Record<string, number>;
    failuresByError: Record<string, number>;
  }> {
    const jobs = await this.getFailedJobs(1000);

    const failuresByQueue: Record<string, number> = {};
    const failuresByError: Record<string, number> = {};

    for (const job of jobs) {
      failuresByQueue[job.queueName] = (failuresByQueue[job.queueName] || 0) + 1;

      const errorType = job.error.split(':')[0];
      failuresByError[errorType] = (failuresByError[errorType] || 0) + 1;
    }

    return {
      totalFailed: jobs.length,
      failuresByQueue,
      failuresByError,
    };
  }

  /**
   * Cleanup old failed jobs
   */
  async cleanup(olderThanDays: number = 30): Promise<number> {
    const jobs = await this.getFailedJobs(1000);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    let deletedCount = 0;
    for (const job of jobs) {
      if (new Date(job.failedAt) < cutoffDate) {
        const success = await this.deleteJob(job.id);
        if (success) deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    for (const events of this.queueEvents.values()) {
      await events.close();
    }
    await this.dlqQueue.close();
    await this.redis.quit();
  }
}

// Singleton instance
export const dlqManager = new DeadLetterQueueManager();
