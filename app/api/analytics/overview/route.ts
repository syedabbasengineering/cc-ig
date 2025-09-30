import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function generateMockPerformance() {
  const baseReach = Math.floor(Math.random() * 5000) + 500;
  const engagementRate = Math.random() * 8;
  const totalEngagement = Math.floor(baseReach * (engagementRate / 100));

  const likes = Math.floor(totalEngagement * (0.7 + Math.random() * 0.2));
  const comments = Math.floor(totalEngagement * (0.05 + Math.random() * 0.1));
  const shares = Math.floor(totalEngagement * (0.02 + Math.random() * 0.08));

  return {
    likes,
    comments,
    shares,
    reach: baseReach,
    impressions: Math.floor(baseReach * (1.2 + Math.random() * 0.8))
  };
}

function calculateEngagementRate(performance: any): number {
  const { likes, comments, shares, reach } = performance;
  const totalEngagement = (likes || 0) + (comments || 0) + (shares || 0);
  return reach > 0 ? (totalEngagement / reach) * 100 : 0;
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
      }
    });

    if (publishedContent.length === 0) {
      return NextResponse.json({
        totalPosts: 0,
        totalReach: 0,
        totalEngagement: 0,
        avgEngagementRate: 0,
        topPerformingPlatform: 'instagram',
        bestPostType: 'post',
        growthTrend: 'stable' as const
      });
    }

    // Add mock performance data
    const contentWithPerformance = publishedContent.map(content => ({
      ...content,
      performance: content.performance as any || generateMockPerformance()
    }));

    // Calculate overview metrics
    const totalPosts = contentWithPerformance.length;
    const totalReach = contentWithPerformance.reduce((sum, content) => sum + content.performance.reach, 0);
    const totalEngagement = contentWithPerformance.reduce((sum, content) => {
      const { likes, comments, shares } = content.performance;
      return sum + (likes || 0) + (comments || 0) + (shares || 0);
    }, 0);

    const avgEngagementRate = contentWithPerformance.reduce((sum, content) => {
      return sum + calculateEngagementRate(content.performance);
    }, 0) / totalPosts;

    // Find top performing platform
    const platformPerformance = contentWithPerformance.reduce((acc, content) => {
      const platform = content.platform;
      if (!acc[platform]) {
        acc[platform] = { reach: 0, engagement: 0, count: 0 };
      }
      acc[platform].reach += content.performance.reach;
      acc[platform].engagement += (content.performance.likes || 0) + (content.performance.comments || 0) + (content.performance.shares || 0);
      acc[platform].count += 1;
      return acc;
    }, {} as Record<string, { reach: number; engagement: number; count: number }>);

    const topPerformingPlatform = Object.entries(platformPerformance)
      .sort(([,a], [,b]) => (b.engagement / b.count) - (a.engagement / a.count))[0]?.[0] || 'instagram';

    // Find best post type
    const typePerformance = contentWithPerformance.reduce((acc, content) => {
      const type = content.type;
      if (!acc[type]) {
        acc[type] = { engagement: 0, count: 0 };
      }
      acc[type].engagement += (content.performance.likes || 0) + (content.performance.comments || 0) + (content.performance.shares || 0);
      acc[type].count += 1;
      return acc;
    }, {} as Record<string, { engagement: number; count: number }>);

    const bestPostType = Object.entries(typePerformance)
      .sort(([,a], [,b]) => (b.engagement / b.count) - (a.engagement / a.count))[0]?.[0] || 'post';

    // Calculate growth trend (simplified)
    const midpoint = Math.floor(contentWithPerformance.length / 2);
    const firstHalf = contentWithPerformance.slice(0, midpoint);
    const secondHalf = contentWithPerformance.slice(midpoint);

    let growthTrend: 'up' | 'down' | 'stable' = 'stable';

    if (firstHalf.length > 0 && secondHalf.length > 0) {
      const firstHalfAvgEngagement = firstHalf.reduce((sum, c) => sum + calculateEngagementRate(c.performance), 0) / firstHalf.length;
      const secondHalfAvgEngagement = secondHalf.reduce((sum, c) => sum + calculateEngagementRate(c.performance), 0) / secondHalf.length;

      if (secondHalfAvgEngagement > firstHalfAvgEngagement * 1.1) {
        growthTrend = 'up';
      } else if (secondHalfAvgEngagement < firstHalfAvgEngagement * 0.9) {
        growthTrend = 'down';
      }
    }

    return NextResponse.json({
      totalPosts,
      totalReach,
      totalEngagement,
      avgEngagementRate: Math.round(avgEngagementRate * 10) / 10,
      topPerformingPlatform,
      bestPostType,
      growthTrend
    });
  } catch (error) {
    console.error('Error fetching overview:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}