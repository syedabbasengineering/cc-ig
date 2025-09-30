import { router } from '../trpc';
import { workflowRouter } from './workflow';
import { contentRouter } from './content';
import { brandVoiceRouter } from './brand-voice';
import { analyticsRouter } from './analytics';

export const appRouter = router({
  workflow: workflowRouter,
  content: contentRouter,
  brandVoice: brandVoiceRouter,
  analytics: analyticsRouter,
});

export type AppRouter = typeof appRouter;