'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { AppLayout } from '@/components/app-layout';

interface ContentMetrics {
  id: string;
  platform: string;
  type: string;
  content: {
    caption?: string;
    hook?: string;
    hashtags?: string;
  };
  performance: {
    likes: number;
    comments: number;
    shares: number;
    reach: number;
    impressions: number;
    clicks?: number;
    saves?: number;
  };
  publishedAt: string;
  engagementRate: number;
  reachRate: number;
}

interface AnalyticsOverview {
  totalPosts: number;
  totalReach: number;
  totalEngagement: number;
  avgEngagementRate: number;
  topPerformingPlatform: string;
  bestPostType: string;
  growthTrend: 'up' | 'down' | 'stable';
}

interface PlatformMetrics {
  platform: string;
  posts: number;
  avgLikes: number;
  avgComments: number;
  avgShares: number;
  avgReach: number;
  engagementRate: number;
}

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const [metrics, setMetrics] = useState<ContentMetrics[]>([]);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [platformMetrics, setPlatformMetrics] = useState<PlatformMetrics[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState('30d');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.id) {
      Promise.all([
        fetchMetrics(),
        fetchOverview(),
        fetchPlatformMetrics()
      ]).finally(() => setIsLoading(false));
    }
  }, [session, selectedTimeframe]);

  const fetchMetrics = async () => {
    try {
      const response = await fetch(`/api/analytics/content?timeframe=${selectedTimeframe}`);
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  const fetchOverview = async () => {
    try {
      const response = await fetch(`/api/analytics/overview?timeframe=${selectedTimeframe}`);
      if (response.ok) {
        const data = await response.json();
        setOverview(data);
      }
    } catch (error) {
      console.error('Error fetching overview:', error);
    }
  };

  const fetchPlatformMetrics = async () => {
    try {
      const response = await fetch(`/api/analytics/platforms?timeframe=${selectedTimeframe}`);
      if (response.ok) {
        const data = await response.json();
        setPlatformMetrics(data);
      }
    } catch (error) {
      console.error('Error fetching platform metrics:', error);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const getEngagementColor = (rate: number) => {
    if (rate >= 5) return 'text-green-600';
    if (rate >= 2) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'instagram':
        return '📷';
      case 'linkedin':
        return '💼';
      case 'twitter':
        return '🐦';
      default:
        return '📱';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <span className="text-green-600">↗️ Growing</span>;
      case 'down':
        return <span className="text-red-600">↘️ Declining</span>;
      case 'stable':
        return <span className="text-yellow-600">→ Stable</span>;
      default:
        return <span className="text-gray-600">— No data</span>;
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading analytics...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Content Analytics</h1>
            <p className="text-muted-foreground">
              Track performance metrics and insights for your published content.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value)}
              className="px-3 py-2 border border-border rounded-md"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 3 Months</option>
              <option value="1y">Last Year</option>
            </select>
          </div>
        </div>

        {overview && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.totalPosts}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Reach</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(overview.totalReach)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Engagement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(overview.totalEngagement)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg Engagement Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getEngagementColor(overview.avgEngagementRate)}`}>
                  {overview.avgEngagementRate.toFixed(1)}%
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {overview && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Platform</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getPlatformIcon(overview.topPerformingPlatform)}</span>
                  <span className="text-xl font-semibold capitalize">{overview.topPerformingPlatform}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Best Content Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-semibold capitalize">{overview.bestPostType}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Growth Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold">
                  {getTrendIcon(overview.growthTrend)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="content">Content Performance</TabsTrigger>
            <TabsTrigger value="platforms">Platform Breakdown</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Engagement Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Likes</span>
                      <span className="font-semibold">
                        {formatNumber(metrics.reduce((sum, m) => sum + m.performance.likes, 0))}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Comments</span>
                      <span className="font-semibold">
                        {formatNumber(metrics.reduce((sum, m) => sum + m.performance.comments, 0))}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Shares</span>
                      <span className="font-semibold">
                        {formatNumber(metrics.reduce((sum, m) => sum + m.performance.shares, 0))}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Saves</span>
                      <span className="font-semibold">
                        {formatNumber(metrics.reduce((sum, m) => sum + (m.performance.saves || 0), 0))}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Performing Posts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {metrics
                      .sort((a, b) => b.engagementRate - a.engagementRate)
                      .slice(0, 5)
                      .map((post, index) => (
                        <div key={post.id} className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{getPlatformIcon(post.platform)}</span>
                            <span className="text-sm truncate max-w-48">
                              {post.content.hook || post.content.caption?.slice(0, 50) || 'No caption'}
                            </span>
                          </div>
                          <Badge variant="secondary" className={getEngagementColor(post.engagementRate)}>
                            {post.engagementRate.toFixed(1)}%
                          </Badge>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="content" className="space-y-6">
            {metrics.length > 0 ? (
              <div className="space-y-4">
                {metrics
                  .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
                  .map((content) => (
                    <Card key={content.id}>
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{getPlatformIcon(content.platform)}</span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium capitalize">{content.platform}</span>
                                <Badge variant="outline">{content.type}</Badge>
                              </div>
                              <span className="text-sm text-muted-foreground">
                                {new Date(content.publishedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <Badge variant="secondary" className={getEngagementColor(content.engagementRate)}>
                            {content.engagementRate.toFixed(1)}% engagement
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-sm">
                            {content.content.hook && (
                              <span className="font-medium">Hook: {content.content.hook}</span>
                            )}
                            {content.content.caption && (
                              <span className="block mt-1">
                                {content.content.caption.slice(0, 150)}
                                {content.content.caption.length > 150 ? '...' : ''}
                              </span>
                            )}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                          <div className="text-center">
                            <div className="font-semibold">{formatNumber(content.performance.likes)}</div>
                            <div className="text-muted-foreground">Likes</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold">{formatNumber(content.performance.comments)}</div>
                            <div className="text-muted-foreground">Comments</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold">{formatNumber(content.performance.shares)}</div>
                            <div className="text-muted-foreground">Shares</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold">{formatNumber(content.performance.reach)}</div>
                            <div className="text-muted-foreground">Reach</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold">{formatNumber(content.performance.impressions)}</div>
                            <div className="text-muted-foreground">Impressions</div>
                          </div>
                        </div>

                        {content.content.hashtags && (
                          <div>
                            <span className="text-sm text-blue-600">{content.content.hashtags}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No published content found.</p>
                  <p className="text-sm text-muted-foreground">
                    Publish some content to see performance metrics here.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="platforms" className="space-y-6">
            {platformMetrics.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {platformMetrics.map((platform) => (
                  <Card key={platform.platform}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <span className="text-xl">{getPlatformIcon(platform.platform)}</span>
                        <span className="capitalize">{platform.platform}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span>Posts:</span>
                        <span className="font-semibold">{platform.posts}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Avg Likes:</span>
                        <span className="font-semibold">{formatNumber(platform.avgLikes)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Avg Comments:</span>
                        <span className="font-semibold">{formatNumber(platform.avgComments)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Avg Reach:</span>
                        <span className="font-semibold">{formatNumber(platform.avgReach)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between">
                        <span>Engagement Rate:</span>
                        <span className={`font-semibold ${getEngagementColor(platform.engagementRate)}`}>
                          {platform.engagementRate.toFixed(1)}%
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">No platform data available.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="insights" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Content Insights</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <strong>Best performing content type:</strong>{' '}
                    {overview?.bestPostType || 'No data'}
                  </div>
                  <div className="text-sm">
                    <strong>Optimal posting platform:</strong>{' '}
                    {overview?.topPerformingPlatform || 'No data'}
                  </div>
                  <div className="text-sm">
                    <strong>Average engagement rate:</strong>{' '}
                    <span className={overview ? getEngagementColor(overview.avgEngagementRate) : ''}>
                      {overview?.avgEngagementRate.toFixed(1)}%
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recommendations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    • Focus on {overview?.topPerformingPlatform || 'your best'} platform for maximum reach
                  </div>
                  <div className="text-sm">
                    • Create more {overview?.bestPostType || 'engaging'} content based on performance
                  </div>
                  <div className="text-sm">
                    • {overview && overview.avgEngagementRate < 2
                        ? 'Work on improving engagement through better hooks and CTAs'
                        : 'Maintain current engagement levels with consistent quality content'}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}