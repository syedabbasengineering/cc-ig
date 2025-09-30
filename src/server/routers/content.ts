import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { publishingQueue } from '../queue';

export const contentRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        status: z.enum(['draft', 'reviewing', 'approved', 'rejected', 'published', 'scheduled']).optional(),
        platform: z.enum(['instagram', 'linkedin', 'twitter']).optional(),
        runId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      return await ctx.prisma.content.findMany({
        where: {
          workspaceId: input.workspaceId,
          ...(input.status && { status: input.status }),
          ...(input.platform && { platform: input.platform }),
          ...(input.runId && { runId: input.runId }),
        },
        include: {
          run: true,
          edits: true,
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
      return await ctx.prisma.content.findUnique({
        where: { id: input.id },
        include: {
          workspace: true,
          run: {
            include: {
              workflow: true,
            },
          },
          edits: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        content: z.any().optional(),
        status: z.enum(['draft', 'reviewing', 'approved', 'rejected', 'published', 'scheduled']).optional(),
        scheduledFor: z.date().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;

      return await ctx.prisma.content.update({
        where: { id },
        data,
      });
    }),

  approve: protectedProcedure
    .input(
      z.object({
        contentId: z.string(),
        autoPublish: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const content = await ctx.prisma.content.update({
        where: { id: input.contentId },
        data: { status: 'approved' },
        include: { run: true },
      });

      // Queue for publishing if auto-publish is enabled
      if (input.autoPublish) {
        await publishingQueue.add(
          'publish-content',
          {
            runId: content.runId || '',
            contentId: content.id,
            platform: content.platform,
          },
          {
            jobId: `publish-${content.id}`,
          }
        );
      }

      return content;
    }),

  reject: protectedProcedure
    .input(
      z.object({
        contentId: z.string(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const content = await ctx.prisma.content.findUnique({
        where: { id: input.contentId },
      });

      if (!content) {
        throw new Error('Content not found');
      }

      const updatedContent = {
        ...(content.content as any),
        rejectionReason: input.reason || 'No reason provided',
      };

      return await ctx.prisma.content.update({
        where: { id: input.contentId },
        data: {
          status: 'rejected',
          content: updatedContent as any,
        },
      });
    }),

  bulkApprove: protectedProcedure
    .input(
      z.object({
        contentIds: z.array(z.string()),
        autoPublish: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const contents = await ctx.prisma.content.updateMany({
        where: {
          id: { in: input.contentIds },
        },
        data: {
          status: 'approved',
        },
      });

      // Queue all for publishing if auto-publish is enabled
      if (input.autoPublish) {
        const contentDetails = await ctx.prisma.content.findMany({
          where: { id: { in: input.contentIds } },
        });

        await Promise.all(
          contentDetails.map(content =>
            publishingQueue.add(
              'publish-content',
              {
                runId: content.runId || '',
                contentId: content.id,
                platform: content.platform,
              },
              {
                jobId: `publish-${content.id}`,
              }
            )
          )
        );
      }

      return contents;
    }),

  schedule: protectedProcedure
    .input(
      z.object({
        contentId: z.string(),
        scheduledFor: z.date(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const content = await ctx.prisma.content.update({
        where: { id: input.contentId },
        data: {
          status: 'scheduled',
          scheduledFor: input.scheduledFor,
        },
        include: { run: true },
      });

      // Queue for publishing at scheduled time
      await publishingQueue.add(
        'publish-content',
        {
          runId: content.runId || '',
          contentId: content.id,
          platform: content.platform,
          scheduledFor: input.scheduledFor,
        },
        {
          jobId: `publish-scheduled-${content.id}`,
          delay: input.scheduledFor.getTime() - Date.now(),
        }
      );

      return content;
    }),

  edit: protectedProcedure
    .input(
      z.object({
        contentId: z.string(),
        field: z.enum(['caption', 'hook', 'hashtags', 'cta']),
        newValue: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Get original content
      const content = await ctx.prisma.content.findUnique({
        where: { id: input.contentId },
      });

      if (!content) {
        throw new Error('Content not found');
      }

      const originalContent = content.originalContent || content.content;
      const originalValue = (originalContent as any)[input.field];

      // Create edit record
      const edit = await ctx.prisma.contentEdit.create({
        data: {
          contentId: input.contentId,
          workspaceId: content.workspaceId,
          fieldEdited: input.field,
          originalText: typeof originalValue === 'string' ? originalValue : JSON.stringify(originalValue),
          editedText: input.newValue,
        },
      });

      // Update content
      const updatedContentData = { ...(content.content as any) };
      if (input.field === 'hashtags') {
        updatedContentData[input.field] = input.newValue.split(' ').filter(Boolean);
      } else {
        updatedContentData[input.field] = input.newValue;
      }

      await ctx.prisma.content.update({
        where: { id: input.contentId },
        data: {
          content: updatedContentData,
        },
      });

      return edit;
    }),

  getPerformance: protectedProcedure
    .input(
      z.object({
        contentId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const content = await ctx.prisma.content.findUnique({
        where: { id: input.contentId },
      });

      // Return mock performance data for now
      // In production, this would fetch from platform APIs
      return {
        views: Math.floor(Math.random() * 10000),
        likes: Math.floor(Math.random() * 1000),
        comments: Math.floor(Math.random() * 100),
        shares: Math.floor(Math.random() * 50),
        saves: Math.floor(Math.random() * 200),
        engagementRate: Math.random() * 10,
        reachGrowth: Math.random() * 100 - 50,
      };
    }),

  delete: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await ctx.prisma.content.delete({
        where: { id: input.id },
      });
    }),
});