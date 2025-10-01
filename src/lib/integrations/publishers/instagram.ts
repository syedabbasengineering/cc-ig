/**
 * Instagram Publishing Service
 * Uses Instagram Graph API for publishing content
 */

export interface InstagramConfig {
  accessToken?: string;
  instagramBusinessAccountId?: string;
  facebookPageId?: string;
}

export interface InstagramPost {
  caption: string;
  imageUrl?: string;
  videoUrl?: string;
  mediaType?: 'IMAGE' | 'VIDEO' | 'CAROUSEL';
  location?: {
    id: string;
    name: string;
  };
  productTags?: string[];
  collaborators?: string[];
}

export interface InstagramPublishResponse {
  id: string;
  permalink?: string;
}

export class InstagramPublisher {
  private config: InstagramConfig;
  private baseUrl = 'https://graph.facebook.com/v18.0';

  constructor(config?: InstagramConfig) {
    this.config = {
      accessToken: config?.accessToken || process.env.INSTAGRAM_ACCESS_TOKEN,
      instagramBusinessAccountId:
        config?.instagramBusinessAccountId ||
        process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
      facebookPageId: config?.facebookPageId || process.env.FACEBOOK_PAGE_ID,
    };
  }

  /**
   * Publish a single image post to Instagram
   */
  async publishImage(post: InstagramPost): Promise<InstagramPublishResponse> {
    if (!post.imageUrl) {
      throw new Error('Image URL is required for image posts');
    }

    // Step 1: Create media container
    const containerId = await this.createMediaContainer({
      image_url: post.imageUrl,
      caption: post.caption,
      location_id: post.location?.id,
    });

    // Step 2: Publish the container
    return await this.publishContainer(containerId);
  }

  /**
   * Publish a video post to Instagram
   */
  async publishVideo(post: InstagramPost): Promise<InstagramPublishResponse> {
    if (!post.videoUrl) {
      throw new Error('Video URL is required for video posts');
    }

    // Step 1: Create video container
    const containerId = await this.createMediaContainer({
      media_type: 'VIDEO',
      video_url: post.videoUrl,
      caption: post.caption,
      location_id: post.location?.id,
    });

    // Step 2: Wait for video processing (poll status)
    await this.waitForVideoProcessing(containerId);

    // Step 3: Publish the container
    return await this.publishContainer(containerId);
  }

  /**
   * Publish a carousel post (multiple images)
   */
  async publishCarousel(
    imageUrls: string[],
    caption: string
  ): Promise<InstagramPublishResponse> {
    if (imageUrls.length < 2 || imageUrls.length > 10) {
      throw new Error('Carousel must contain 2-10 images');
    }

    // Step 1: Create containers for each image
    const containerIds: string[] = [];
    for (const imageUrl of imageUrls) {
      const containerId = await this.createMediaContainer({
        image_url: imageUrl,
        is_carousel_item: true,
      });
      containerIds.push(containerId);
    }

    // Step 2: Create carousel container
    const carouselContainerId = await this.createMediaContainer({
      media_type: 'CAROUSEL',
      caption,
      children: containerIds,
    });

    // Step 3: Publish the carousel
    return await this.publishContainer(carouselContainerId);
  }

  /**
   * Create a media container
   */
  private async createMediaContainer(params: any): Promise<string> {
    const url = `${this.baseUrl}/${this.config.instagramBusinessAccountId}/media`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...params,
        access_token: this.config.accessToken,
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(`Instagram API error: ${data.error.message}`);
    }

    return data.id;
  }

  /**
   * Publish a media container
   */
  private async publishContainer(
    containerId: string
  ): Promise<InstagramPublishResponse> {
    const url = `${this.baseUrl}/${this.config.instagramBusinessAccountId}/media_publish`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: this.config.accessToken,
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(`Instagram API error: ${data.error.message}`);
    }

    // Get post permalink
    const permalink = await this.getPostPermalink(data.id);

    return {
      id: data.id,
      permalink,
    };
  }

  /**
   * Wait for video processing to complete
   */
  private async waitForVideoProcessing(
    containerId: string,
    maxAttempts = 30
  ): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.getContainerStatus(containerId);

      if (status === 'FINISHED') {
        return;
      }

      if (status === 'ERROR') {
        throw new Error('Video processing failed');
      }

      // Wait 2 seconds before next check
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error('Video processing timeout');
  }

  /**
   * Get container processing status
   */
  private async getContainerStatus(containerId: string): Promise<string> {
    const url = `${this.baseUrl}/${containerId}?fields=status_code&access_token=${this.config.accessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      throw new Error(`Instagram API error: ${data.error.message}`);
    }

    return data.status_code;
  }

  /**
   * Get post permalink
   */
  private async getPostPermalink(postId: string): Promise<string> {
    const url = `${this.baseUrl}/${postId}?fields=permalink&access_token=${this.config.accessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error('Failed to get permalink:', data.error);
      return '';
    }

    return data.permalink || '';
  }

  /**
   * Get insights for a post
   */
  async getPostInsights(postId: string): Promise<any> {
    const metrics = [
      'engagement',
      'impressions',
      'reach',
      'saved',
      'likes',
      'comments',
      'shares',
    ];

    const url = `${this.baseUrl}/${postId}/insights?metric=${metrics.join(',')}&access_token=${this.config.accessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      throw new Error(`Instagram API error: ${data.error.message}`);
    }

    return data.data;
  }

  /**
   * Schedule a post (requires Facebook's Creator Studio)
   */
  async schedulePost(
    post: InstagramPost,
    publishTime: Date
  ): Promise<{ containerId: string; scheduledTime: Date }> {
    // Note: Direct scheduling via API is limited
    // This creates a container that can be scheduled via Creator Studio
    const containerId = await this.createMediaContainer({
      image_url: post.imageUrl,
      caption: post.caption,
    });

    return {
      containerId,
      scheduledTime: publishTime,
    };
  }

  /**
   * Delete a post
   */
  async deletePost(postId: string): Promise<boolean> {
    const url = `${this.baseUrl}/${postId}?access_token=${this.config.accessToken}`;

    const response = await fetch(url, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(`Instagram API error: ${data.error.message}`);
    }

    return data.success || false;
  }

  /**
   * Get account insights
   */
  async getAccountInsights(period: 'day' | 'week' | 'days_28' = 'day'): Promise<any> {
    const metrics = [
      'impressions',
      'reach',
      'follower_count',
      'email_contacts',
      'phone_call_clicks',
      'text_message_clicks',
      'get_directions_clicks',
      'website_clicks',
      'profile_views',
    ];

    const url = `${this.baseUrl}/${this.config.instagramBusinessAccountId}/insights?metric=${metrics.join(',')}&period=${period}&access_token=${this.config.accessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      throw new Error(`Instagram API error: ${data.error.message}`);
    }

    return data.data;
  }

  isConfigured(): boolean {
    return !!(this.config.accessToken && this.config.instagramBusinessAccountId);
  }
}

export const instagramPublisher = new InstagramPublisher();
