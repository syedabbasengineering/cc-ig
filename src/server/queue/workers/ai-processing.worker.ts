import { Worker } from 'bullmq';
import { getRedisConnection } from '@/src/lib/redis';
import { prisma } from '@/src/lib/db/client';
import { BrandVoiceAnalyzerAgent } from '@/src/lib/agents/brand-voice-analyzer';
import { IdeaGeneratorAgent } from '@/src/lib/agents/idea-generator';
import { ContentWriterAgent } from '@/src/lib/agents/content-writer';
import type { QueueJobData, BrandVoiceProfile } from '@/src/types/workflow.types';

const connection = getRedisConnection();

export const aiProcessingWorker = new Worker<QueueJobData['aiProcessing']>(
  'ai-processing',
  async (job) => {
    const { runId, scrapedData, brandVoice } = job.data;

    try {
      console.log(`Starting AI processing for run ${runId}`);

      // Update status to generating
      await prisma.workflowRun.update({
        where: { id: runId },
        data: { status: 'generating' },
      });

      // Get workflow run details
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

      if (!run) {
        throw new Error('Workflow run not found');
      }

      // Analyze brand voice if samples provided
      let finalBrandVoice: BrandVoiceProfile | null = brandVoice || null;

      if (run.brandVoiceSamples && (run.brandVoiceSamples as any).samples) {
        const voiceAnalyzer = new BrandVoiceAnalyzerAgent();
        const samples = (run.brandVoiceSamples as any).samples as string[];
        const analyzedVoice = await voiceAnalyzer.analyzeBrandVoice(samples);

        // Merge with existing brand voice
        if (brandVoice) {
          finalBrandVoice = await voiceAnalyzer.mergeBrandVoices(brandVoice, analyzedVoice);
        } else {
          finalBrandVoice = analyzedVoice;
        }

        // Update workspace brand voice
        await prisma.workspace.update({
          where: { id: run.workflow.workspaceId },
          data: { brandVoice: finalBrandVoice as any },
        });

        // Store samples in database
        await Promise.all(
          samples.map(sample =>
            prisma.brandVoiceSample.create({
              data: {
                workspaceId: run.workflow.workspaceId,
                content: sample,
                source: 'user_provided',
                metadata: { runId },
              },
            })
          )
        );
      }

      // Generate content ideas
      const ideaGenerator = new IdeaGeneratorAgent();
      const ideas = await ideaGenerator.generateIdeas(scrapedData, finalBrandVoice);

      // Rank ideas
      const rankedIdeas = await ideaGenerator.rankIdeas(ideas);

      // Generate content for top 5 ideas
      const contentWriter = new ContentWriterAgent();
      const contents = await Promise.all(
        rankedIdeas.slice(0, 5).map(idea =>
          contentWriter.writeContent(idea, null, finalBrandVoice)
        )
      );

      // Save generated content to database
      const savedContents = await Promise.all(
        contents.map(content =>
          prisma.content.create({
            data: {
              workspaceId: run.workflow.workspaceId,
              runId,
              platform: 'instagram',
              type: content.type,
              content: content as any,
              originalContent: content as any,
              status: 'reviewing',
            },
          })
        )
      );

      // Update workflow run with generated data
      await prisma.workflowRun.update({
        where: { id: runId },
        data: {
          generatedIdeas: ideas as any,
          finalContent: contents as any,
          status: 'reviewing',
        },
      });

      // Send Slack notification
      try {
        const { slackNotificationService } = await import('@/src/lib/integrations/slack');
        await slackNotificationService.notifyContentReady(
          runId,
          savedContents,
          run.workflow.workspace.name
        );
      } catch (error) {
        console.error('Failed to send Slack notification:', error);
      }

      return {
        success: true,
        ideasGenerated: ideas.length,
        contentsCreated: savedContents.length,
        brandVoiceAnalyzed: !!finalBrandVoice,
      };
    } catch (error) {
      console.error(`AI processing failed for run ${runId}:`, error);

      // Update status to failed
      await prisma.workflowRun.update({
        where: { id: runId },
        data: {
          status: 'failed',
          errors: {
            stage: 'ai-processing',
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
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '3'),
    limiter: {
      max: 5,
      duration: 60000, // 5 jobs per minute (AI API rate limits)
    },
  }
);

// Event handlers
aiProcessingWorker.on('completed', (job) => {
  console.log(`AI processing job ${job.id} completed successfully`);
});

aiProcessingWorker.on('failed', (job, err) => {
  console.error(`AI processing job ${job?.id} failed:`, err);
});

aiProcessingWorker.on('stalled', (jobId) => {
  console.warn(`AI processing job ${jobId} stalled and will be retried`);
});

export default aiProcessingWorker;