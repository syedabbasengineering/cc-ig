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

    // Add mock performance data
    const contentWithPerformance = publishedContent.map(content => ({
      ...content,
      performance: content.performance as any || generateMockPerformance()
    }));

    // Group by platform and calculate metrics
    const platformStats = contentWithPerformance.reduce((acc, content) => {
      const platform = content.platform;

      if (!acc[platform]) {
        acc[platform] = {
          posts: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
          totalReach: 0,
          totalEngagement: 0
        };
      }

      acc[platform].posts += 1;
      acc[platform].totalLikes += content.performance.likes || 0;
      acc[platform].totalComments += content.performance.comments || 0;
      acc[platform].totalShares += content.performance.shares || 0;
      acc[platform].totalReach += content.performance.reach || 0;
      acc[platform].totalEngagement += (content.performance.likes || 0) + (content.performance.comments || 0) + (content.performance.shares || 0);

      return acc;
    }, {} as Record<string, any>);

    // Calculate averages and engagement rates
    const platformMetrics = Object.entries(platformStats).map(([platform, stats]) => {
      const posts = stats.posts;
      const avgLikes = posts > 0 ? Math.round(stats.totalLikes / posts) : 0;
      const avgComments = posts > 0 ? Math.round(stats.totalComments / posts) : 0;
      const avgShares = posts > 0 ? Math.round(stats.totalShares / posts) : 0;
      const avgReach = posts > 0 ? Math.round(stats.totalReach / posts) : 0;
      const engagementRate = stats.totalReach > 0 ? (stats.totalEngagement / stats.totalReach) * 100 : 0;

      return {
        platform,
        posts,
        avgLikes,
        avgComments,
        avgShares,
        avgReach,
        engagementRate: Math.round(engagementRate * 10) / 10
      };
    });

    // Sort by engagement rate descending
    platformMetrics.sort((a, b) => b.engagementRate - a.engagementRate);

    return NextResponse.json(platformMetrics);
  } catch (error) {
    console.error('Error fetching platform metrics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}