import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const analyticsRouter = router({
  getWorkspaceMetrics: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        timeRange: z.enum(['7d', '30d', '90d', '1y']).default('30d'),
      })
    )
    .query(async ({ input, ctx }) => {
      const { workspaceId, timeRange } = input;

      // Calculate date range
      const now = new Date();
      const daysBack = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '1y': 365,
      }[timeRange];

      const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

      // Get workflow runs in date range
      const runs = await ctx.prisma.workflowRun.findMany({
        where: {
          workflow: {
            workspaceId,
          },
          startedAt: {
            gte: startDate,
          },
        },
        include: {
          contents: true,
        },
      });

      // Calculate metrics
      const totalRuns = runs.length;
      const successfulRuns = runs.filter(r => r.status === 'published').length;
      const failedRuns = runs.filter(r => r.status === 'failed').length;
      const totalContent = runs.reduce((sum, run) => sum + run.contents.length, 0);
      const approvedContent = runs.flatMap(r => r.contents).filter(c => c.status === 'approved' || c.status === 'published').length;

      const metrics = {
        totalRuns,
        successfulRuns,
        failedRuns,
        successRate: totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0,
        totalContent,
        approvedContent,
        approvalRate: totalContent > 0 ? (approvedContent / totalContent) * 100 : 0,
        avgCompletionTime: 0,
      };

      // Calculate average completion time
      const completedRuns = runs.filter(r => r.completedAt);
      if (completedRuns.length > 0) {
        const totalTime = completedRuns.reduce((sum, run) => {
          const duration = run.completedAt!.getTime() - run.startedAt.getTime();
          return sum + duration;
        }, 0);
        metrics.avgCompletionTime = totalTime / completedRuns.length;
      }

      return metrics;
    }),

  getContentPerformance: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        platform: z.enum(['instagram', 'linkedin', 'twitter']).optional(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ input, ctx }) => {
      const { workspaceId, platform, limit } = input;

      const contents = await ctx.prisma.content.findMany({
        where: {
          workspaceId,
          status: 'published',
          ...(platform && { platform }),
        },
        orderBy: { publishedAt: 'desc' },
        take: limit,
      });

      // Mock performance data for now
      // In production, this would fetch from platform APIs
      return contents.map(content => ({
        id: content.id,
        platform: content.platform,
        type: content.type,
        publishedAt: content.publishedAt,
        performance: {
          views: Math.floor(Math.random() * 10000),
          likes: Math.floor(Math.random() * 1000),
          comments: Math.floor(Math.random() * 100),
          shares: Math.floor(Math.random() * 50),
          saves: Math.floor(Math.random() * 200),
          engagementRate: Math.random() * 10,
          clickThroughRate: Math.random() * 5,
        },
      }));
    }),

  getBrandVoiceInsights: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { workspaceId } = input;

      // Get brand voice samples and edits
      const [samples, edits] = await Promise.all([
        ctx.prisma.brandVoiceSample.findMany({
          where: { workspaceId },
          orderBy: { createdAt: 'desc' },
        }),
        ctx.prisma.contentEdit.findMany({
          where: { workspaceId },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      ]);

      // Analyze edit patterns
      const editsByField = edits.reduce((acc, edit) => {
        acc[edit.fieldEdited] = (acc[edit.fieldEdited] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const editsBySource = samples.reduce((acc, sample) => {
        acc[sample.source] = (acc[sample.source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalSamples: samples.length,
        totalEdits: edits.length,
        editsByField,
        editsBySource,
        recentEdits: edits.slice(0, 10),
        learningProgress: {
          samplesCollected: samples.length,
          editsLearned: edits.length,
          voiceAccuracy: Math.min(95, 60 + (edits.length * 2)), // Mock accuracy that improves with edits
        },
      };
    }),

  getQueueMetrics: protectedProcedure
    .input(
      z.object({
        timeRange: z.enum(['1h', '24h', '7d']).default('24h'),
      })
    )
    .query(async ({ input }) => {
      // This would integrate with BullMQ metrics in production
      // For now, return mock data
      return {
        scraping: {
          completed: Math.floor(Math.random() * 100),
          failed: Math.floor(Math.random() * 10),
          active: Math.floor(Math.random() * 5),
          waiting: Math.floor(Math.random() * 3),
          avgProcessingTime: Math.floor(Math.random() * 60000) + 30000, // 30s - 90s
        },
        aiProcessing: {
          completed: Math.floor(Math.random() * 80),
          failed: Math.floor(Math.random() * 8),
          active: Math.floor(Math.random() * 3),
          waiting: Math.floor(Math.random() * 2),
          avgProcessingTime: Math.floor(Math.random() * 120000) + 60000, // 1-3 minutes
        },
        publishing: {
          completed: Math.floor(Math.random() * 60),
          failed: Math.floor(Math.random() * 5),
          active: Math.floor(Math.random() * 2),
          waiting: Math.floor(Math.random() * 1),
          avgProcessingTime: Math.floor(Math.random() * 30000) + 10000, // 10-40s
        },
      };
    }),

  getTopPerformingContent: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        metric: z.enum(['engagement', 'views', 'likes', 'shares']).default('engagement'),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ input, ctx }) => {
      const { workspaceId, limit } = input;

      const contents = await ctx.prisma.content.findMany({
        where: {
          workspaceId,
          status: 'published',
        },
        orderBy: { publishedAt: 'desc' },
        take: limit * 2, // Get more to sort by performance
      });

      // Mock sorting by performance (in production, would sort by actual metrics)
      return contents
        .map(content => ({
          ...content,
          mockEngagement: Math.floor(Math.random() * 10000),
        }))
        .sort((a, b) => b.mockEngagement - a.mockEngagement)
        .slice(0, limit)
        .map(({ mockEngagement, ...content }) => ({
          ...content,
          performance: {
            views: mockEngagement * 10,
            likes: Math.floor(mockEngagement * 0.8),
            comments: Math.floor(mockEngagement * 0.1),
            shares: Math.floor(mockEngagement * 0.05),
            engagement: mockEngagement,
          },
        }));
    }),
});