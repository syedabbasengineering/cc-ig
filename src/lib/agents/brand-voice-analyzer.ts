import { getAIClient } from '@/src/lib/integrations/openrouter';
import type { BrandVoiceProfile } from '@/src/types/workflow.types';

export class BrandVoiceAnalyzerAgent {
  private client: ReturnType<typeof getAIClient>;

  constructor() {
    this.client = getAIClient();
  }

  async analyzeBrandVoice(samples: string[]): Promise<BrandVoiceProfile> {
    const prompt = `
      Analyze these content samples to extract brand voice characteristics.

      Samples:
      ${samples.map((s, i) => `Sample ${i + 1}: ${s}`).join('\n\n')}

      Extract and define:
      1. Tone (professional, casual, humorous, inspirational, etc.)
      2. Writing style (short/punchy, long-form, storytelling, educational)
      3. Vocabulary preferences (simple, technical, trendy, classic)
      4. Common phrases and patterns
      5. Emoji usage patterns
      6. Hashtag style (#CamelCase vs #lowercase)
      7. CTA preferences
      8. Content themes and topics
      9. Do's and Don'ts

      Return as JSON with this structure:
      {
        "tone": ["array of tone descriptors"],
        "writingStyle": ["array of style descriptors"],
        "vocabularyPreferences": {
          "preferred": ["array of preferred words/phrases"],
          "avoided": ["array of words/phrases to avoid"]
        },
        "commonPhrases": ["array of common phrases"],
        "emojiUsage": {
          "frequency": "high/medium/low/none",
          "preferred": ["array of commonly used emojis"]
        },
        "hashtagStyle": "CamelCase/lowercase/UPPERCASE/mixed",
        "ctaPreferences": ["array of CTA styles"],
        "contentThemes": ["array of themes"],
        "rules": {
          "dos": ["array of things to do"],
          "donts": ["array of things to avoid"]
        }
      }
    `;

    try {
      const result = await this.client.complete({
        model: 'anthropic/claude-3-5-sonnet',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        responseFormat: 'json',
      });

      return result as BrandVoiceProfile;
    } catch (error) {
      console.error('Error analyzing brand voice:', error);
      // Return default profile if analysis fails
      return this.getDefaultProfile();
    }
  }

  async learnFromEdit(
    originalContent: string,
    editedContent: string,
    fieldEdited: string
  ): Promise<{ learning: string; field: string; rules: string[] }> {
    const prompt = `
      Analyze this content edit to understand brand voice preferences:

      Field edited: ${fieldEdited}
      Original: ${originalContent}
      Edited: ${editedContent}

      Extract:
      1. What changed and why (tone, style, vocabulary)
      2. Specific preferences shown by this edit
      3. Rules to apply in future content generation

      Return as JSON:
      {
        "learning": "brief description of what was learned",
        "field": "${fieldEdited}",
        "rules": ["array of specific rules to apply"]
      }
    `;

    try {
      const result = await this.client.complete({
        model: 'anthropic/claude-3-5-sonnet',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        responseFormat: 'json',
      });

      return result;
    } catch (error) {
      console.error('Error learning from edit:', error);
      return {
        learning: 'Unable to analyze edit',
        field: fieldEdited,
        rules: [],
      };
    }
  }

  async mergeBrandVoices(
    existing: BrandVoiceProfile | null,
    newAnalysis: BrandVoiceProfile
  ): Promise<BrandVoiceProfile> {
    if (!existing) return newAnalysis;

    // Merge the two profiles intelligently
    return {
      tone: [...new Set([...existing.tone, ...newAnalysis.tone])],
      writingStyle: [...new Set([...existing.writingStyle, ...newAnalysis.writingStyle])],
      vocabularyPreferences: {
        preferred: [...new Set([
          ...existing.vocabularyPreferences.preferred,
          ...newAnalysis.vocabularyPreferences.preferred,
        ])],
        avoided: [...new Set([
          ...existing.vocabularyPreferences.avoided,
          ...newAnalysis.vocabularyPreferences.avoided,
        ])],
      },
      commonPhrases: [...new Set([...existing.commonPhrases, ...newAnalysis.commonPhrases])],
      emojiUsage: newAnalysis.emojiUsage, // Use newer preference
      hashtagStyle: newAnalysis.hashtagStyle, // Use newer preference
      ctaPreferences: [...new Set([...existing.ctaPreferences, ...newAnalysis.ctaPreferences])],
      contentThemes: [...new Set([...existing.contentThemes, ...newAnalysis.contentThemes])],
      rules: {
        dos: [...new Set([...existing.rules.dos, ...newAnalysis.rules.dos])],
        donts: [...new Set([...existing.rules.donts, ...newAnalysis.rules.donts])],
      },
      learnings: existing.learnings || [],
    };
  }

  private getDefaultProfile(): BrandVoiceProfile {
    return {
      tone: ['professional', 'friendly'],
      writingStyle: ['concise', 'informative'],
      vocabularyPreferences: {
        preferred: [],
        avoided: [],
      },
      commonPhrases: [],
      emojiUsage: {
        frequency: 'medium',
        preferred: [],
      },
      hashtagStyle: 'lowercase',
      ctaPreferences: ['Learn more', 'Check it out', 'Get started'],
      contentThemes: [],
      rules: {
        dos: ['Be authentic', 'Provide value', 'Engage with audience'],
        donts: ['Use excessive jargon', 'Be overly promotional'],
      },
    };
  }
}

export default BrandVoiceAnalyzerAgent;