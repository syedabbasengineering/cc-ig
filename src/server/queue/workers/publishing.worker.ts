import { Worker } from 'bullmq';
import { getRedisConnection } from '@/src/lib/redis';
import { prisma } from '@/src/lib/db/client';
import type { QueueJobData } from '@/src/types/workflow.types';

const connection = getRedisConnection();

export const publishingWorker = new Worker<QueueJobData['publishing']>(
  'publishing',
  async (job) => {
    const { runId, contentId, platform, scheduledFor } = job.data;

    try {
      console.log(`Starting publishing job for content ${contentId}`);

      // Get content details
      const content = await prisma.content.findUnique({
        where: { id: contentId },
        include: {
          workspace: true,
          run: true,
        },
      });

      if (!content) {
        throw new Error('Content not found');
      }

      // Check if scheduled for future
      if (scheduledFor && new Date(scheduledFor) > new Date()) {
        // Re-queue for later
        const delay = new Date(scheduledFor).getTime() - Date.now();
        await job.moveToDelayed(delay);
        console.log(`Content ${contentId} scheduled for ${scheduledFor}`);
        return { scheduled: true, scheduledFor };
      }

      // TODO: Implement actual publishing logic
      // This would integrate with platform APIs (Instagram, LinkedIn, Twitter)

      // For now, we'll simulate publishing
      console.log(`Publishing content to ${platform}`);

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Update content status
      await prisma.content.update({
        where: { id: contentId },
        data: {
          status: 'published',
          publishedAt: new Date(),
        },
      });

      // Update workflow run if all contents are published
      if (runId) {
        const remainingContents = await prisma.content.count({
          where: {
            runId,
            status: { notIn: ['published', 'rejected'] },
          },
        });

        if (remainingContents === 0) {
          // Calculate metrics
          const allContents = await prisma.content.findMany({
            where: { runId },
          });

          const metrics = {
            totalPublished: allContents.filter(c => c.status === 'published').length,
            totalRejected: allContents.filter(c => c.status === 'rejected').length,
            publishingRate: 0,
          };

          if (allContents.length > 0) {
            metrics.publishingRate = (metrics.totalPublished / allContents.length) * 100;
          }

          await prisma.workflowRun.update({
            where: { id: runId },
            data: {
              status: 'published',
              completedAt: new Date(),
              metrics: metrics as any,
            },
          });
        }
      }

      return {
        success: true,
        contentId,
        platform,
        publishedAt: new Date(),
      };
    } catch (error) {
      console.error(`Publishing failed for content ${contentId}:`, error);

      // Update content status to failed
      await prisma.content.update({
        where: { id: contentId },
        data: {
          status: 'draft', // Revert to draft on failure
        },
      });

      throw error;
    }
  },
  {
    connection,
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5'),
    limiter: {
      max: 10,
      duration: 60000, // 10 publishes per minute
    },
  }
);

// Event handlers
publishingWorker.on('completed', (job) => {
  console.log(`Publishing job ${job.id} completed successfully`);
});

publishingWorker.on('failed', (job, err) => {
  console.error(`Publishing job ${job?.id} failed:`, err);
});

publishingWorker.on('stalled', (jobId) => {
  console.warn(`Publishing job ${jobId} stalled and will be retried`);
});

export default publishingWorker;