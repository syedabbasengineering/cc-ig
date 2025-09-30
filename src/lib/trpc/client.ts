import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/src/server/routers';

export const trpc = createTRPCReact<AppRouter>();