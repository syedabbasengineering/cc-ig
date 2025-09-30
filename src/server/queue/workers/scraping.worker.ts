import { Worker } from 'bullmq';
import { getRedisConnection } from '@/src/lib/redis';
import { InstagramScraper } from '@/src/lib/scrapers/instagram-scraper';
import { prisma } from '@/src/lib/db/client';
import { aiProcessingQueue } from '../index';
import type { QueueJobData } from '@/src/types/workflow.types';

const connection = getRedisConnection();

export const scrapingWorker = new Worker<QueueJobData['scraping']>(
  'scraping',
  async (job) => {
    const { runId, topic, config } = job.data;

    try {
      console.log(`Starting scraping job for run ${runId}, topic: ${topic}`);

      // Update status to scraping
      await prisma.workflowRun.update({
        where: { id: runId },
        data: { status: 'scraping' },
      });

      // Initialize scraper
      const scraper = new InstagramScraper(process.env.APIFY_TOKEN || '');

      // Scrape Instagram posts
      const posts = await scraper.scrapeByTopic(topic, {
        count: config.count,
        minEngagement: config.minEngagement,
        timeframe: config.timeframe,
      });

      if (posts.length === 0) {
        throw new Error('No posts found matching criteria');
      }

      // Analyze the scraped content
      const analysis = await scraper.analyzeContent(posts);

      // Save scraped data to database
      await prisma.workflowRun.update({
        where: { id: runId },
        data: {
          scrapedData: { posts, analysis } as any,
          status: 'analyzing',
        },
      });

      // Get workflow run details for brand voice
      const run = await prisma.workflowRun.findUnique({
        where: { id: runId },
        include: {
          workflow: {
            include: {
              workspace: true,
            },
          },
        },
      });

      // Queue AI processing job
      await aiProcessingQueue.add(
        'process-content',
        {
          runId,
          scrapedData: { posts, analysis },
          brandVoice: run?.workflow.workspace.brandVoice as any,
        },
        {
          jobId: `ai-${runId}`,
        }
      );

      return {
        success: true,
        postsScraped: posts.length,
        avgEngagement: analysis.avgEngagement,
        topHashtags: analysis.hashtags.slice(0, 5),
      };
    } catch (error) {
      console.error(`Scraping job failed for run ${runId}:`, error);

      // Update status to failed
      await prisma.workflowRun.update({
        where: { id: runId },
        data: {
          status: 'failed',
          errors: {
            stage: 'scraping',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
          } as any,
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
      duration: 60000, // 10 jobs per minute
    },
  }
);

// Event handlers
scrapingWorker.on('completed', (job) => {
  console.log(`Scraping job ${job.id} completed successfully`);
});

scrapingWorker.on('failed', (job, err) => {
  console.error(`Scraping job ${job?.id} failed:`, err);
});

scrapingWorker.on('stalled', (jobId) => {
  console.warn(`Scraping job ${jobId} stalled and will be retried`);
});

export default scrapingWorker;