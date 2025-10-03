import { getAIClient } from '@/src/lib/integrations/openrouter';
import type { ContentIdea, ScrapedPost, ContentAnalysis, BrandVoiceProfile } from '@/src/types/workflow.types';

export class IdeaGeneratorAgent {
  private client: ReturnType<typeof getAIClient>;

  constructor() {
    this.client = getAIClient();
  }

  async generateIdeas(
    scrapedData: { posts: ScrapedPost[]; analysis: ContentAnalysis },
    brandVoice?: BrandVoiceProfile | null,
    topic?: string
  ): Promise<ContentIdea[]> {
    const topPosts = scrapedData.posts.slice(0, 10);
    const { analysis } = scrapedData;

    // If no posts, generate ideas based on topic without scraped data context
    if (topPosts.length === 0) {
      if (!topic) {
        throw new Error('Cannot generate ideas: no scraped data and no topic provided');
      }
      return this.generateIdeasFromTopic(topic, brandVoice);
    }

    const prompt = `
      You are a content strategist analyzing trending content.

      Based on the following top-performing Instagram content:

      Top Posts Summary:
      - Average engagement: ${analysis.avgEngagement || 0}
      - Top hashtags: ${analysis.hashtags?.slice(0, 10).join(', ') || 'N/A'}
      - Content types: ${JSON.stringify(analysis.contentTypes || {})}
      - Key themes: ${analysis.themes?.join(', ') || 'N/A'}

      Sample high-performing posts:
      ${topPosts.length > 0 ? topPosts.map(p => `- ${p.caption?.substring(0, 100)}... (${p.engagement} engagement)`).join('\n') : 'No sample posts available'}

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
  /**
   * Generate ideas from topic alone (when scraping fails or returns no results)
   * Uses AI to create real content ideas based on the user's topic
   */
  private async generateIdeasFromTopic(
    topic: string,
    brandVoice?: BrandVoiceProfile | null
  ): Promise<ContentIdea[]> {
    console.log(`Generating AI content ideas for topic: "${topic}"`);

    const prompt = `
      You are a creative Instagram content strategist.

      Generate 5 unique, high-engagement Instagram content ideas specifically about: "${topic}"

      ${brandVoice ? `
      Brand Voice Guidelines:
      - Tone: ${brandVoice.tone?.join(', ') || 'engaging, authentic'}
      - Style: ${brandVoice.writingStyle?.join(', ') || 'conversational'}
      - Themes: ${brandVoice.contentThemes?.join(', ') || 'lifestyle, inspiration'}
      ` : 'Use an engaging, authentic, conversational tone'}

      Requirements:
      - ALL ideas must be directly related to "${topic}"
      - Include diverse formats (reels, carousels, posts)
      - Focus on actionable, valuable content
      - Create scroll-stopping hooks
      - Make content shareable and engaging

      Return as JSON array with this exact structure:
      {
        "ideas": [
          {
            "id": "idea-1",
            "title": "Content idea title about ${topic}",
            "hook": "Compelling first line",
            "angle": "Unique perspective on ${topic}",
            "format": "reel|carousel|post",
            "description": "Detailed description of the content",
            "trendingAudio": "Audio suggestion if applicable for reels",
            "estimatedEngagement": 5000,
            "contentPillars": ["relevant", "categories"],
            "targetAudience": "Who this content is for"
          }
        ]
      }
    `;

    const ideas = await this.client.complete({
      model: 'anthropic/claude-3-5-sonnet',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      maxTokens: 3000,
      responseFormat: 'json',
    });

    console.log('AI generated ideas response:', JSON.stringify(ideas).substring(0, 200));

    const ideasArray = Array.isArray(ideas) ? ideas : ideas.ideas || [ideas];

    if (!Array.isArray(ideasArray) || ideasArray.length === 0) {
      throw new Error('AI failed to generate content ideas - received invalid response');
    }

    return ideasArray.slice(0, 5).map((idea: any, index: number) => ({
      id: idea.id || `idea-${Date.now()}-${index}`,
      title: idea.title || `Content Idea ${index + 1}`,
      hook: idea.hook || '',
      angle: idea.angle || '',
      format: idea.format || 'post',
      description: idea.description || '',
      trendingAudio: idea.trendingAudio,
      estimatedEngagement: idea.estimatedEngagement || 5000,
      contentPillars: idea.contentPillars || [topic],
      targetAudience: idea.targetAudience || 'general audience',
    }));
  }
}

export default IdeaGeneratorAgent;