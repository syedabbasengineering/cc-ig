/**
 * LinkedIn Publishing Service
 * Uses LinkedIn API v2 for publishing content
 */

export interface LinkedInConfig {
  accessToken?: string;
  personUrn?: string; // For personal profiles
  organizationUrn?: string; // For company pages
}

export interface LinkedInPost {
  text: string;
  imageUrl?: string;
  videoUrl?: string;
  articleUrl?: string;
  articleTitle?: string;
  articleDescription?: string;
  visibility?: 'PUBLIC' | 'CONNECTIONS';
}

export interface LinkedInPublishResponse {
  id: string;
  activityUrn: string;
  shareUrl?: string;
}

export class LinkedInPublisher {
  private config: LinkedInConfig;
  private baseUrl = 'https://api.linkedin.com/v2';

  constructor(config?: LinkedInConfig) {
    this.config = {
      accessToken: config?.accessToken || process.env.LINKEDIN_ACCESS_TOKEN,
      personUrn: config?.personUrn || process.env.LINKEDIN_PERSON_URN,
      organizationUrn: config?.organizationUrn || process.env.LINKEDIN_ORGANIZATION_URN,
    };
  }

  /**
   * Get author URN (person or organization)
   */
  private getAuthorUrn(): string {
    if (this.config.organizationUrn) {
      return this.config.organizationUrn;
    }
    if (this.config.personUrn) {
      return this.config.personUrn;
    }
    throw new Error('LinkedIn author URN not configured');
  }

