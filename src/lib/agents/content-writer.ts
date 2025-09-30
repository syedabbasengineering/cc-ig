import { getAIClient } from '@/src/lib/integrations/openrouter';
import type { GeneratedContent, ContentIdea, BrandVoiceProfile } from '@/src/types/workflow.types';

export class ContentWriterAgent {
  private client: ReturnType<typeof getAIClient>;

  constructor() {
    this.client = getAIClient();
  }

  async writeContent(
    idea: ContentIdea,
    research?: any,
    brandVoice?: BrandVoiceProfile | null
  ): Promise<GeneratedContent> {
    const prompt = `
      Create Instagram content based on:

      Idea:
      - Title: ${idea.title}
      - Hook: ${idea.hook}
      - Angle: ${idea.angle}
      - Format: ${idea.format}
      - Description: ${idea.description}
      ${idea.trendingAudio ? `- Trending Audio: ${idea.trendingAudio}` : ''}

      ${research ? `
      Supporting Research:
      ${JSON.stringify(research, null, 2)}
      ` : ''}

      ${brandVoice ? `
      Brand Voice Requirements:
      - Tone: ${brandVoice.tone.join(', ')}
      - Style: ${brandVoice.writingStyle.join(', ')}
      - Preferred phrases: ${brandVoice.commonPhrases.slice(0, 5).join(', ')}
      - Emoji usage: ${brandVoice.emojiUsage.frequency}
      - Hashtag style: ${brandVoice.hashtagStyle}
      - CTA preferences: ${brandVoice.ctaPreferences.join(', ')}
      - Do's: ${brandVoice.rules.dos.slice(0, 3).join(', ')}
      - Don'ts: ${brandVoice.rules.donts.slice(0, 3).join(', ')}
      ` : 'Write in a professional, engaging tone'}

      Generate comprehensive content including:
      1. Caption (125-150 words for posts, 50-75 for reels)
      2. Hook (first line that stops scrolling - must be attention-grabbing)
      3. 5-7 relevant hashtags (mix of high and medium volume)
      4. Call-to-action (clear and compelling)
      5. Visual description (for image generation)
      ${idea.format === 'reel' || idea.format === 'story' ? '6. Script outline (3-5 key points)' : ''}
      ${idea.format === 'carousel' ? '6. Slide breakdown (3-5 slides with titles)' : ''}

      Rules:
      - No fluff or corporate speak
      - Direct, conversational tone
      - Include specific value or insight
      - Create emotional connection
      - End with clear CTA

      Return as JSON:
      {
        "caption": "Full caption text",
        "hook": "Opening line",
        "hashtags": ["array", "of", "hashtags"],
        "cta": "Call to action text",
        "visualDescription": "Description for image generation",
        ${idea.format === 'reel' || idea.format === 'story' ? '"scriptOutline": ["point1", "point2", "point3"],' : ''}
        ${idea.format === 'carousel' ? '"slideBreakdown": [{"title": "Slide 1", "content": "..."}, ...],' : ''}
        "metadata": {
          "estimatedReadTime": "X seconds",
          "keyMessage": "Main takeaway",
          "emotionalTone": "inspirational/educational/entertaining"
        }
      }
    `;

    try {
      const result = await this.client.complete({
        model: 'anthropic/claude-3-5-sonnet',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        maxTokens: 2000,
        responseFormat: 'json',
      });

      return {
        id: `content-${Date.now()}`,
        ideaId: idea.id,
        platform: 'instagram',
        type: idea.format,
        caption: result.caption || '',
        hook: result.hook || idea.hook,
        hashtags: result.hashtags || [],
        cta: result.cta || 'Follow for more content!',
        visualDescription: result.visualDescription || '',
        scriptOutline: result.scriptOutline,
        metadata: result.metadata || {},
      };
    } catch (error) {
      console.error('Error writing content:', error);
      return this.generateFallbackContent(idea);
    }
  }

  async refineContent(
    content: GeneratedContent,
    feedback: string
  ): Promise<GeneratedContent> {
    const prompt = `
      Refine this Instagram content based on feedback:

      Current Content:
      ${JSON.stringify(content, null, 2)}

      Feedback:
      ${feedback}

      Apply the feedback while maintaining the core message and format.
      Return the refined content in the same JSON structure.
    `;

    try {
      const refined = await this.client.complete({
        model: 'anthropic/claude-3-5-sonnet',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        responseFormat: 'json',
      });

      return {
        ...content,
        ...refined,
      };
    } catch (error) {
      console.error('Error refining content:', error);
      return content;
    }
  }

  async adaptForPlatform(
    content: GeneratedContent,
    targetPlatform: 'linkedin' | 'twitter'
  ): Promise<GeneratedContent> {
    const platformRules = {
      linkedin: {
        captionLength: '200-250 words',
        tone: 'professional, thought-leadership',
        hashtags: '3-5 professional hashtags',
        cta: 'professional networking focused',
      },
      twitter: {
        captionLength: '280 characters max',
        tone: 'concise, witty, engaging',
        hashtags: '1-2 trending hashtags',
        cta: 'retweet or reply focused',
      },
    };

    const rules = platformRules[targetPlatform];

    const prompt = `
      Adapt this Instagram content for ${targetPlatform}:

      Original Content:
      ${JSON.stringify(content, null, 2)}

      Platform Rules for ${targetPlatform}:
      ${JSON.stringify(rules, null, 2)}

      Maintain the core message while adapting format and tone.
      Return adapted content in the same JSON structure.
    `;

    try {
      const adapted = await this.client.complete({
        model: 'anthropic/claude-3-5-sonnet',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        responseFormat: 'json',
      });

      return {
        ...content,
        ...adapted,
        platform: targetPlatform,
      };
    } catch (error) {
      console.error('Error adapting content:', error);
      return { ...content, platform: targetPlatform };
    }
  }

  private generateFallbackContent(idea: ContentIdea): GeneratedContent {
    return {
      id: `fallback-content-${Date.now()}`,
      ideaId: idea.id,
      platform: 'instagram',
      type: idea.format,
      caption: `${idea.hook}\n\n${idea.description}\n\nWhat do you think? Share your thoughts below!`,
      hook: idea.hook,
      hashtags: ['#trending', '#viral', '#instagram', '#content', '#socialmedia'],
      cta: 'Follow for more content like this!',
      visualDescription: `Visual representation of: ${idea.title}`,
      metadata: {
        generated: 'fallback',
      },
    };
  }
}

export default ContentWriterAgent;