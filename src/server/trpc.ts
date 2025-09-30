import { initTRPC } from '@trpc/server';
import { prisma } from '@/src/lib/db/client';
import type { CreateNextContextOptions } from '@trpc/server/adapters/next';

export const createContext = async (opts: CreateNextContextOptions) => {
  return {
    prisma,
    req: opts.req,
    res: opts.res,
  };
};

type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure; // Add auth middleware later

export const createCallerFactory = t.createCallerFactory;