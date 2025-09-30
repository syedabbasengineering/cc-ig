import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { createContext } from '@/src/server/trpc';
import { appRouter } from '@/src/server/routers';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createContext({ req } as any),
  });

export { handler as GET, handler as POST };