/**
 * Next.js Instrumentation Hook
 * This file runs once when the server starts
 * Perfect for initializing background workers
 */

export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🚀 Initializing server instrumentation...');

    // Import and start workers
    const { startWorkers } = await import('@/src/server/queue/workers');
    startWorkers();

    console.log('✅ Server instrumentation complete');
  }
}
