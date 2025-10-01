import { NextRequest, NextResponse } from 'next/server';
import { dlqManager } from '@/src/lib/queue/dead-letter-queue';

export const dynamic = 'force-dynamic';

/**
 * Cron job to cleanup old failed jobs
 * Runs daily at 2 AM UTC
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🧹 Starting failed jobs cleanup...');

    // Cleanup jobs older than 30 days
    const deletedCount = await dlqManager.cleanup(30);

    console.log(`✅ Cleaned up ${deletedCount} old failed jobs`);

    return NextResponse.json({
      success: true,
      deletedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in cleanup cron job:', error);

    return NextResponse.json(
      {
        error: 'Cleanup failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
