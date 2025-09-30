import { OpenAI } from 'openai';

export class OpenRouterClient {
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey || process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'AI Content Workflow',
      },
    });
  }

  async complete(params: {
    model?: string;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    temperature?: number;
    maxTokens?: number;
    responseFormat?: 'json' | 'text';
  }) {
    try {
      const response = await this.client.chat.completions.create({
        model: params.model || 'anthropic/claude-3-5-sonnet',
        messages: params.messages,
        temperature: params.temperature || 0.7,
        max_tokens: params.maxTokens || 2000,
        response_format: params.responseFormat === 'json'
          ? { type: 'json_object' }
          : undefined,
      });

      const content = response.choices[0]?.message?.content || '';

      if (params.responseFormat === 'json') {
        try {
          return JSON.parse(content);
        } catch (e) {
          console.error('Failed to parse JSON response:', e);
          return content;
        }
      }

      return content;
    } catch (error) {
      console.error('OpenRouter API error:', error);
      throw error;
    }
  }

  async generateWithRetry(
    params: Parameters<typeof this.complete>[0],
    maxRetries = 3
  ): Promise<any> {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.complete(params);
      } catch (error) {
        lastError = error;
        console.error(`Attempt ${i + 1} failed:`, error);

        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }

    throw lastError;
  }
}

// Alternative implementation using OpenAI directly
export class OpenAIClient {
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  async complete(params: {
    model?: string;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    temperature?: number;
    maxTokens?: number;
    responseFormat?: 'json' | 'text';
  }) {
    try {
      const response = await this.client.chat.completions.create({
        model: params.model || 'gpt-4-turbo-preview',
        messages: params.messages,
        temperature: params.temperature || 0.7,
        max_tokens: params.maxTokens || 2000,
        response_format: params.responseFormat === 'json'
          ? { type: 'json_object' }
          : undefined,
      });

      const content = response.choices[0]?.message?.content || '';

      if (params.responseFormat === 'json') {
        try {
          return JSON.parse(content);
        } catch (e) {
          console.error('Failed to parse JSON response:', e);
          return content;
        }
      }

      return content;
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  }
}

// Factory function to get the appropriate client
export function getAIClient(): OpenRouterClient | OpenAIClient {
  if (process.env.OPENROUTER_API_KEY) {
    return new OpenRouterClient();
  } else if (process.env.OPENAI_API_KEY) {
    return new OpenAIClient();
  } else {
    throw new Error('No AI API key configured. Please set OPENROUTER_API_KEY or OPENAI_API_KEY');
  }
}

export default OpenRouterClient;