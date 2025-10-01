import { BrandVoiceAnalyzerAgent } from '../brand-voice-analyzer';

describe('BrandVoiceAnalyzerAgent', () => {
  let agent: BrandVoiceAnalyzerAgent;

  beforeEach(() => {
    agent = new BrandVoiceAnalyzerAgent();
  });

  describe('analyzeSamples', () => {
    it('should analyze brand voice samples and return characteristics', async () => {
      const samples = [
        { content: 'We believe in innovation and pushing boundaries!' },
        { content: 'Our mission is to empower creators worldwide.' },
        { content: 'Join us in revolutionizing the industry.' },
      ];

      const result = await agent.analyzeSamples(samples);

      expect(result).toBeDefined();
      expect(result.tone).toBeDefined();
      expect(result.vocabulary).toBeDefined();
      expect(result.sentenceStructure).toBeDefined();
      expect(result.themes).toBeInstanceOf(Array);
    });

    it('should return default profile for empty samples', async () => {
      const result = await agent.analyzeSamples([]);

      expect(result).toBeDefined();
      expect(result.tone).toBe('professional');
      expect(result.vocabulary).toContain('clear');
      expect(result.vocabulary).toContain('concise');
    });

    it('should handle single sample', async () => {
      const samples = [
        { content: 'Exciting news! We just launched a new feature.' },
      ];

      const result = await agent.analyzeSamples(samples);

      expect(result).toBeDefined();
      expect(result.themes).toBeInstanceOf(Array);
      expect(result.themes.length).toBeGreaterThan(0);
    });
  });

  describe('learnFromEdits', () => {
    it('should extract learning from content edits', async () => {
      const originalContent = {
        caption: 'Check out our new product',
        hook: 'New product alert',
      };

      const editedContent = {
        caption: 'Exciting news! Discover our revolutionary new product',
        hook: '🚀 Game-changing product just dropped',
      };

      const result = await agent.learnFromEdits(originalContent, editedContent);

      expect(result).toBeDefined();
      expect(result.patterns).toBeInstanceOf(Array);
      expect(result.preferences).toBeDefined();
    });

    it('should identify emoji usage preference', async () => {
      const originalContent = {
        caption: 'New feature available',
      };

      const editedContent = {
        caption: '✨ New feature available ✨',
      };

      const result = await agent.learnFromEdits(originalContent, editedContent);

      expect(result.preferences?.emojiUsage).toBe(true);
    });

    it('should detect tone changes', async () => {
      const originalContent = {
        caption: 'Product update',
      };

      const editedContent = {
        caption: 'Exciting product update!',
      };

      const result = await agent.learnFromEdits(originalContent, editedContent);

      expect(result.patterns.length).toBeGreaterThan(0);
    });
  });

  describe('mergeProfiles', () => {
    it('should merge multiple brand voice profiles', () => {
      const profiles = [
        {
          tone: 'friendly',
          vocabulary: ['awesome', 'great'],
          sentenceStructure: 'short',
          themes: ['innovation'],
        },
        {
          tone: 'professional',
          vocabulary: ['excellent', 'quality'],
          sentenceStructure: 'medium',
          themes: ['reliability'],
        },
      ];

      const result = agent.mergeProfiles(profiles);

      expect(result).toBeDefined();
      expect(result.vocabulary).toBeInstanceOf(Array);
      expect(result.vocabulary.length).toBeGreaterThan(0);
      expect(result.themes).toContain('innovation');
      expect(result.themes).toContain('reliability');
    });

    it('should handle empty profiles array', () => {
      const result = agent.mergeProfiles([]);

      expect(result).toBeDefined();
      expect(result.tone).toBe('professional');
    });

    it('should give more weight to recent profiles', () => {
      const profiles = [
        {
          tone: 'casual',
          vocabulary: ['hey', 'cool'],
          sentenceStructure: 'short',
          themes: ['fun'],
        },
        {
          tone: 'professional',
          vocabulary: ['greetings', 'excellent'],
          sentenceStructure: 'medium',
          themes: ['business'],
        },
      ];

      const result = agent.mergeProfiles(profiles);

      // Should favor professional tone from most recent profile
      expect(result.tone).toBe('professional');
    });
  });
});