  /**
   * Publish a text-only post
   */
  async publishTextPost(post: LinkedInPost): Promise<LinkedInPublishResponse> {
    const shareData = {
      author: this.getAuthorUrn(),
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: post.text,
          },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility':
          post.visibility || 'PUBLIC',
      },
    };

    return await this.createShare(shareData);
  }

  /**
   * Publish a post with an image
   */
  async publishImagePost(post: LinkedInPost): Promise<LinkedInPublishResponse> {
    if (!post.imageUrl) {
      throw new Error('Image URL is required for image posts');
    }

    // Step 1: Register upload
    const uploadUrl = await this.registerImageUpload();

    // Step 2: Upload image
    const asset = await this.uploadImage(post.imageUrl, uploadUrl);

    // Step 3: Create share with image
    const shareData = {
      author: this.getAuthorUrn(),
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: post.text,
          },
          shareMediaCategory: 'IMAGE',
          media: [
            {
              status: 'READY',
              description: {
                text: post.text.substring(0, 100),
              },
              media: asset,
              title: {
                text: 'Shared Image',
              },
            },
          ],
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility':
          post.visibility || 'PUBLIC',
      },
    };

    return await this.createShare(shareData);
  }

  /**
   * Publish a post with an article link
   */
  async publishArticlePost(post: LinkedInPost): Promise<LinkedInPublishResponse> {
    if (!post.articleUrl) {
      throw new Error('Article URL is required for article posts');
    }

    const shareData = {
      author: this.getAuthorUrn(),
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: post.text,
          },
          shareMediaCategory: 'ARTICLE',
          media: [
            {
              status: 'READY',
              originalUrl: post.articleUrl,
              title: {
                text: post.articleTitle || 'Article',
              },
              description: {
                text: post.articleDescription || '',
              },
            },
          ],
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility':
          post.visibility || 'PUBLIC',
      },
    };

    return await this.createShare(shareData);
  }

  /**
   * Publish a video post
   */
  async publishVideoPost(post: LinkedInPost): Promise<LinkedInPublishResponse> {
    if (!post.videoUrl) {
      throw new Error('Video URL is required for video posts');
    }

    // Step 1: Register video upload
    const uploadContext = await this.registerVideoUpload();

    // Step 2: Upload video
    const asset = await this.uploadVideo(post.videoUrl, uploadContext);

    // Step 3: Create share with video
    const shareData = {
      author: this.getAuthorUrn(),
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: post.text,
          },
          shareMediaCategory: 'VIDEO',
          media: [
            {
              status: 'READY',
              description: {
                text: post.text.substring(0, 100),
              },
              media: asset,
              title: {
                text: 'Shared Video',
              },
            },
          ],
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility':
          post.visibility || 'PUBLIC',
      },
    };

    return await this.createShare(shareData);
  }

  /**
   * Create a UGC share
   */
  private async createShare(shareData: any): Promise<LinkedInPublishResponse> {
    const url = `${this.baseUrl}/ugcPosts`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(shareData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`LinkedIn API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    const activityUrn = response.headers.get('x-restli-id') || data.id;

    return {
      id: activityUrn,
      activityUrn,
      shareUrl: `https://www.linkedin.com/feed/update/${activityUrn}`,
    };
  }

  /**
   * Register image upload
   */
  private async registerImageUpload(): Promise<string> {
    const url = `${this.baseUrl}/assets?action=registerUpload`;

    const registerData = {
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: this.getAuthorUrn(),
        serviceRelationships: [
          {
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent',
          },
        ],
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(registerData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`LinkedIn API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data.value.uploadMechanism[
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
    ].uploadUrl;
  }

  /**
   * Upload image to LinkedIn
   */
  private async uploadImage(imageUrl: string, uploadUrl: string): Promise<string> {
    // Download image
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();

    // Upload to LinkedIn
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
      },
      body: imageBuffer,
    });

    if (!response.ok) {
      throw new Error('Failed to upload image to LinkedIn');
    }

    // Extract asset URN from upload URL
    const assetUrn = uploadUrl.match(/urn:li:digitalmediaAsset:[^?]+/)?.[0];
    if (!assetUrn) {
      throw new Error('Failed to extract asset URN');
    }

    return assetUrn;
  }

  /**
   * Register video upload
   */
  private async registerVideoUpload(): Promise<any> {
    const url = `${this.baseUrl}/videos?action=initializeUpload`;

    const registerData = {
      initializeUploadRequest: {
        owner: this.getAuthorUrn(),
        fileSizeBytes: 0, // Will be set during upload
        uploadCaptions: false,
        uploadThumbnail: false,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(registerData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`LinkedIn API error: ${JSON.stringify(error)}`);
    }

    return await response.json();
  }

  /**
   * Upload video to LinkedIn
   */
  private async uploadVideo(videoUrl: string, uploadContext: any): Promise<string> {
    // This is a simplified implementation
    // In production, you'd need to handle chunked uploads for large videos
    const videoResponse = await fetch(videoUrl);
    const videoBuffer = await videoResponse.arrayBuffer();

    const uploadUrl = uploadContext.value.uploadInstructions[0].uploadUrl;

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
      },
      body: videoBuffer,
    });

    if (!response.ok) {
      throw new Error('Failed to upload video to LinkedIn');
    }

    return uploadContext.value.video;
  }

  /**
   * Get post statistics
   */
  async getPostStats(shareUrn: string): Promise<any> {
    const url = `${this.baseUrl}/socialActions/${encodeURIComponent(shareUrn)}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`LinkedIn API error: ${JSON.stringify(error)}`);
    }

    return await response.json();
  }

  /**
   * Delete a post
   */
  async deletePost(shareUrn: string): Promise<boolean> {
    const url = `${this.baseUrl}/ugcPosts/${encodeURIComponent(shareUrn)}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });

    return response.ok;
  }

  /**
   * Get user profile info
   */
  async getProfile(): Promise<any> {
    const url = `${this.baseUrl}/me`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`LinkedIn API error: ${JSON.stringify(error)}`);
    }

    return await response.json();
  }

  isConfigured(): boolean {
    return !!(
      this.config.accessToken &&
      (this.config.personUrn || this.config.organizationUrn)
    );
  }
}

export const linkedInPublisher = new LinkedInPublisher();
