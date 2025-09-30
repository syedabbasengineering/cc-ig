export interface WorkflowConfig {
  scrapingConfig: {
    platform: 'instagram' | 'linkedin' | 'twitter';
    count: number;
    minEngagement: number;
    timeframe: string;
  };
  aiConfig: {
    ideaCount: number;
    contentVariations: number;
    model?: string;
    temperature?: number;
  };
  publishingConfig?: {
    autoPublish: boolean;
    scheduleTime?: Date;
    platforms: string[];
  };
}

export interface ScrapedPost {
  id: string;
  platform: string;
  content: string;
  caption?: string;
  hashtags?: string[];
  engagement: number;
  engagementRate?: number;
  likesCount: number;
  commentsCount: number;
  sharesCount?: number;
  followersCount?: number;
  mediaType: 'image' | 'video' | 'carousel' | 'text';
  mediaUrl?: string;
  createdAt: Date;
  author?: {
    username: string;
    followersCount?: number;
    verified?: boolean;
  };
}

export interface ContentAnalysis {
  hooks: string[];
  hashtags: string[];
  contentTypes: {
    reels: number;
    carousels: number;
    images: number;
    text: number;
  };
  postingTimes: {
    hour: number;
    dayOfWeek: number;
    count: number;
  }[];
  avgEngagement: number;
  topPerformers: ScrapedPost[];
  themes: string[];
  sentiments: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

export interface ContentIdea {
  id: string;
  title: string;
  hook: string;
  angle: string;
  format: 'reel' | 'carousel' | 'story' | 'post';
  description: string;
  trendingAudio?: string;
  estimatedEngagement?: number;
  contentPillars?: string[];
  targetAudience?: string;
}

export interface GeneratedContent {
  id: string;
  ideaId: string;
  platform: string;
  type: string;
  caption: string;
  hook: string;
  hashtags: string[];
  cta: string;
  visualDescription?: string;
  scriptOutline?: string[];
  imageUrl?: string;
  metadata?: Record<string, any>;
}

export interface BrandVoiceProfile {
  tone: string[];
  writingStyle: string[];
  vocabularyPreferences: {
    preferred: string[];
    avoided: string[];
  };
  commonPhrases: string[];
  emojiUsage: {
    frequency: 'high' | 'medium' | 'low' | 'none';
    preferred: string[];
  };
  hashtagStyle: 'CamelCase' | 'lowercase' | 'UPPERCASE' | 'mixed';
  ctaPreferences: string[];
  contentThemes: string[];
  rules: {
    dos: string[];
    donts: string[];
  };
  learnings?: {
    editId: string;
    learning: string;
    field: string;
    timestamp: Date;
  }[];
}

export interface WorkflowRunData {
  runId: string;
  topic: string;
  brandVoiceSamples?: string[];
  config: WorkflowConfig;
}

export interface QueueJobData {
  scraping: {
    runId: string;
    topic: string;
    config: WorkflowConfig['scrapingConfig'];
  };
  aiProcessing: {
    runId: string;
    scrapedData: {
      posts: ScrapedPost[];
      analysis: ContentAnalysis;
    };
    brandVoice?: BrandVoiceProfile;
  };
  publishing: {
    runId: string;
    contentId: string;
    platform: string;
    scheduledFor?: Date;
  };
}

export type WorkflowStatus =
  | 'pending'
  | 'scraping'
  | 'analyzing'
  | 'generating'
  | 'reviewing'
  | 'publishing'
  | 'published'
  | 'failed';

export type ContentStatus =
  | 'draft'
  | 'reviewing'
  | 'approved'
  | 'rejected'
  | 'published'
  | 'scheduled';

export interface WorkflowMetrics {
  totalPosts: number;
  avgEngagement: number;
  topPerformer: {
    contentId: string;
    engagement: number;
  };
  completionTime: number;
  costsBreakdown?: {
    scraping: number;
    ai: number;
    total: number;
  };
}