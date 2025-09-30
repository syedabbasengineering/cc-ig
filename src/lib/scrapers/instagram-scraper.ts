import { ApifyClient } from 'apify-client';
import type { ScrapedPost, ContentAnalysis } from '@/src/types/workflow.types';

export class InstagramScraper {
  private client: ApifyClient;

  constructor(token: string) {
    this.client = new ApifyClient({ token });
  }

  async scrapeByTopic(
    topic: string,
    config: {
      count: number;
      minEngagement: number;
      timeframe?: string;
    }
  ): Promise<ScrapedPost[]> {
    try {
      const input = {
        searchType: 'hashtag',
        searchLimit: config.count || 100,
        hashtags: [topic.replace('#', '')],
        resultsType: 'posts',
        resultsLimit: config.count || 100,
        shouldDownloadVideos: false,
        shouldDownloadImages: false,
        extendOutputFunction: `
          async ({ data, item, page }) => {
            return {
              ...item,
              engagement: (item.likesCount || 0) + (item.commentsCount || 0),
              engagementRate: item.ownerUsername ?
                (((item.likesCount || 0) + (item.commentsCount || 0)) / (item.followersCount || 1)) * 100 : 0
            };
          }
        `,
      };

      const run = await this.client.actor('apify/instagram-scraper').call(input);
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();

      // Transform and filter the scraped data
      const posts: ScrapedPost[] = items
        .map((item: any) => ({
          id: item.id || `post-${Date.now()}-${Math.random()}`,
          platform: 'instagram',
          content: item.caption || '',
          caption: item.caption || '',
          hashtags: this.extractHashtags(item.caption || ''),
          engagement: (item.likesCount || 0) + (item.commentsCount || 0),
          engagementRate: item.engagementRate || 0,
          likesCount: item.likesCount || 0,
          commentsCount: item.commentsCount || 0,
          sharesCount: item.sharesCount || 0,
          followersCount: item.ownerFollowersCount || 0,
          mediaType: this.getMediaType(item),
          mediaUrl: item.displayUrl || item.videoUrl || '',
          createdAt: new Date(item.timestamp || Date.now()),
          author: {
            username: item.ownerUsername || 'unknown',
            followersCount: item.ownerFollowersCount || 0,
            verified: item.ownerIsVerified || false,
          },
        }))
        .filter(post => post.engagement >= config.minEngagement)
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, config.count);

      return posts;
    } catch (error) {
      console.error('Error scraping Instagram:', error);
      // Return mock data for development if Apify fails
      return this.getMockData(topic, config.count);
    }
  }

  async analyzeContent(posts: ScrapedPost[]): Promise<ContentAnalysis> {
    const analysis: ContentAnalysis = {
      hooks: this.extractHooks(posts),
      hashtags: this.extractTopHashtags(posts),
      contentTypes: this.categorizeContent(posts),
      postingTimes: this.analyzePostingTimes(posts),
      avgEngagement: this.calculateAvgEngagement(posts),
      topPerformers: posts.slice(0, 5),
      themes: this.extractThemes(posts),
      sentiments: this.analyzeSentiments(posts),
    };

    return analysis;
  }

  private extractHashtags(caption: string): string[] {
    const hashtagRegex = /#[\w]+/g;
    const matches = caption.match(hashtagRegex);
    return matches ? matches.map(tag => tag.toLowerCase()) : [];
  }

  private getMediaType(item: any): 'image' | 'video' | 'carousel' | 'text' {
    if (item.type === 'Video' || item.videoUrl) return 'video';
    if (item.type === 'Sidecar' || item.childPosts?.length > 0) return 'carousel';
    if (item.type === 'Image' || item.displayUrl) return 'image';
    return 'text';
  }

  private extractHooks(posts: ScrapedPost[]): string[] {
    return posts
      .map(p => {
        const firstLine = p.caption?.split('\n')[0] || '';
        return firstLine.length > 10 ? firstLine : null;
      })
      .filter(Boolean) as string[];
  }

  private extractTopHashtags(posts: ScrapedPost[]): string[] {
    const hashtagCounts: Record<string, number> = {};

    posts.forEach(post => {
      post.hashtags?.forEach(tag => {
        hashtagCounts[tag] = (hashtagCounts[tag] || 0) + 1;
      });
    });

    return Object.entries(hashtagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 30)
      .map(([tag]) => tag);
  }

  private categorizeContent(posts: ScrapedPost[]) {
    return {
      reels: posts.filter(p => p.mediaType === 'video').length,
      carousels: posts.filter(p => p.mediaType === 'carousel').length,
      images: posts.filter(p => p.mediaType === 'image').length,
      text: posts.filter(p => p.mediaType === 'text').length,
    };
  }

  private analyzePostingTimes(posts: ScrapedPost[]) {
    const timeAnalysis: Record<string, { hour: number; dayOfWeek: number; count: number }> = {};

    posts.forEach(post => {
      const date = new Date(post.createdAt);
      const hour = date.getHours();
      const dayOfWeek = date.getDay();
      const key = `${hour}-${dayOfWeek}`;

      if (!timeAnalysis[key]) {
        timeAnalysis[key] = { hour, dayOfWeek, count: 0 };
      }
      timeAnalysis[key].count++;
    });

    return Object.values(timeAnalysis)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private calculateAvgEngagement(posts: ScrapedPost[]): number {
    if (posts.length === 0) return 0;
    const totalEngagement = posts.reduce((sum, p) => sum + p.engagement, 0);
    return totalEngagement / posts.length;
  }

  private extractThemes(posts: ScrapedPost[]): string[] {
    // Simple theme extraction based on common words
    const wordCounts: Record<string, number> = {};
    const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'for']);

    posts.forEach(post => {
      const words = post.caption?.toLowerCase().split(/\s+/) || [];
      words.forEach(word => {
        const cleaned = word.replace(/[^a-z0-9]/g, '');
        if (cleaned.length > 3 && !stopWords.has(cleaned)) {
          wordCounts[cleaned] = (wordCounts[cleaned] || 0) + 1;
        }
      });
    });

    return Object.entries(wordCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  private analyzeSentiments(posts: ScrapedPost[]) {
    // Simple sentiment analysis based on keywords
    const positive = ['love', 'amazing', 'great', 'awesome', 'perfect', 'beautiful', 'wonderful', 'excellent', 'best', 'happy'];
    const negative = ['hate', 'terrible', 'bad', 'awful', 'worst', 'ugly', 'horrible', 'poor', 'sad', 'angry'];

    let positiveCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;

    posts.forEach(post => {
      const caption = post.caption?.toLowerCase() || '';
      const hasPositive = positive.some(word => caption.includes(word));
      const hasNegative = negative.some(word => caption.includes(word));

      if (hasPositive && !hasNegative) positiveCount++;
      else if (hasNegative && !hasPositive) negativeCount++;
      else neutralCount++;
    });

    const total = posts.length || 1;
    return {
      positive: (positiveCount / total) * 100,
      neutral: (neutralCount / total) * 100,
      negative: (negativeCount / total) * 100,
    };
  }

  private getMockData(topic: string, count: number): ScrapedPost[] {
    // Generate mock data for development/testing
    return Array.from({ length: Math.min(count, 10) }, (_, i) => ({
      id: `mock-${i}`,
      platform: 'instagram' as const,
      content: `Mock post about ${topic} #${topic} #trending #viral`,
      caption: `This is a mock post about ${topic}. Great content here! #${topic} #trending #viral`,
      hashtags: [`#${topic}`, '#trending', '#viral'],
      engagement: Math.floor(Math.random() * 10000) + 1000,
      engagementRate: Math.random() * 10,
      likesCount: Math.floor(Math.random() * 8000) + 800,
      commentsCount: Math.floor(Math.random() * 2000) + 200,
      sharesCount: Math.floor(Math.random() * 500),
      followersCount: Math.floor(Math.random() * 50000) + 5000,
      mediaType: ['image', 'video', 'carousel'][Math.floor(Math.random() * 3)] as any,
      mediaUrl: `https://example.com/image-${i}.jpg`,
      createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      author: {
        username: `user${i}`,
        followersCount: Math.floor(Math.random() * 50000) + 5000,
        verified: Math.random() > 0.7,
      },
    }));
  }
}

export default InstagramScraper;