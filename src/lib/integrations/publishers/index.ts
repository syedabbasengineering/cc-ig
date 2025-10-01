import { instagramPublisher, InstagramPost } from './instagram';
import { linkedInPublisher, LinkedInPost } from './linkedin';
import { twitterPublisher, TwitterPost } from './twitter';

export type Platform = 'instagram' | 'linkedin' | 'twitter';

export interface PublishRequest {
  platform: Platform;
  content: any;
  scheduledAt?: Date;
}

export interface PublishResponse {
  success: boolean;
  platform: Platform;
  postId?: string;
  postUrl?: string;
  error?: string;
  scheduledAt?: Date;
}

export interface MultiPlatformPublishRequest {
  platforms: Platform[];
  content: Record<Platform, any>;
  scheduledAt?: Date;
}

/**
 * Unified publisher service for all social media platforms
 */
export class SocialMediaPublisher {
  /**
   * Publish content to a single platform
   */
  async publish(request: PublishRequest): Promise<PublishResponse> {
    try {
      const { platform, content, scheduledAt } = request;

      // If scheduled, return scheduled status
      if (scheduledAt && scheduledAt > new Date()) {
        return {
          success: true,
          platform,
          scheduledAt,
        };
      }

      // Publish immediately
      switch (platform) {
        case 'instagram':
          return await this.publishToInstagram(content);

        case 'linkedin':
          return await this.publishToLinkedIn(content);

        case 'twitter':
          return await this.publishToTwitter(content);

        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
    } catch (error) {
      console.error(`Failed to publish to ${request.platform}:`, error);
      return {
        success: false,
        platform: request.platform,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Publish content to multiple platforms
   */
  async publishMultiple(
    request: MultiPlatformPublishRequest
  ): Promise<PublishResponse[]> {
    const results: PublishResponse[] = [];

    // Publish to each platform in parallel
    const publishPromises = request.platforms.map((platform) =>
      this.publish({
        platform,
        content: request.content[platform],
        scheduledAt: request.scheduledAt,
      })
    );

    const responses = await Promise.allSettled(publishPromises);

    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      const platform = request.platforms[i];

      if (response.status === 'fulfilled') {
        results.push(response.value);
      } else {
        results.push({
          success: false,
          platform,
          error: response.reason?.message || 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Publish to Instagram
   */
  private async publishToInstagram(
    content: any
  ): Promise<PublishResponse> {
    if (!instagramPublisher.isConfigured()) {
      throw new Error('Instagram publisher not configured');
    }

    const post: InstagramPost = {
      caption: this.buildInstagramCaption(content),
      imageUrl: content.imageUrl,
      videoUrl: content.videoUrl,
    };

    let result;
    if (content.videoUrl) {
      result = await instagramPublisher.publishVideo(post);
    } else if (content.imageUrls && content.imageUrls.length > 1) {
      result = await instagramPublisher.publishCarousel(
        content.imageUrls,
        post.caption
      );
    } else {
      result = await instagramPublisher.publishImage(post);
    }

    return {
      success: true,
      platform: 'instagram',
      postId: result.id,
      postUrl: result.permalink,
    };
  }

  /**
   * Publish to LinkedIn
   */
  private async publishToLinkedIn(content: any): Promise<PublishResponse> {
    if (!linkedInPublisher.isConfigured()) {
      throw new Error('LinkedIn publisher not configured');
    }

    const post: LinkedInPost = {
      text: this.buildLinkedInText(content),
      imageUrl: content.imageUrl,
      videoUrl: content.videoUrl,
      articleUrl: content.articleUrl,
      articleTitle: content.articleTitle,
      articleDescription: content.articleDescription,
    };

    let result;
    if (content.videoUrl) {
      result = await linkedInPublisher.publishVideoPost(post);
    } else if (content.articleUrl) {
      result = await linkedInPublisher.publishArticlePost(post);
    } else if (content.imageUrl) {
      result = await linkedInPublisher.publishImagePost(post);
    } else {
      result = await linkedInPublisher.publishTextPost(post);
    }

    return {
      success: true,
      platform: 'linkedin',
      postId: result.id,
      postUrl: result.shareUrl,
    };
  }

  /**
   * Publish to Twitter
   */
  private async publishToTwitter(content: any): Promise<PublishResponse> {
    if (!twitterPublisher.isConfigured()) {
      throw new Error('Twitter publisher not configured');
    }

    const text = this.buildTwitterText(content);

    // Check if we need a thread (Twitter has 280 char limit)
    if (text.length > 280 && content.enableThreading) {
      return await this.publishTwitterThread(content);
    }

    const post: TwitterPost = {
      text: text.substring(0, 280), // Truncate if needed
      mediaUrls: content.imageUrl ? [content.imageUrl] : undefined,
    };

    const result = await twitterPublisher.publishTweet(post);

    return {
      success: true,
      platform: 'twitter',
      postId: result.id,
      postUrl: result.url,
    };
  }

  /**
   * Publish a Twitter thread
   */
  private async publishTwitterThread(content: any): Promise<PublishResponse> {
    const fullText = this.buildTwitterText(content);

    // Split into tweets (280 chars each, with some buffer)
    const tweets = this.splitIntoTweets(fullText, 270);

    const results = await twitterPublisher.publishThread(tweets);

    return {
      success: true,
      platform: 'twitter',
      postId: results[0].id,
      postUrl: results[0].url,
    };
  }

  /**
   * Build Instagram caption
   */
  private buildInstagramCaption(content: any): string {
    const parts: string[] = [];

    if (content.hook) {
      parts.push(content.hook);
      parts.push('');
    }

    if (content.caption) {
      parts.push(content.caption);
      parts.push('');
    }

    if (content.cta) {
      parts.push(content.cta);
      parts.push('');
    }

    if (content.hashtags && content.hashtags.length > 0) {
      parts.push(content.hashtags.join(' '));
    }

    return parts.join('\n');
  }

  /**
   * Build LinkedIn text
   */
  private buildLinkedInText(content: any): string {
    const parts: string[] = [];

    if (content.hook) {
      parts.push(content.hook);
      parts.push('');
    }

    if (content.caption) {
      parts.push(content.caption);
      parts.push('');
    }

    if (content.cta) {
      parts.push(content.cta);
    }

    // LinkedIn doesn't use hashtags as prominently
    if (content.hashtags && content.hashtags.length > 0) {
      parts.push('');
      parts.push(content.hashtags.slice(0, 3).join(' '));
    }

    return parts.join('\n');
  }

  /**
   * Build Twitter text
   */
  private buildTwitterText(content: any): string {
    const parts: string[] = [];

    if (content.hook) {
      parts.push(content.hook);
    }

    if (content.caption) {
      parts.push('');
      parts.push(content.caption);
    }

    if (content.cta) {
      parts.push('');
      parts.push(content.cta);
    }

    // Limit hashtags for Twitter
    if (content.hashtags && content.hashtags.length > 0) {
      parts.push('');
      parts.push(content.hashtags.slice(0, 2).join(' '));
    }

    return parts.join('\n');
  }

  /**
   * Split text into multiple tweets
   */
  private splitIntoTweets(text: string, maxLength = 270): string[] {
    const tweets: string[] = [];
    const paragraphs = text.split('\n\n');
    let currentTweet = '';

    for (const paragraph of paragraphs) {
      if ((currentTweet + '\n\n' + paragraph).length <= maxLength) {
        currentTweet += (currentTweet ? '\n\n' : '') + paragraph;
      } else {
        if (currentTweet) {
          tweets.push(currentTweet);
        }
        currentTweet = paragraph;
      }
    }

    if (currentTweet) {
      tweets.push(currentTweet);
    }

    return tweets;
  }

  /**
   * Get metrics for a published post
   */
  async getPostMetrics(
    platform: Platform,
    postId: string
  ): Promise<any> {
    switch (platform) {
      case 'instagram':
        return await instagramPublisher.getPostInsights(postId);

      case 'linkedin':
        return await linkedInPublisher.getPostStats(postId);

      case 'twitter':
        return await twitterPublisher.getTweetMetrics(postId);

      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Delete a post
   */
  async deletePost(platform: Platform, postId: string): Promise<boolean> {
    switch (platform) {
      case 'instagram':
        return await instagramPublisher.deletePost(postId);

      case 'linkedin':
        return await linkedInPublisher.deletePost(postId);

      case 'twitter':
        return await twitterPublisher.deleteTweet(postId);

      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Check if all platforms are configured
   */
  getConfiguredPlatforms(): Platform[] {
    const platforms: Platform[] = [];

    if (instagramPublisher.isConfigured()) {
      platforms.push('instagram');
    }

    if (linkedInPublisher.isConfigured()) {
      platforms.push('linkedin');
    }

    if (twitterPublisher.isConfigured()) {
      platforms.push('twitter');
    }

    return platforms;
  }
}

export const socialMediaPublisher = new SocialMediaPublisher();

// Export individual publishers
export { instagramPublisher, linkedInPublisher, twitterPublisher };
