import { getAIClient } from '@/src/lib/integrations/openrouter';
import type { ContentIdea, ScrapedPost, ContentAnalysis, BrandVoiceProfile } from '@/src/types/workflow.types';

export class IdeaGeneratorAgent {
  private client: ReturnType<typeof getAIClient>;

  constructor() {
    this.client = getAIClient();
  }

  async generateIdeas(
    scrapedData: { posts: ScrapedPost[]; analysis: ContentAnalysis },
    brandVoice?: BrandVoiceProfile | null
  ): Promise<ContentIdea[]> {
    const topPosts = scrapedData.posts.slice(0, 10);
    const { analysis } = scrapedData;

    const prompt = `
      You are a content strategist analyzing trending content.

      Based on the following top-performing Instagram content:

      Top Posts Summary:
      - Average engagement: ${analysis.avgEngagement}
      - Top hashtags: ${analysis.hashtags.slice(0, 10).join(', ')}
      - Content types: ${JSON.stringify(analysis.contentTypes)}
      - Key themes: ${analysis.themes.join(', ')}

      Sample high-performing posts:
      ${topPosts.map(p => `- ${p.caption?.substring(0, 100)}... (${p.engagement} engagement)`).join('\n')}

      ${brandVoice ? `
      Brand Voice Guidelines:
      - Tone: ${brandVoice.tone.join(', ')}
      - Style: ${brandVoice.writingStyle.join(', ')}
      - Themes: ${brandVoice.contentThemes.join(', ')}
      - CTAs: ${brandVoice.ctaPreferences.join(', ')}
      ` : 'No specific brand voice guidelines provided'}

      Generate 10 unique content ideas that:
      1. Build on proven engagement patterns
      2. Offer fresh angles not seen in the scraped content
      3. Include scroll-stopping hooks
      4. Specify optimal content format (reel, carousel, story, post)
      5. Include trending audio suggestions if applicable

      Return as JSON array with this structure for each idea:
      {
        "id": "unique-id",
        "title": "Content idea title",
        "hook": "First line that stops scrolling",
        "angle": "Unique perspective or approach",
        "format": "reel|carousel|story|post",
        "description": "Full description of the content idea",
        "trendingAudio": "Audio suggestion if applicable",
        "estimatedEngagement": number,
        "contentPillars": ["array of content categories"],
        "targetAudience": "Primary audience segment"
      }
    `;

    try {
      const ideas = await this.client.complete({
        model: 'anthropic/claude-3-5-sonnet',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        maxTokens: 3000,
        responseFormat: 'json',
      });

      // Ensure we have an array
      const ideasArray = Array.isArray(ideas) ? ideas : ideas.ideas || [ideas];

      return ideasArray.map((idea: any, index: number) => ({
        id: idea.id || `idea-${Date.now()}-${index}`,
        title: idea.title || 'Untitled Idea',
        hook: idea.hook || '',
        angle: idea.angle || '',
        format: idea.format || 'post',
        description: idea.description || '',
        trendingAudio: idea.trendingAudio,
        estimatedEngagement: idea.estimatedEngagement || analysis.avgEngagement,
        contentPillars: idea.contentPillars || [],
        targetAudience: idea.targetAudience || 'General audience',
      }));
    } catch (error) {
      console.error('Error generating ideas:', error);
      // Return fallback ideas
      return this.generateFallbackIdeas(analysis);
    }
  }

  async rankIdeas(ideas: ContentIdea[], criteria?: {
    brandAlignment?: number;
    trendingPotential?: number;
    uniqueness?: number;
  }): Promise<ContentIdea[]> {
    const weights = {
      brandAlignment: criteria?.brandAlignment || 0.3,
      trendingPotential: criteria?.trendingPotential || 0.4,
      uniqueness: criteria?.uniqueness || 0.3,
    };

    // Simple scoring based on estimated engagement and content pillars
    return ideas.sort((a, b) => {
      const scoreA = (a.estimatedEngagement || 0) * weights.trendingPotential +
                     (a.contentPillars?.length || 0) * 100 * weights.brandAlignment +
                     (a.angle ? 500 : 0) * weights.uniqueness;

      const scoreB = (b.estimatedEngagement || 0) * weights.trendingPotential +
                     (b.contentPillars?.length || 0) * 100 * weights.brandAlignment +
                     (b.angle ? 500 : 0) * weights.uniqueness;

      return scoreB - scoreA;
    });
  }

  private generateFallbackIdeas(analysis: ContentAnalysis): ContentIdea[] {
    const formats: ContentIdea['format'][] = ['reel', 'carousel', 'post', 'story'];
    const themes = analysis.themes.slice(0, 5);

    return Array.from({ length: 5 }, (_, i) => ({
      id: `fallback-${Date.now()}-${i}`,
      title: `Content about ${themes[i % themes.length] || 'trending topic'}`,
      hook: `Did you know this about ${themes[i % themes.length]}?`,
      angle: 'Educational and entertaining perspective',
      format: formats[i % formats.length],
      description: `Create engaging content about ${themes[i % themes.length]} using proven engagement patterns`,
      estimatedEngagement: analysis.avgEngagement,
      contentPillars: [themes[i % themes.length]],
      targetAudience: 'General audience',
    }));
  }
}

export default IdeaGeneratorAgent;