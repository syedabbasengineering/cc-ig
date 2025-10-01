import { InstagramScraper } from '../instagram';

// Mock Apify client
jest.mock('apify-client', () => {
  return {
    ApifyClient: jest.fn().mockImplementation(() => ({
      actor: jest.fn().mockReturnValue({
        call: jest.fn().mockResolvedValue({
          id: 'mock-run-id',
          status: 'SUCCEEDED',
        }),
      }),
      run: jest.fn().mockReturnValue({
        dataset: jest.fn().mockReturnValue({
          listItems: jest.fn().mockResolvedValue({
            items: [
              {
                caption: 'Amazing productivity tips! #productivity',
                likesCount: 1000,
                commentsCount: 50,
                timestamp: new Date().toISOString(),
                displayUrl: 'https://example.com/image.jpg',
              },
              {
                caption: 'Top 5 ways to boost efficiency',
                likesCount: 500,
                commentsCount: 25,
                timestamp: new Date().toISOString(),
                displayUrl: 'https://example.com/image2.jpg',
              },
            ],
          }),
        }),
      }),
    })),
  };
});

describe('InstagramScraper', () => {
  let scraper: InstagramScraper;

  beforeEach(() => {
    scraper = new InstagramScraper();
  });

  describe('scrapeHashtag', () => {
    it('should scrape posts by hashtag', async () => {
      const results = await scraper.scrapeHashtag('productivity', { limit: 10 });

      expect(results).toBeDefined();
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);

      results.forEach(post => {
        expect(post).toHaveProperty('caption');
        expect(post).toHaveProperty('engagement');
        expect(post).toHaveProperty('timestamp');
      });
    });

    it('should filter posts by minimum engagement', async () => {
      const minEngagement = 100;
      const results = await scraper.scrapeHashtag('marketing', {
        limit: 10,
        minEngagement,
      });

      results.forEach(post => {
        expect(post.engagement).toBeGreaterThanOrEqual(minEngagement);
      });
    });

    it('should limit results to specified count', async () => {
      const limit = 5;
      const results = await scraper.scrapeHashtag('business', { limit });

      expect(results.length).toBeLessThanOrEqual(limit);
    });
  });

  describe('analyzeContent', () => {
    it('should analyze scraped content for trends', () => {
      const posts = [
        {
          caption: 'AI tools are transforming productivity',
          engagement: 1000,
          timestamp: new Date().toISOString(),
        },
        {
          caption: 'Best AI apps for creators in 2024',
          engagement: 800,
          timestamp: new Date().toISOString(),
        },
        {
          caption: 'How to use ChatGPT for content creation',
          engagement: 1200,
          timestamp: new Date().toISOString(),
        },
      ];

      const analysis = scraper.analyzeContent(posts);

      expect(analysis).toBeDefined();
      expect(analysis.topTopics).toBeInstanceOf(Array);
      expect(analysis.avgEngagement).toBeGreaterThan(0);
      expect(analysis.topHashtags).toBeInstanceOf(Array);
    });

    it('should identify trending keywords', () => {
      const posts = [
        { caption: 'AI productivity hacks', engagement: 500 },
        { caption: 'AI tools review', engagement: 600 },
        { caption: 'Best AI software', engagement: 700 },
      ];

      const analysis = scraper.analyzeContent(posts);

      expect(analysis.topTopics).toContain('ai');
    });

    it('should calculate average engagement correctly', () => {
      const posts = [
        { caption: 'Post 1', engagement: 100 },
        { caption: 'Post 2', engagement: 200 },
        { caption: 'Post 3', engagement: 300 },
      ];

      const analysis = scraper.analyzeContent(posts);

      expect(analysis.avgEngagement).toBe(200);
    });
  });

  describe('calculateEngagement', () => {
    it('should calculate total engagement from likes and comments', () => {
      const post = {
        likesCount: 1000,
        commentsCount: 50,
      };

      const engagement = scraper.calculateEngagement(post);

      expect(engagement).toBe(1050);
    });

    it('should handle missing comment count', () => {
      const post = {
        likesCount: 500,
      };

      const engagement = scraper.calculateEngagement(post);

      expect(engagement).toBe(500);
    });

    it('should handle missing like count', () => {
      const post = {
        commentsCount: 25,
      };

      const engagement = scraper.calculateEngagement(post);

      expect(engagement).toBe(25);
    });
  });

  describe('extractHashtags', () => {
    it('should extract hashtags from caption', () => {
      const caption = 'Amazing tips! #productivity #success #motivation';

      const hashtags = scraper.extractHashtags(caption);

      expect(hashtags).toEqual(['#productivity', '#success', '#motivation']);
    });

    it('should handle captions without hashtags', () => {
      const caption = 'Great content without any hashtags';

      const hashtags = scraper.extractHashtags(caption);

      expect(hashtags).toEqual([]);
    });

    it('should extract hashtags with numbers', () => {
      const caption = 'Year in review #2024goals #success2024';

      const hashtags = scraper.extractHashtags(caption);

      expect(hashtags).toContain('#2024goals');
      expect(hashtags).toContain('#success2024');
    });

    it('should handle multiple hashtags without spaces', () => {
      const caption = 'Check this out #marketing#business#growth';

      const hashtags = scraper.extractHashtags(caption);

      expect(hashtags.length).toBeGreaterThan(0);
    });
  });
});
