import { prisma } from '@/src/lib/db/client';
import { scrapingQueue, aiProcessingQueue, publishingQueue } from '@/src/server/queue';
import type { WorkflowConfig, WorkflowStatus } from '@/src/types/workflow.types';

export class WorkflowEngine {
  async executeWorkflow(
    workflowId: string,
    topic: string,
    brandVoiceSamples?: string[]
  ): Promise<string> {
    try {
      // Get workflow configuration
      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
        include: { workspace: true },
      });

      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      // Create workflow run record
      const run = await prisma.workflowRun.create({
        data: {
          workflowId,
          topic,
          brandVoiceSamples: brandVoiceSamples ? { samples: brandVoiceSamples } : undefined,
          status: 'pending',
        },
      });

      // Parse workflow config
      const config = workflow.config as unknown as WorkflowConfig;

      // Queue the scraping job
      await scrapingQueue.add(
        'scrape-content',
        {
          runId: run.id,
          topic,
          config: config.scrapingConfig,
        },
        {
          jobId: `scrape-${run.id}`,
        }
      );

      return run.id;
    } catch (error) {
      console.error('Error executing workflow:', error);
      throw error;
    }
  }

  async updateRunStatus(runId: string, status: WorkflowStatus, data?: any) {
    try {
      const updateData: any = { status };

      if (data) {
        switch (status) {
          case 'scraping':
            updateData.scrapedData = data;
            break;
          case 'analyzing':
            updateData.analysisData = data;
            break;
          case 'generating':
            updateData.generatedIdeas = data;
            break;
          case 'reviewing':
            updateData.finalContent = data;
            break;
          case 'published':
            updateData.completedAt = new Date();
            updateData.metrics = data;
            break;
          case 'failed':
            updateData.errors = data;
            updateData.completedAt = new Date();
            break;
        }
      }

      return await prisma.workflowRun.update({
        where: { id: runId },
        data: updateData,
      });
    } catch (error) {
      console.error('Error updating run status:', error);
      throw error;
    }
  }

  async getRunDetails(runId: string) {
    return await prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        workflow: {
          include: {
            workspace: true,
          },
        },
        contents: {
          include: {
            edits: true,
          },
        },
      },
    });
  }

  async cancelWorkflow(runId: string) {
    try {
      // Update status to failed
      await this.updateRunStatus(runId, 'failed', {
        reason: 'Cancelled by user',
        cancelledAt: new Date(),
      });

      // Remove any pending jobs from queues
      const jobs = await Promise.all([
        scrapingQueue.getJob(`scrape-${runId}`),
        aiProcessingQueue.getJob(`ai-${runId}`),
        publishingQueue.getJobs(['waiting', 'active']),
      ]);

      // Remove jobs related to this run
      for (const job of jobs.flat()) {
        if (job && job.data?.runId === runId) {
          await job.remove();
        }
      }

      return true;
    } catch (error) {
      console.error('Error cancelling workflow:', error);
      return false;
    }
  }

  async retryFailedRun(runId: string) {
    try {
      const run = await prisma.workflowRun.findUnique({
        where: { id: runId },
        include: { workflow: true },
      });

      if (!run || run.status !== 'failed') {
        throw new Error('Run not found or not in failed state');
      }

      // Reset the run status
      await prisma.workflowRun.update({
        where: { id: runId },
        data: {
          status: 'pending',
          errors: undefined,
          completedAt: undefined,
        },
      });

      // Re-queue the initial job
      const config = run.workflow.config as unknown as WorkflowConfig;
      await scrapingQueue.add(
        'scrape-content',
        {
          runId: run.id,
          topic: run.topic,
          config: config.scrapingConfig,
        },
        {
          jobId: `scrape-${run.id}-retry-${Date.now()}`,
        }
      );

      return true;
    } catch (error) {
      console.error('Error retrying failed run:', error);
      return false;
    }
  }

  async getWorkflowMetrics(workflowId: string) {
    const runs = await prisma.workflowRun.findMany({
      where: { workflowId },
      include: {
        contents: true,
      },
    });

    const metrics = {
      totalRuns: runs.length,
      successfulRuns: runs.filter(r => r.status === 'published').length,
      failedRuns: runs.filter(r => r.status === 'failed').length,
      averageCompletionTime: 0,
      totalContentGenerated: 0,
      approvalRate: 0,
    };

    const completedRuns = runs.filter(r => r.completedAt);
    if (completedRuns.length > 0) {
      const totalTime = completedRuns.reduce((sum, run) => {
        const duration = run.completedAt!.getTime() - run.startedAt.getTime();
        return sum + duration;
      }, 0);
      metrics.averageCompletionTime = totalTime / completedRuns.length;
    }

    metrics.totalContentGenerated = runs.reduce((sum, run) => sum + run.contents.length, 0);

    const approvedContent = runs.flatMap(r => r.contents).filter(c => c.status === 'approved' || c.status === 'published');
    const totalContent = runs.flatMap(r => r.contents);
    if (totalContent.length > 0) {
      metrics.approvalRate = (approvedContent.length / totalContent.length) * 100;
    }

    return metrics;
  }
}

export default WorkflowEngine;