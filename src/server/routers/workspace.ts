import { z } from 'zod';
import { router, publicProcedure } from '../trpc';

export const workspaceRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    // For now, return all workspaces (add auth later)
    return await ctx.prisma.workspace.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }),

  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return await ctx.prisma.workspace.findUnique({
        where: { id: input.id },
      });
    }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await ctx.prisma.workspace.create({
        data: {
          name: input.name,
          userId: input.userId,
        },
      });
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      return await ctx.prisma.workspace.update({
        where: { id },
        data,
      });
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return await ctx.prisma.workspace.delete({
        where: { id: input.id },
      });
    }),
});
