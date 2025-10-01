import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';

export interface PineconeConfig {
  apiKey?: string;
  environment?: string;
  indexName?: string;
}

export interface ContentEmbedding {
  id: string;
  values: number[];
  metadata: {
    contentId: string;
    workspaceId: string;
    platform: string;
    caption?: string;
    hook?: string;
    hashtags?: string[];
    createdAt: string;
    engagement?: number;
    status?: string;
  };
}

export interface SearchResult {
  id: string;
  score: number;
  metadata: any;
}

/**
 * Pinecone Vector Database Service
 * Handles content embeddings and semantic search
 */
export class PineconeService {
  private client: Pinecone;
  private openai: OpenAI;
  private config: Required<PineconeConfig>;
  private indexName: string;

  constructor(config?: PineconeConfig) {
    this.config = {
      apiKey: config?.apiKey || process.env.PINECONE_API_KEY || '',
      environment: config?.environment || process.env.PINECONE_ENVIRONMENT || '',
      indexName: config?.indexName || process.env.PINECONE_INDEX_NAME || 'content-embeddings',
    };

    this.indexName = this.config.indexName!;

    // Initialize Pinecone client
    this.client = new Pinecone({
      apiKey: this.config.apiKey || '',
    });

    // Initialize OpenAI for embeddings
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Initialize Pinecone index
   */
  async initializeIndex(dimension = 1536): Promise<void> {
    try {
      // Check if index exists
      const indexes = await this.client.listIndexes();
      const indexExists = indexes.indexes?.some(
        (index) => index.name === this.indexName
      );

      if (!indexExists) {
        // Create index if it doesn't exist
        await this.client.createIndex({
          name: this.indexName,
          dimension,
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1',
            },
          },
        });

        console.log(`Created Pinecone index: ${this.indexName}`);
      } else {
        console.log(`Pinecone index already exists: ${this.indexName}`);
      }
    } catch (error) {
      console.error('Failed to initialize Pinecone index:', error);
      throw error;
    }
  }

  /**
   * Generate embedding for text using OpenAI
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Embed and store content in Pinecone
   */
  async embedContent(content: any, workspaceId: string): Promise<void> {
    try {
      const index = this.client.index(this.indexName);

      // Combine content fields for embedding
      const textToEmbed = this.buildEmbeddingText(content);

      // Generate embedding
      const embedding = await this.generateEmbedding(textToEmbed);

      // Prepare metadata
      const metadata = {
        contentId: content.id,
        workspaceId,
        platform: content.platform || 'instagram',
        caption: content.content?.caption || '',
        hook: content.content?.hook || '',
        hashtags: content.content?.hashtags || [],
        createdAt: content.createdAt?.toISOString() || new Date().toISOString(),
        status: content.status || 'draft',
        engagement: 0,
      };

      // Upsert to Pinecone
      await index.upsert([
        {
          id: content.id,
          values: embedding,
          metadata,
        },
      ]);

      console.log(`Embedded content ${content.id} to Pinecone`);
    } catch (error) {
      console.error('Failed to embed content:', error);
      throw error;
    }
  }

  /**
   * Batch embed multiple content items
   */
  async batchEmbedContent(
    contents: any[],
    workspaceId: string
  ): Promise<void> {
    try {
      const index = this.client.index(this.indexName);

      const vectors = await Promise.all(
        contents.map(async (content) => {
          const textToEmbed = this.buildEmbeddingText(content);
          const embedding = await this.generateEmbedding(textToEmbed);

          return {
            id: content.id,
            values: embedding,
            metadata: {
              contentId: content.id,
              workspaceId,
              platform: content.platform || 'instagram',
              caption: content.content?.caption || '',
              hook: content.content?.hook || '',
              hashtags: content.content?.hashtags || [],
              createdAt: content.createdAt?.toISOString() || new Date().toISOString(),
              status: content.status || 'draft',
              engagement: 0,
            },
          };
        })
      );

      // Batch upsert (Pinecone supports up to 1000 vectors per request)
      const batchSize = 100;
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        await index.upsert(batch);
      }

      console.log(`Embedded ${contents.length} content items to Pinecone`);
    } catch (error) {
      console.error('Failed to batch embed content:', error);
      throw error;
    }
  }

  /**
   * Search for similar content
   */
  async searchSimilarContent(
    queryText: string,
    workspaceId: string,
    topK = 10,
    filters?: Record<string, any>
  ): Promise<SearchResult[]> {
    try {
      const index = this.client.index(this.indexName);

      // Generate embedding for query
      const queryEmbedding = await this.generateEmbedding(queryText);

      // Build filter
      const filter: any = { workspaceId };
      if (filters) {
        Object.assign(filter, filters);
      }

      // Search
      const results = await index.query({
        vector: queryEmbedding,
        topK,
        filter,
        includeMetadata: true,
      });

      return results.matches.map((match) => ({
        id: match.id,
        score: match.score || 0,
        metadata: match.metadata || {},
      }));
    } catch (error) {
      console.error('Failed to search similar content:', error);
      throw error;
    }
  }

  /**
   * Find duplicate or very similar content
   */
  async detectDuplicates(
    content: any,
    workspaceId: string,
    similarityThreshold = 0.95
  ): Promise<SearchResult[]> {
    try {
      const textToEmbed = this.buildEmbeddingText(content);
      const results = await this.searchSimilarContent(textToEmbed, workspaceId, 5);

      // Filter by similarity threshold and exclude self
      return results.filter(
        (result) =>
          result.score >= similarityThreshold &&
          result.metadata.contentId !== content.id
      );
    } catch (error) {
      console.error('Failed to detect duplicates:', error);
      throw error;
    }
  }

  /**
   * Get content recommendations based on performance
   */
  async getContentRecommendations(
    topic: string,
    workspaceId: string,
    topK = 5
  ): Promise<SearchResult[]> {
    try {
      const results = await this.searchSimilarContent(topic, workspaceId, topK * 2, {
        status: 'published',
      });

      // Sort by engagement and return top performers
      const sorted = results.sort(
        (a, b) => (b.metadata.engagement || 0) - (a.metadata.engagement || 0)
      );

      return sorted.slice(0, topK);
    } catch (error) {
      console.error('Failed to get content recommendations:', error);
      throw error;
    }
  }

  /**
   * Update content metadata (e.g., engagement metrics)
   */
  async updateContentMetadata(
    contentId: string,
    metadata: Partial<ContentEmbedding['metadata']>
  ): Promise<void> {
    try {
      const index = this.client.index(this.indexName);

      // Fetch existing vector
      const fetchResult = await index.fetch([contentId]);
      const existingVector = fetchResult.records[contentId];

      if (!existingVector) {
        throw new Error(`Content ${contentId} not found in Pinecone`);
      }

      // Update with merged metadata
      await index.upsert([
        {
          id: contentId,
          values: existingVector.values,
          metadata: {
            ...existingVector.metadata,
            ...metadata,
          },
        },
      ]);

      console.log(`Updated metadata for content ${contentId}`);
    } catch (error) {
      console.error('Failed to update content metadata:', error);
      throw error;
    }
  }

  /**
   * Delete content from Pinecone
   */
  async deleteContent(contentId: string): Promise<void> {
    try {
      const index = this.client.index(this.indexName);
      await index.deleteOne(contentId);
      console.log(`Deleted content ${contentId} from Pinecone`);
    } catch (error) {
      console.error('Failed to delete content:', error);
      throw error;
    }
  }

  /**
   * Delete all content for a workspace
   */
  async deleteWorkspaceContent(workspaceId: string): Promise<void> {
    try {
      const index = this.client.index(this.indexName);
      await index.deleteMany({ workspaceId });
      console.log(`Deleted all content for workspace ${workspaceId}`);
    } catch (error) {
      console.error('Failed to delete workspace content:', error);
      throw error;
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats(): Promise<any> {
    try {
      const index = this.client.index(this.indexName);
      const stats = await index.describeIndexStats();
      return stats;
    } catch (error) {
      console.error('Failed to get index stats:', error);
      throw error;
    }
  }

  /**
   * Build text for embedding from content object
   */
  private buildEmbeddingText(content: any): string {
    const parts: string[] = [];

    const contentData = content.content || content;

    if (contentData.hook) {
      parts.push(contentData.hook);
    }

    if (contentData.caption) {
      parts.push(contentData.caption);
    }

    if (contentData.cta) {
      parts.push(contentData.cta);
    }

    if (contentData.hashtags && Array.isArray(contentData.hashtags)) {
      parts.push(contentData.hashtags.join(' '));
    }

    return parts.join('\n\n');
  }

  /**
   * Analyze content trends across workspace
   */
  async analyzeContentTrends(workspaceId: string): Promise<any> {
    try {
      const index = this.client.index(this.indexName);

      // Get all content for workspace
      const stats = await index.describeIndexStats();

      // This is a simplified version - in production you'd want more sophisticated analysis
      return {
        totalContent: stats.totalRecordCount || 0,
        workspaceId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to analyze content trends:', error);
      throw error;
    }
  }

  isConfigured(): boolean {
    return !!(this.config.apiKey && this.config.indexName);
  }
}

export const pineconeService = new PineconeService();
