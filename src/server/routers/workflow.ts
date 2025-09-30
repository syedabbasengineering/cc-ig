import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { WorkflowEngine } from '@/src/lib/workflow/workflow-engine';
import { WorkflowExecutor } from '@/src/lib/workflow/workflow-executor';
import type { WorkflowConfig } from '@/src/types/workflow.types';

export const workflowRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        workspaceId: z.string(),
        config: z.object({
          scrapingConfig: z.object({
            platform: z.enum(['instagram', 'linkedin', 'twitter']),
            count: z.number().min(1).max(500),
            minEngagement: z.number().min(0),
            timeframe: z.string().optional(),
          }),
          aiConfig: z.object({
            ideaCount: z.number().min(1).max(50),
            contentVariations: z.number().min(1).max(10),
            model: z.string().optional(),
            temperature: z.number().min(0).max(2).optional(),
          }),
          publishingConfig: z.object({
            autoPublish: z.boolean(),
            scheduleTime: z.date().optional(),
            platforms: z.array(z.string()),
          }).optional(),
        }).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const defaultConfig: WorkflowConfig = {
        scrapingConfig: {
          platform: 'instagram',
          count: 100,
          minEngagement: 1000,
          timeframe: '7d',
        },
        aiConfig: {
          ideaCount: 10,
          contentVariations: 3,
        },
      };

      return await ctx.prisma.workflow.create({
        data: {
          name: input.name,
          workspaceId: input.workspaceId,
          config: (input.config || defaultConfig) as any,
        },
      });
    }),

  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      return await ctx.prisma.workflow.findMany({
        where: { workspaceId: input.workspaceId },
        include: {
          _count: {
            select: { runs: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }),

  get: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      return await ctx.prisma.workflow.findUnique({
        where: { id: input.id },
        include: {
          workspace: true,
          runs: {
            orderBy: { startedAt: 'desc' },
            take: 10,
          },
        },
      });
    }),

  run: protectedProcedure
    .input(
      z.object({
        workflowId: z.string(),
        topic: z.string(),
        brandVoiceSamples: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const engine = new WorkflowEngine();
      const runId = await engine.executeWorkflow(
        input.workflowId,
        input.topic,
        input.brandVoiceSamples
      );
      return { runId };
    }),

  batchRun: protectedProcedure
    .input(
      z.object({
        workflowId: z.string(),
        topics: z.array(z.string()),
        brandVoiceSamples: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const executor = new WorkflowExecutor();
      const runIds = await executor.runMultipleTopics(
        input.workflowId,
        input.topics,
        input.brandVoiceSamples
      );
      return { runIds };
    }),

  getRunStatus: protectedProcedure
    .input(
      z.object({
        runId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      return await ctx.prisma.workflowRun.findUnique({
        where: { id: input.runId },
        include: {
          workflow: true,
          contents: {
            include: {
              edits: true,
            },
          },
        },
      });
    }),

  listRuns: protectedProcedure
    .input(
      z.object({
        workflowId: z.string(),
        status: z.enum([
          'pending',
          'scraping',
          'analyzing',
          'generating',
          'reviewing',
          'publishing',
          'published',
          'failed',
        ]).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      return await ctx.prisma.workflowRun.findMany({
        where: {
          workflowId: input.workflowId,
          ...(input.status && { status: input.status }),
        },
        include: {
          _count: {
            select: { contents: true },
          },
        },
        orderBy: { startedAt: 'desc' },
      });
    }),

  cancelRun: protectedProcedure
    .input(
      z.object({
        runId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const engine = new WorkflowEngine();
      const result = await engine.cancelWorkflow(input.runId);
      return { success: result };
    }),

  retryRun: protectedProcedure
    .input(
      z.object({
        runId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const engine = new WorkflowEngine();
      const result = await engine.retryFailedRun(input.runId);
      return { success: result };
    }),

  getMetrics: protectedProcedure
    .input(
      z.object({
        workflowId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const engine = new WorkflowEngine();
      return await engine.getWorkflowMetrics(input.workflowId);
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        config: z.any().optional(),
        status: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      return await ctx.prisma.workflow.update({
        where: { id },
        data,
      });
    }),

  delete: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Check if there are any active runs
      const activeRuns = await ctx.prisma.workflowRun.count({
        where: {
          workflowId: input.id,
          status: { notIn: ['published', 'failed'] },
        },
      });

      if (activeRuns > 0) {
        throw new Error('Cannot delete workflow with active runs');
      }

      return await ctx.prisma.workflow.delete({
        where: { id: input.id },
      });
    }),
});