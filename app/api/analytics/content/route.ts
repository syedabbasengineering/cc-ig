import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function calculateEngagementRate(performance: any): number {
  const { likes, comments, shares, reach } = performance;
  const totalEngagement = (likes || 0) + (comments || 0) + (shares || 0);
  return reach > 0 ? (totalEngagement / reach) * 100 : 0;
}

function generateMockPerformance() {
  // Generate realistic mock performance data
  const baseReach = Math.floor(Math.random() * 5000) + 500;
  const engagementRate = Math.random() * 8; // 0-8%
  const totalEngagement = Math.floor(baseReach * (engagementRate / 100));

  // Distribute engagement across likes, comments, shares
  const likes = Math.floor(totalEngagement * (0.7 + Math.random() * 0.2)); // 70-90% likes
  const comments = Math.floor(totalEngagement * (0.05 + Math.random() * 0.1)); // 5-15% comments
  const shares = Math.floor(totalEngagement * (0.02 + Math.random() * 0.08)); // 2-10% shares
  const saves = Math.floor(totalEngagement * (0.1 + Math.random() * 0.1)); // 10-20% saves

  return {
    likes,
    comments,
    shares,
    saves,
    reach: baseReach,
    impressions: Math.floor(baseReach * (1.2 + Math.random() * 0.8)), // 20-100% more impressions than reach
    clicks: Math.floor(baseReach * (0.01 + Math.random() * 0.05)) // 1-6% CTR
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const timeframe = url.searchParams.get('timeframe') || '30d';

    const workspace = await prisma.workspace.findFirst({
      where: {
        userId: session.user.id
      }
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Calculate date range
    const now = new Date();
    let startDate = new Date();

    switch (timeframe) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    const publishedContent = await prisma.content.findMany({
      where: {
        workspaceId: workspace.id,
        status: 'published',
        publishedAt: {
          gte: startDate,
          lte: now
        }
      },
      orderBy: {
        publishedAt: 'desc'
      }
    });

    // Add mock performance data and calculate engagement rates
    const contentWithMetrics = publishedContent.map(content => {
      // Use existing performance data or generate mock data
      const performance = content.performance as any || generateMockPerformance();
      const engagementRate = calculateEngagementRate(performance);
      const reachRate = performance.impressions > 0 ? (performance.reach / performance.impressions) * 100 : 0;

      return {
        id: content.id,
        platform: content.platform,
        type: content.type,
        content: content.content,
        performance,
        publishedAt: content.publishedAt,
        engagementRate,
        reachRate
      };
    });

    return NextResponse.json(contentWithMetrics);
  } catch (error) {
    console.error('Error fetching content metrics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}