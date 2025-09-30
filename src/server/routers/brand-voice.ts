import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { BrandVoiceAnalyzerAgent } from '@/src/lib/agents/brand-voice-analyzer';

export const brandVoiceRouter = router({
  saveSample: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        content: z.string().min(50),
        source: z.enum(['user_provided', 'approved_content', 'external_url']),
        metadata: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await ctx.prisma.brandVoiceSample.create({
        data: input,
      });
    }),

  listSamples: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        source: z.enum(['user_provided', 'approved_content', 'external_url']).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      return await ctx.prisma.brandVoiceSample.findMany({
        where: {
          workspaceId: input.workspaceId,
          ...(input.source && { source: input.source }),
        },
        orderBy: { createdAt: 'desc' },
      });
    }),

  deleteSample: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await ctx.prisma.brandVoiceSample.delete({
        where: { id: input.id },
      });
    }),

  analyzeSamples: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        sampleIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Get samples to analyze
      const samples = await ctx.prisma.brandVoiceSample.findMany({
        where: {
          workspaceId: input.workspaceId,
          ...(input.sampleIds && { id: { in: input.sampleIds } }),
        },
        orderBy: { createdAt: 'desc' },
        take: input.sampleIds?.length || 20,
      });

      if (samples.length === 0) {
        throw new Error('No brand voice samples found');
      }

      // Analyze with AI
      const analyzer = new BrandVoiceAnalyzerAgent();
      const brandVoice = await analyzer.analyzeBrandVoice(
        samples.map(s => s.content)
      );

      // Get existing brand voice
      const workspace = await ctx.prisma.workspace.findUnique({
        where: { id: input.workspaceId },
      });

      // Merge if existing voice exists
      const finalVoice = workspace?.brandVoice
        ? await analyzer.mergeBrandVoices(workspace.brandVoice as any, brandVoice)
        : brandVoice;

      // Update workspace
      await ctx.prisma.workspace.update({
        where: { id: input.workspaceId },
        data: { brandVoice: finalVoice as any },
      });

      return finalVoice;
    }),

  getProfile: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const workspace = await ctx.prisma.workspace.findUnique({
        where: { id: input.workspaceId },
        select: { brandVoice: true },
      });

      return workspace?.brandVoice || null;
    }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        brandVoice: z.object({
          tone: z.array(z.string()),
          writingStyle: z.array(z.string()),
          vocabularyPreferences: z.object({
            preferred: z.array(z.string()),
            avoided: z.array(z.string()),
          }),
          commonPhrases: z.array(z.string()),
          emojiUsage: z.object({
            frequency: z.enum(['high', 'medium', 'low', 'none']),
            preferred: z.array(z.string()),
          }),
          hashtagStyle: z.enum(['CamelCase', 'lowercase', 'UPPERCASE', 'mixed']),
          ctaPreferences: z.array(z.string()),
          contentThemes: z.array(z.string()),
          rules: z.object({
            dos: z.array(z.string()),
            donts: z.array(z.string()),
          }),
        }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await ctx.prisma.workspace.update({
        where: { id: input.workspaceId },
        data: { brandVoice: input.brandVoice as any },
      });
    }),

  trackEdit: protectedProcedure
    .input(
      z.object({
        contentId: z.string(),
        fieldEdited: z.string(),
        originalText: z.string(),
        editedText: z.string(),
        editReason: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Get content and workspace
      const content = await ctx.prisma.content.findUnique({
        where: { id: input.contentId },
        include: { workspace: true },
      });

      if (!content) {
        throw new Error('Content not found');
      }

      // Save edit
      const edit = await ctx.prisma.contentEdit.create({
        data: {
          ...input,
          workspaceId: content.workspaceId,
        },
      });

      // Learn from edit
      const analyzer = new BrandVoiceAnalyzerAgent();
      const learnings = await analyzer.learnFromEdit(
        input.originalText,
        input.editedText,
        input.fieldEdited
      );

      // Update workspace brand voice with learnings
      const currentVoice = (content.workspace.brandVoice || {}) as any;
      const updatedVoice = {
        ...currentVoice,
        learnings: [
          ...(currentVoice.learnings || []),
          { ...learnings, editId: edit.id, timestamp: new Date() },
        ],
      };

      await ctx.prisma.workspace.update({
        where: { id: content.workspaceId },
        data: { brandVoice: updatedVoice },
      });

      return edit;
    }),

  getEdits: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        contentId: z.string().optional(),
        fieldEdited: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      return await ctx.prisma.contentEdit.findMany({
        where: {
          workspaceId: input.workspaceId,
          ...(input.contentId && { contentId: input.contentId }),
          ...(input.fieldEdited && { fieldEdited: input.fieldEdited }),
        },
        include: {
          content: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    }),

  learnFromApprovedContent: protectedProcedure
    .input(
      z.object({
        contentId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Get approved content
      const content = await ctx.prisma.content.findUnique({
        where: { id: input.contentId },
      });

      if (!content || content.status !== 'approved') {
        throw new Error('Content not found or not approved');
      }

      // Save as brand voice sample
      const contentData = content.content as any;
      const sampleText = `${contentData.caption}\n\nHook: ${contentData.hook}\nCTA: ${contentData.cta}`;

      return await ctx.prisma.brandVoiceSample.create({
        data: {
          workspaceId: content.workspaceId,
          content: sampleText,
          source: 'approved_content',
          metadata: {
            contentId: content.id,
            platform: content.platform,
            type: content.type,
            approvedAt: new Date(),
          },
        },
      });
    }),

  resetProfile: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await ctx.prisma.workspace.update({
        where: { id: input.workspaceId },
        data: { brandVoice: undefined },
      });
    }),
});