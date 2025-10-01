/**
 * Twitter/X Publishing Service
 * Uses Twitter API v2 for publishing content
 */

export interface TwitterConfig {
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  accessTokenSecret?: string;
  bearerToken?: string;
}

export interface TwitterPost {
  text: string;
  mediaUrls?: string[];
  mediaIds?: string[];
  replySettings?: 'everyone' | 'mentionedUsers' | 'following';
  poll?: {
    options: string[];
    durationMinutes: number;
  };
  quoteTweetId?: string;
  replyToTweetId?: string;
}

export interface TwitterPublishResponse {
  id: string;
  text: string;
  url: string;
}

export class TwitterPublisher {
  private config: TwitterConfig;
  private baseUrl = 'https://api.twitter.com/2';

  constructor(config?: TwitterConfig) {
    this.config = {
      apiKey: config?.apiKey || process.env.TWITTER_API_KEY,
      apiSecret: config?.apiSecret || process.env.TWITTER_API_SECRET,
      accessToken: config?.accessToken || process.env.TWITTER_ACCESS_TOKEN,
      accessTokenSecret:
        config?.accessTokenSecret || process.env.TWITTER_ACCESS_TOKEN_SECRET,
      bearerToken: config?.bearerToken || process.env.TWITTER_BEARER_TOKEN,
    };
  }

  /**
   * Generate OAuth 1.0a signature for authenticated requests
   */
  private generateOAuthHeader(
    method: string,
    url: string,
    params: Record<string, string> = {}
  ): string {
    // This is a simplified version
    // In production, use a library like 'oauth-1.0a'
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Math.random().toString(36).substring(2);

    const oauthParams = {
      oauth_consumer_key: this.config.apiKey!,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_token: this.config.accessToken!,
      oauth_version: '1.0',
    };

    // In production, properly generate signature
    const signature = 'SIGNATURE_PLACEHOLDER';

    return `OAuth ${Object.entries({ ...oauthParams, oauth_signature: signature })
      .map(([k, v]) => `${k}="${encodeURIComponent(v)}"`)
      .join(', ')}`;
  }

  /**
   * Publish a tweet
   */
  async publishTweet(post: TwitterPost): Promise<TwitterPublishResponse> {
    const url = `${this.baseUrl}/tweets`;

    const tweetData: any = {
      text: post.text,
    };

    // Add media if provided
    if (post.mediaIds && post.mediaIds.length > 0) {
      tweetData.media = {
        media_ids: post.mediaIds,
      };
    } else if (post.mediaUrls && post.mediaUrls.length > 0) {
      // Upload media first
      const mediaIds = await this.uploadMedia(post.mediaUrls);
      tweetData.media = {
        media_ids: mediaIds,
      };
    }

    // Add reply settings
    if (post.replySettings) {
      tweetData.reply_settings = post.replySettings;
    }

    // Add poll if provided
    if (post.poll) {
      tweetData.poll = {
        options: post.poll.options,
        duration_minutes: post.poll.durationMinutes,
      };
    }

    // Quote tweet
    if (post.quoteTweetId) {
      tweetData.quote_tweet_id = post.quoteTweetId;
    }

    // Reply to tweet
    if (post.replyToTweetId) {
      tweetData.reply = {
        in_reply_to_tweet_id: post.replyToTweetId,
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.bearerToken}`,
      },
      body: JSON.stringify(tweetData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Twitter API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    const tweetId = data.data.id;

    return {
      id: tweetId,
      text: data.data.text,
      url: `https://twitter.com/i/web/status/${tweetId}`,
    };
  }

  /**
   * Upload media to Twitter
   */
  async uploadMedia(mediaUrls: string[]): Promise<string[]> {
    const mediaIds: string[] = [];

    for (const mediaUrl of mediaUrls) {
      const mediaId = await this.uploadSingleMedia(mediaUrl);
      mediaIds.push(mediaId);
    }

    return mediaIds;
  }

  /**
   * Upload a single media file
   */
  private async uploadSingleMedia(mediaUrl: string): Promise<string> {
    // Step 1: Download media
    const mediaResponse = await fetch(mediaUrl);
    const mediaBuffer = await mediaResponse.arrayBuffer();
    const mediaType = mediaResponse.headers.get('content-type') || 'image/jpeg';

    // Step 2: Initialize upload (for large files)
    const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';

    // For simplicity, using INIT -> APPEND -> FINALIZE flow
    // Step 2a: INIT
    const initResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.bearerToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        command: 'INIT',
        total_bytes: mediaBuffer.byteLength.toString(),
        media_type: mediaType,
      }),
    });

    const initData = await initResponse.json();
    const mediaId = initData.media_id_string;

    // Step 2b: APPEND
    const formData = new FormData();
    formData.append('command', 'APPEND');
    formData.append('media_id', mediaId);
    formData.append('segment_index', '0');
    formData.append('media', new Blob([mediaBuffer]));

    await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.bearerToken}`,
      },
      body: formData,
    });

    // Step 2c: FINALIZE
    await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.bearerToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        command: 'FINALIZE',
        media_id: mediaId,
      }),
    });

    return mediaId;
  }

  /**
   * Publish a thread (multiple tweets)
   */
  async publishThread(tweets: string[]): Promise<TwitterPublishResponse[]> {
    const results: TwitterPublishResponse[] = [];
    let previousTweetId: string | undefined;

    for (const tweetText of tweets) {
      const response = await this.publishTweet({
        text: tweetText,
        replyToTweetId: previousTweetId,
      });

      results.push(response);
      previousTweetId = response.id;
    }

    return results;
  }

  /**
   * Delete a tweet
   */
  async deleteTweet(tweetId: string): Promise<boolean> {
    const url = `${this.baseUrl}/tweets/${tweetId}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.config.bearerToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Twitter API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data.data.deleted || false;
  }

  /**
   * Get tweet details
   */
  async getTweet(tweetId: string): Promise<any> {
    const url = `${this.baseUrl}/tweets/${tweetId}?tweet.fields=created_at,public_metrics,entities`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.config.bearerToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Twitter API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data.data;
  }

  /**
   * Get tweet metrics
   */
  async getTweetMetrics(tweetId: string): Promise<any> {
    const tweet = await this.getTweet(tweetId);
    return tweet.public_metrics || {};
  }

  /**
   * Search tweets
   */
  async searchTweets(query: string, maxResults = 10): Promise<any[]> {
    const url = `${this.baseUrl}/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${maxResults}&tweet.fields=created_at,public_metrics`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.config.bearerToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Twitter API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data.data || [];
  }

  /**
   * Get user timeline
   */
  async getUserTimeline(userId: string, maxResults = 10): Promise<any[]> {
    const url = `${this.baseUrl}/users/${userId}/tweets?max_results=${maxResults}&tweet.fields=created_at,public_metrics`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.config.bearerToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Twitter API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data.data || [];
  }

  /**
   * Get authenticated user info
   */
  async getMe(): Promise<any> {
    const url = `${this.baseUrl}/users/me`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.config.bearerToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Twitter API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data.data;
  }

  /**
   * Schedule a tweet (requires Twitter API Pro or higher)
   */
  async scheduleTweet(
    post: TwitterPost,
    scheduledAt: Date
  ): Promise<{ tweetId: string; scheduledTime: Date }> {
    // Note: Scheduling requires Business/Enterprise tier
    // This is a placeholder for the API structure
    throw new Error('Tweet scheduling requires Twitter API Business tier');
  }

  isConfigured(): boolean {
    return !!(this.config.bearerToken || (this.config.accessToken && this.config.apiKey));
  }
}

export const twitterPublisher = new TwitterPublisher();
