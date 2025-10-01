import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 1.0,

  // Session Replay - disabled on server
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Error filtering
  beforeSend(event, hint) {
    // Filter out known errors
    if (event.exception) {
      const error = hint.originalException;

      // Ignore database connection errors in development
      if (process.env.NODE_ENV !== 'production' && error instanceof Error) {
        if (
          error.message.includes('PrismaClient') ||
          error.message.includes('database')
        ) {
          return null;
        }
      }
    }

    return event;
  },
});
