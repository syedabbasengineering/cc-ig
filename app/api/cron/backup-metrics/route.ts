import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db/client';
import { getRedisStats } from '@/src/lib/redis/cluster-config';
import { getConnectionStats } from '@/src/lib/db/connection-pool';

export const dynamic = 'force-dynamic';

/**
 * Cron job to backup system metrics
 * Runs every 6 hours
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('📊 Backing up system metrics...');

    // Collect metrics
    const [redisStats, dbStats, workflowStats, contentStats] = await Promise.all([
      getRedisStats(),
      getConnectionStats(),
      getWorkflowMetrics(),
      getContentMetrics(),
    ]);

    const metrics = {
      timestamp: new Date().toISOString(),
      redis: redisStats,
      database: dbStats,
      workflows: workflowStats,
      content: contentStats,
    };

    // In a real implementation, you would save this to a time-series database
    // or export to a monitoring service
    console.log('📦 Metrics snapshot:', metrics);

    // Optional: Send to monitoring service
    if (process.env.METRICS_WEBHOOK_URL) {
      await fetch(process.env.METRICS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metrics),
      });
    }

    return NextResponse.json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error('Error in metrics backup cron job:', error);

    return NextResponse.json(
      {
        error: 'Metrics backup failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Get workflow metrics
 */
async function getWorkflowMetrics() {
  const [totalWorkflows, runningWorkflows, completedToday, failedToday] =
    await Promise.all([
      prisma.workflowRun.count(),
      prisma.workflowRun.count({
        where: { status: 'RUNNING' },
      }),
      prisma.workflowRun.count({
        where: {
          status: 'COMPLETED',
          completedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.workflowRun.count({
        where: {
          status: 'FAILED',
          completedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

  return {
    total: totalWorkflows,
    running: runningWorkflows,
    completedToday,
    failedToday,
    successRate:
      completedToday + failedToday > 0
        ? ((completedToday / (completedToday + failedToday)) * 100).toFixed(2)
        : '0',
  };
}

/**
 * Get content metrics
 */
async function getContentMetrics() {
  const [totalContent, pendingReview, approvedToday, publishedToday] =
    await Promise.all([
      prisma.content.count(),
      prisma.content.count({
        where: { status: 'reviewing' },
      }),
      prisma.content.count({
        where: {
          status: 'approved',
          updatedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.content.count({
        where: {
          status: 'published',
          publishedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

  return {
    total: totalContent,
    pendingReview,
    approvedToday,
    publishedToday,
  };
}
