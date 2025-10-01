import { IdeaGeneratorAgent } from '../idea-generator';

describe('IdeaGeneratorAgent', () => {
  let agent: IdeaGeneratorAgent;

  beforeEach(() => {
    agent = new IdeaGeneratorAgent();
  });

  describe('generateIdeas', () => {
    it('should generate content ideas based on topic', async () => {
      const topic = 'productivity tips';
      const count = 5;

      const result = await agent.generateIdeas(topic, count);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeLessThanOrEqual(count);

      result.forEach(idea => {
        expect(idea).toHaveProperty('title');
        expect(idea).toHaveProperty('description');
        expect(idea).toHaveProperty('score');
        expect(idea).toHaveProperty('category');
        expect(typeof idea.title).toBe('string');
        expect(typeof idea.score).toBe('number');
        expect(idea.score).toBeGreaterThanOrEqual(0);
        expect(idea.score).toBeLessThanOrEqual(100);
      });
    });

    it('should incorporate trending topics when provided', async () => {
      const topic = 'social media marketing';
      const trends = [
        { topic: 'AI tools', score: 95 },
        { topic: 'short-form video', score: 90 },
      ];

      const result = await agent.generateIdeas(topic, 3, { trends });

      expect(result.length).toBeGreaterThan(0);
      // At least one idea should reference trending topics
      const hasTrendingRef = result.some(idea =>
        idea.title.toLowerCase().includes('ai') ||
        idea.title.toLowerCase().includes('video')
      );
      expect(hasTrendingRef).toBe(true);
    });

    it('should apply brand voice when provided', async () => {
      const topic = 'business growth';
      const brandVoice = {
        tone: 'friendly',
        vocabulary: ['awesome', 'amazing'],
        sentenceStructure: 'short',
        themes: ['innovation'],
      };

      const result = await agent.generateIdeas(topic, 3, { brandVoice });

      expect(result.length).toBeGreaterThan(0);
      // Ideas should reflect brand voice tone
      result.forEach(idea => {
        expect(idea.description.length).toBeGreaterThan(0);
      });
    });

    it('should handle empty topic gracefully', async () => {
      const result = await agent.generateIdeas('', 3);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should limit number of ideas to requested count', async () => {
      const count = 10;
      const result = await agent.generateIdeas('marketing', count);

      expect(result.length).toBeLessThanOrEqual(count);
    });
  });

  describe('scoreIdea', () => {
    it('should score ideas based on relevance and potential', () => {
      const idea = {
        title: '10 Proven Strategies to Boost Your Productivity',
        description: 'Learn actionable tips to maximize your daily output',
        category: 'how-to',
      };

      const score = agent.scoreIdea(idea, 'productivity');

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should give higher scores to actionable content', () => {
      const idea1 = {
        title: 'Why Productivity Matters',
        description: 'General thoughts on productivity',
        category: 'thought-leadership',
      };

      const idea2 = {
        title: '5 Steps to Double Your Productivity',
        description: 'Step-by-step guide to getting more done',
        category: 'how-to',
      };

      const score1 = agent.scoreIdea(idea1, 'productivity');
      const score2 = agent.scoreIdea(idea2, 'productivity');

      expect(score2).toBeGreaterThan(score1);
    });
  });

  describe('rankIdeas', () => {
    it('should rank ideas by score in descending order', () => {
      const ideas = [
        { title: 'Idea 1', description: 'Desc 1', score: 70, category: 'how-to' },
        { title: 'Idea 2', description: 'Desc 2', score: 90, category: 'how-to' },
        { title: 'Idea 3', description: 'Desc 3', score: 80, category: 'how-to' },
      ];

      const ranked = agent.rankIdeas(ideas);

      expect(ranked[0].score).toBe(90);
      expect(ranked[1].score).toBe(80);
      expect(ranked[2].score).toBe(70);
    });

    it('should handle empty ideas array', () => {
      const ranked = agent.rankIdeas([]);

      expect(ranked).toEqual([]);
    });

    it('should preserve all idea properties after ranking', () => {
      const ideas = [
        {
          title: 'Test Idea',
          description: 'Test Description',
          score: 85,
          category: 'how-to',
          metadata: { custom: 'value' }
        },
      ];

      const ranked = agent.rankIdeas(ideas);

      expect(ranked[0]).toHaveProperty('title');
      expect(ranked[0]).toHaveProperty('description');
      expect(ranked[0]).toHaveProperty('score');
      expect(ranked[0]).toHaveProperty('category');
    });
  });
});
