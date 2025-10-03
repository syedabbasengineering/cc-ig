import { router } from '../trpc';
import { workflowRouter } from './workflow';
import { contentRouter } from './content';
import { brandVoiceRouter } from './brand-voice';
import { analyticsRouter } from './analytics';
import { workspaceRouter } from './workspace';

export const appRouter = router({
  workflow: workflowRouter,
  content: contentRouter,
  brandVoice: brandVoiceRouter,
  analytics: analyticsRouter,
  workspace: workspaceRouter,
});

export type AppRouter = typeof appRouter;