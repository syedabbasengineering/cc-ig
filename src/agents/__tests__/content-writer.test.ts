import { ContentWriterAgent } from '../content-writer';

describe('ContentWriterAgent', () => {
  let agent: ContentWriterAgent;

  beforeEach(() => {
    agent = new ContentWriterAgent();
  });

  describe('writeContent', () => {
    it('should generate content for Instagram platform', async () => {
      const idea = {
        title: '5 Productivity Hacks',
        description: 'Simple tips to boost your daily output',
      };

      const result = await agent.writeContent(idea, 'instagram');

      expect(result).toBeDefined();
      expect(result.caption).toBeDefined();
      expect(result.hook).toBeDefined();
      expect(result.hashtags).toBeInstanceOf(Array);
      expect(result.cta).toBeDefined();
      expect(result.platform).toBe('instagram');
    });

    it('should generate content for LinkedIn platform', async () => {
      const idea = {
        title: 'Professional Development Tips',
        description: 'Advance your career with these strategies',
      };

      const result = await agent.writeContent(idea, 'linkedin');

      expect(result).toBeDefined();
      expect(result.platform).toBe('linkedin');
      expect(result.caption).toBeDefined();
      expect(result.caption.length).toBeGreaterThan(0);
    });

    it('should generate content for Twitter platform', async () => {
      const idea = {
        title: 'Quick Marketing Tip',
        description: 'One powerful strategy to grow your audience',
      };

      const result = await agent.writeContent(idea, 'twitter');

      expect(result).toBeDefined();
      expect(result.platform).toBe('twitter');
      expect(result.caption).toBeDefined();
      // Twitter content should be concise
      expect(result.caption.length).toBeLessThanOrEqual(280);
    });

    it('should incorporate brand voice when provided', async () => {
      const idea = {
        title: 'Marketing Strategy',
        description: 'Effective tactics for growth',
      };

      const brandVoice = {
        tone: 'friendly',
        vocabulary: ['awesome', 'amazing', 'fantastic'],
        sentenceStructure: 'short',
        themes: ['empowerment'],
      };

      const result = await agent.writeContent(idea, 'instagram', { brandVoice });

      expect(result).toBeDefined();
      const contentText = (result.caption + ' ' + result.hook).toLowerCase();
      const hasBrandVocab = brandVoice.vocabulary.some(word =>
        contentText.includes(word.toLowerCase())
      );
      // Should use some brand vocabulary
      expect(hasBrandVocab || contentText.includes('empower')).toBe(true);
    });

    it('should include trending elements when provided', async () => {
      const idea = {
        title: 'AI Tools for Creators',
        description: 'Leverage AI to create better content',
      };

      const trends = [
        { topic: 'ChatGPT', score: 95 },
        { topic: 'AI automation', score: 90 },
      ];

      const result = await agent.writeContent(idea, 'instagram', { trends });

      expect(result).toBeDefined();
      const contentText = (result.caption + ' ' + result.hook).toLowerCase();
      expect(contentText.includes('ai') || contentText.includes('chatgpt')).toBe(true);
    });
  });

  describe('createHook', () => {
    it('should create engaging hook for Instagram', () => {
      const idea = {
        title: 'Morning Routine Secrets',
        description: 'Start your day right',
      };

      const hook = agent.createHook(idea, 'instagram');

      expect(hook).toBeDefined();
      expect(typeof hook).toBe('string');
      expect(hook.length).toBeGreaterThan(0);
      expect(hook.length).toBeLessThanOrEqual(150);
    });

    it('should create professional hook for LinkedIn', () => {
      const idea = {
        title: 'Leadership Principles',
        description: 'Build a high-performing team',
      };

      const hook = agent.createHook(idea, 'linkedin');

      expect(hook).toBeDefined();
      expect(hook.length).toBeGreaterThan(0);
    });

    it('should create concise hook for Twitter', () => {
      const idea = {
        title: 'Growth Hack',
        description: 'Double your engagement',
      };

      const hook = agent.createHook(idea, 'twitter');

      expect(hook).toBeDefined();
      expect(hook.length).toBeLessThanOrEqual(100);
    });
  });

  describe('generateHashtags', () => {
    it('should generate relevant hashtags for topic', () => {
      const topic = 'productivity tips';
      const hashtags = agent.generateHashtags(topic, 'instagram');

      expect(hashtags).toBeInstanceOf(Array);
      expect(hashtags.length).toBeGreaterThan(0);
      expect(hashtags.length).toBeLessThanOrEqual(30);

      hashtags.forEach(tag => {
        expect(tag).toMatch(/^#[a-zA-Z0-9]+$/);
      });
    });

    it('should generate fewer hashtags for LinkedIn', () => {
      const topic = 'business strategy';
      const hashtags = agent.generateHashtags(topic, 'linkedin');

      expect(hashtags.length).toBeLessThanOrEqual(10);
    });

    it('should generate minimal hashtags for Twitter', () => {
      const topic = 'marketing tips';
      const hashtags = agent.generateHashtags(topic, 'twitter');

      expect(hashtags.length).toBeLessThanOrEqual(5);
    });

    it('should include common hashtags for the topic', () => {
      const topic = 'social media marketing';
      const hashtags = agent.generateHashtags(topic, 'instagram');

      const hasRelevantTag = hashtags.some(tag =>
        tag.toLowerCase().includes('social') ||
        tag.toLowerCase().includes('marketing') ||
        tag.toLowerCase().includes('media')
      );

      expect(hasRelevantTag).toBe(true);
    });
  });

  describe('createCTA', () => {
    it('should create call-to-action for Instagram', () => {
      const cta = agent.createCTA('instagram');

      expect(cta).toBeDefined();
      expect(typeof cta).toBe('string');
      expect(cta.length).toBeGreaterThan(0);
    });

    it('should create professional CTA for LinkedIn', () => {
      const cta = agent.createCTA('linkedin');

      expect(cta).toBeDefined();
      expect(cta.length).toBeGreaterThan(0);
    });

    it('should create concise CTA for Twitter', () => {
      const cta = agent.createCTA('twitter');

      expect(cta).toBeDefined();
      expect(cta.length).toBeLessThanOrEqual(50);
    });
  });

  describe('refineContent', () => {
    it('should refine content based on feedback', async () => {
      const originalContent = {
        caption: 'Check out our product',
        hook: 'New product',
        hashtags: ['#product'],
        cta: 'Buy now',
        platform: 'instagram',
      };

      const feedback = {
        aspect: 'tone',
        suggestion: 'Make it more exciting and energetic',
      };

      const refined = await agent.refineContent(originalContent, feedback);

      expect(refined).toBeDefined();
      expect(refined.caption).not.toBe(originalContent.caption);
      expect(refined.platform).toBe('instagram');
    });

    it('should improve hashtags when requested', async () => {
      const originalContent = {
        caption: 'Great tips for success',
        hook: 'Success tips',
        hashtags: ['#tips'],
        cta: 'Learn more',
        platform: 'instagram',
      };

      const feedback = {
        aspect: 'hashtags',
        suggestion: 'Add more relevant hashtags',
      };

      const refined = await agent.refineContent(originalContent, feedback);

      expect(refined.hashtags.length).toBeGreaterThan(originalContent.hashtags.length);
    });
  });
});
