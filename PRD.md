# PRD: AI Content Automation Workflow System

## Project Overview
Build a code-based AI agent workflow system that automates content creation by scraping Instagram, analyzing trends, generating ideas, and producing publish-ready content with human-in-the-loop approval.

## Technical Stack
- **Frontend**: Next.js 14+ (App Router), TailwindCSS, shadcn/ui
- **Backend**: Next.js API Routes with tRPC
- **Database**: PostgreSQL (Supabase), Prisma ORM
- **Vector DB**: Pinecone for semantic search
- **Queue**: BullMQ with Redis for background jobs
- **AI Orchestration**: LangChain.js
- **APIs**: Apify (scraping), OpenRouter (LLMs)

## Core Workflow Implementation

### 1. Project Structure
```
src/
├── app/
│   ├── api/
│   │   ├── trpc/[trpc]/route.ts
│   │   └── webhooks/
│   │       ├── apify/route.ts
│   │       └── slack/route.ts
│   ├── dashboard/
│   │   ├── page.tsx
│   │   ├── brand-voice/
│   │   │   ├── page.tsx
│   │   │   └── components/
│   │   │       ├── VoiceSamples.tsx
│   │   │       └── VoiceAnalyzer.tsx
│   │   └── workflows/
│   │       ├── [id]/page.tsx
│   │       └── new/page.tsx
│   └── layout.tsx
├── lib/
│   ├── agents/
│   │   ├── content-analyzer.ts
│   │   ├── brand-voice-analyzer.ts
│   │   ├── idea-generator.ts
│   │   ├── research-agent.ts
│   │   ├── content-writer.ts
│   │   └── image-generator.ts
│   ├── scrapers/
│   │   ├── instagram-scraper.ts
│   │   └── apify-client.ts
│   ├── workflow/
│   │   ├── workflow-engine.ts
│   │   ├── workflow-executor.ts
│   │   └── workflow-types.ts
│   ├── integrations/
│   │   ├── google-docs.ts
│   │   ├── slack.ts
│   │   └── social-publishers.ts
│   ├── brand-voice/
│   │   ├── voice-learning.ts
│   │   └── voice-matcher.ts
│   └── db/
│       ├── schema.prisma
│       └── client.ts
├── server/
│   ├── routers/
│   │   ├── workflow.ts
│   │   ├── content.ts
│   │   ├── brand-voice.ts
│   │   └── analytics.ts
│   └── queue/
│       ├── workers/
│       │   ├── scraping.worker.ts
│       │   ├── ai-processing.worker.ts
│       │   └── publishing.worker.ts
│       └── index.ts
└── types/
    └── workflow.types.ts
```

### 2. Database Schema
```prisma
model User {
  id            String      @id @default(cuid())
  email         String      @unique
  name          String?
  workspaces    Workspace[]
  createdAt     DateTime    @default(now())
}

model Workspace {
  id            String      @id @default(cuid())
  name          String
  userId        String
  user          User        @relation(fields: [userId], references: [id])
  brandVoice    Json?       // Analyzed voice characteristics
  workflows     Workflow[]
  contents      Content[]
  voiceSamples  BrandVoiceSample[]
  voiceEdits    ContentEdit[]
  createdAt     DateTime    @default(now())
}

model Workflow {
  id            String      @id @default(cuid())
  name          String
  workspaceId   String
  workspace     Workspace   @relation(fields: [workspaceId], references: [id])
  config        Json        // Stores workflow configuration
  status        String      @default("active")
  runs          WorkflowRun[]
  createdAt     DateTime    @default(now())
}

model WorkflowRun {
  id            String      @id @default(cuid())
  workflowId    String
  workflow      Workflow    @relation(fields: [workflowId], references: [id])
  topic         String
  brandVoiceSamples Json?   // User-provided samples for this run
  status        String      // pending, scraping, analyzing, generating, reviewing, published, failed
  scrapedData   Json?
  analysisData  Json?
  generatedIdeas Json?
  finalContent  Json?
  metrics       Json?
  startedAt     DateTime    @default(now())
  completedAt   DateTime?
  contents      Content[]
}

model Content {
  id            String      @id @default(cuid())
  workspaceId   String
  workspace     Workspace   @relation(fields: [workspaceId], references: [id])
  runId         String?
  run           WorkflowRun? @relation(fields: [runId], references: [id])
  platform      String      // instagram, linkedin, twitter
  type          String      // post, reel, story
  content       Json        // Stores all content data
  originalContent Json?     // Original AI-generated content before edits
  status        String      // draft, reviewing, approved, published
  performance   Json?       // Engagement metrics
  edits         ContentEdit[]
  publishedAt   DateTime?
  createdAt     DateTime    @default(now())
}

model BrandVoiceSample {
  id            String      @id @default(cuid())
  workspaceId   String
  workspace     Workspace   @relation(fields: [workspaceId], references: [id])
  content       String      // The sample content text
  source        String      // 'user_provided', 'approved_content', 'external_url'
  metadata      Json?       // Additional context (platform, performance metrics, etc.)
  createdAt     DateTime    @default(now())
}

model ContentEdit {
  id            String      @id @default(cuid())
  contentId     String
  content       Content     @relation(fields: [contentId], references: [id])
  workspaceId   String
  workspace     Workspace   @relation(fields: [workspaceId], references: [id])
  fieldEdited   String      // 'caption', 'hook', 'hashtags', 'cta'
  originalText  String
  editedText    String
  editReason    String?     // Optional user feedback on why they made the edit
  createdAt     DateTime    @default(now())
}
```

### 3. Workflow Engine Implementation

```typescript
// lib/workflow/workflow-engine.ts
import { Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';

export class WorkflowEngine {
  private scraperQueue: Queue;
  private aiQueue: Queue;
  private publishQueue: Queue;
  private prisma: PrismaClient;

  constructor() {
    this.scraperQueue = new Queue('scraping');
    this.aiQueue = new Queue('ai-processing');
    this.publishQueue = new Queue('publishing');
    this.prisma = new PrismaClient();
  }

  async executeWorkflow(workflowId: string, topic: string, brandVoiceSamples?: string[]) {
    // Create workflow run record
    const run = await this.prisma.workflowRun.create({
      data: {
        workflowId,
        topic,
        brandVoiceSamples: brandVoiceSamples ? { samples: brandVoiceSamples } : null,
        status: 'pending'
      }
    });

    // Queue the scraping job
    await this.scraperQueue.add('scrape-instagram', {
      runId: run.id,
      topic,
      config: {
        count: 100,
        minEngagement: 1000,
        timeframe: '7d'
      }
    });

    return run.id;
  }
}
```

### 4. AI Agent Implementations

```typescript
// lib/agents/idea-generator.ts
import { OpenRouter } from '../integrations/openrouter';

export class IdeaGeneratorAgent {
  private client: OpenRouter;
  
  constructor(apiKey: string) {
    this.client = new OpenRouter(apiKey);
  }

  async generateIdeas(scrapedContent: any, brandVoice?: any) {
    const prompt = `
      You are a content strategist analyzing trending content.
      
      Based on the following top-performing Instagram content:
      ${JSON.stringify(scrapedContent)}
      
      Brand Voice Guidelines:
      ${brandVoice ? JSON.stringify(brandVoice) : 'None specified'}
      
      Generate 10 unique content ideas that:
      1. Build on proven engagement patterns
      2. Offer fresh angles not seen in the scraped content
      3. Include scroll-stopping hooks
      4. Specify optimal content format (reel, carousel, story)
      5. Include trending audio suggestions if applicable
      
      Format as JSON array with: title, hook, angle, format, description
    `;

    return await this.client.complete({
      model: 'claude-3-5-sonnet',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    });
  }
}

// lib/agents/content-writer.ts
export class ContentWriterAgent {
  private client: OpenRouter;

  async writeContent(idea: any, research: any, brandVoice: any) {
    const prompt = `
      Create Instagram content based on:

      Idea: ${JSON.stringify(idea)}
      Supporting Research: ${JSON.stringify(research)}
      Brand Voice: ${JSON.stringify(brandVoice)}

      Generate:
      1. Caption (125-150 words)
      2. Hook (first line that stops scrolling)
      3. 5-7 relevant hashtags
      4. Call-to-action
      5. Story narrative if video content

      Rules:
      - No fluff or corporate speak
      - Direct, conversational tone
      - Include specific data points from research
      - Create emotional connection
      - End with clear CTA

      Format as JSON
    `;

    return await this.client.complete({
      model: 'claude-3-5-sonnet',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6
    });
  }
}

// lib/agents/brand-voice-analyzer.ts
export class BrandVoiceAnalyzerAgent {
  private client: OpenRouter;

  constructor(apiKey: string) {
    this.client = new OpenRouter(apiKey);
  }

  async analyzeBrandVoice(samples: string[]) {
    const prompt = `
      Analyze these content samples to extract brand voice characteristics:

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

      Return as structured JSON for use in content generation.
    `;

    return await this.client.complete({
      model: 'claude-3-5-sonnet',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    });
  }

  async learnFromEdit(originalContent: string, editedContent: string, fieldEdited: string) {
    const prompt = `
      Analyze this content edit to understand brand voice preferences:

      Field edited: ${fieldEdited}
      Original: ${originalContent}
      Edited: ${editedContent}

      Extract:
      1. What changed and why (tone, style, vocabulary)
      2. Specific preferences shown by this edit
      3. Rules to apply in future content generation

      Return as JSON with specific learnings.
    `;

    return await this.client.complete({
      model: 'claude-3-5-sonnet',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2
    });
  }
}
```

### 5. Scraping Integration

```typescript
// lib/scrapers/instagram-scraper.ts
import { ApifyClient } from 'apify-client';

export class InstagramScraper {
  private client: ApifyClient;
  
  constructor(token: string) {
    this.client = new ApifyClient({ token });
  }

  async scrapeByTopic(topic: string, config: any) {
    const input = {
      searchType: 'hashtag',
      searchLimit: config.count || 100,
      hashtags: [topic],
      resultsType: 'posts',
      resultsLimit: config.count || 100,
      shouldDownloadVideos: false,
      shouldDownloadImages: false,
      extendOutputFunction: `
        async ({ data, item, page }) => {
          return {
            ...item,
            engagement: item.likesCount + item.commentsCount,
            engagementRate: ((item.likesCount + item.commentsCount) / item.followersCount) * 100
          };
        }
      `
    };

    const run = await this.client.actor('apify/instagram-scraper').call(input);
    const { items } = await this.client.dataset(run.defaultDatasetId).listItems();
    
    // Filter by minimum engagement
    return items
      .filter(item => item.engagement >= config.minEngagement)
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, config.count);
  }

  async analyzeContent(posts: any[]) {
    return {
      hooks: this.extractHooks(posts),
      hashtags: this.extractTopHashtags(posts),
      contentTypes: this.categorizeContent(posts),
      postingTimes: this.analyzePostingTimes(posts),
      avgEngagement: this.calculateAvgEngagement(posts)
    };
  }

  private extractHooks(posts: any[]) {
    // Extract first lines from captions
    return posts.map(p => p.caption?.split('\n')[0]).filter(Boolean);
  }

  private extractTopHashtags(posts: any[]) {
    const hashtags: Record<string, number> = {};
    posts.forEach(post => {
      post.hashtags?.forEach((tag: string) => {
        hashtags[tag] = (hashtags[tag] || 0) + 1;
      });
    });
    return Object.entries(hashtags)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 30)
      .map(([tag]) => tag);
  }

  private categorizeContent(posts: any[]) {
    // Categorize by post type
    return {
      reels: posts.filter(p => p.type === 'Video').length,
      carousels: posts.filter(p => p.type === 'Sidecar').length,
      images: posts.filter(p => p.type === 'Image').length
    };
  }

  private analyzePostingTimes(posts: any[]) {
    // Analyze best posting times
    // Implementation here
  }

  private calculateAvgEngagement(posts: any[]) {
    const total = posts.reduce((sum, p) => sum + p.engagement, 0);
    return total / posts.length;
  }
}
```

### 6. Queue Workers

```typescript
// server/queue/workers/scraping.worker.ts
import { Worker } from 'bullmq';
import { InstagramScraper } from '../../../lib/scrapers/instagram-scraper';
import { prisma } from '../../../lib/db/client';

export const scrapingWorker = new Worker(
  'scraping',
  async (job) => {
    const { runId, topic, config } = job.data;
    
    // Update status
    await prisma.workflowRun.update({
      where: { id: runId },
      data: { status: 'scraping' }
    });

    // Scrape Instagram
    const scraper = new InstagramScraper(process.env.APIFY_TOKEN!);
    const posts = await scraper.scrapeByTopic(topic, config);
    const analysis = await scraper.analyzeContent(posts);

    // Save scraped data
    await prisma.workflowRun.update({
      where: { id: runId },
      data: {
        scrapedData: { posts, analysis },
        status: 'analyzing'
      }
    });

    // Queue AI processing
    await aiQueue.add('process-content', {
      runId,
      scrapedData: { posts, analysis }
    });

    return { success: true, postsScraped: posts.length };
  },
  {
    connection: redisConnection,
    concurrency: 5
  }
);

// server/queue/workers/ai-processing.worker.ts
export const aiProcessingWorker = new Worker(
  'ai-processing',
  async (job) => {
    const { runId, scrapedData } = job.data;

    // Get workspace config for brand voice
    const run = await prisma.workflowRun.findUnique({
      where: { id: runId },
      include: { workflow: { include: { workspace: true } } }
    });

    // Analyze brand voice if samples provided
    let brandVoice = run?.workflow.workspace.brandVoice;
    if (run?.brandVoiceSamples?.samples) {
      const voiceAnalyzer = new BrandVoiceAnalyzerAgent(process.env.OPENROUTER_API_KEY!);
      const analyzedVoice = await voiceAnalyzer.analyzeBrandVoice(run.brandVoiceSamples.samples);

      // Merge with existing brand voice or use new analysis
      brandVoice = brandVoice ? { ...brandVoice, ...analyzedVoice } : analyzedVoice;

      // Save analyzed voice back to workspace
      await prisma.workspace.update({
        where: { id: run.workflow.workspaceId },
        data: { brandVoice }
      });

      // Store samples in database for future reference
      await Promise.all(
        run.brandVoiceSamples.samples.map(sample =>
          prisma.brandVoiceSample.create({
            data: {
              workspaceId: run.workflow.workspaceId,
              content: sample,
              source: 'user_provided',
              metadata: { runId }
            }
          })
        )
      );
    }

    // Generate ideas
    const ideaGenerator = new IdeaGeneratorAgent(process.env.OPENROUTER_API_KEY!);
    const ideas = await ideaGenerator.generateIdeas(
      scrapedData,
      brandVoice
    );

    // Research each idea
    const researchAgent = new ResearchAgent(process.env.OPENROUTER_API_KEY!);
    const research = await researchAgent.research(ideas);

    // Generate content for top ideas
    const contentWriter = new ContentWriterAgent(process.env.OPENROUTER_API_KEY!);
    const contents = await Promise.all(
      ideas.slice(0, 5).map(idea =>
        contentWriter.writeContent(
          idea,
          research,
          brandVoice
        )
      )
    );

    // Generate images
    const imageGenerator = new ImageGeneratorAgent(process.env.OPENROUTER_API_KEY!);
    const images = await Promise.all(
      contents.map(content =>
        imageGenerator.generate(content.description)
      )
    );

    // Save generated content with original for tracking edits
    const savedContents = await Promise.all(
      contents.map((content, i) =>
        prisma.content.create({
          data: {
            workspaceId: run!.workflow.workspaceId,
            runId,
            platform: 'instagram',
            type: content.format,
            content: {
              ...content,
              imageUrl: images[i]
            },
            originalContent: {
              ...content,
              imageUrl: images[i]
            },
            status: 'reviewing'
          }
        })
      )
    );

    // Send for approval
    await sendToSlack(savedContents, run!.workflow.workspace);

    await prisma.workflowRun.update({
      where: { id: runId },
      data: {
        generatedIdeas: ideas,
        finalContent: contents,
        status: 'reviewing'
      }
    });

    return { success: true, contentsGenerated: contents.length };
  }
);
```

### 7. API Routes

```typescript
// server/routers/workflow.ts
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { WorkflowEngine } from '../../lib/workflow/workflow-engine';

export const workflowRouter = router({
  create: protectedProcedure
    .input(z.object({
      name: z.string(),
      workspaceId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      return await ctx.prisma.workflow.create({
        data: {
          name: input.name,
          workspaceId: input.workspaceId,
          config: {
            scrapingConfig: {
              platform: 'instagram',
              count: 100,
              minEngagement: 1000
            },
            aiConfig: {
              ideaCount: 10,
              contentVariations: 3
            }
          }
        }
      });
    }),

  run: protectedProcedure
    .input(z.object({
      workflowId: z.string(),
      topic: z.string(),
      brandVoiceSamples: z.array(z.string()).optional()
    }))
    .mutation(async ({ input }) => {
      const engine = new WorkflowEngine();
      const runId = await engine.executeWorkflow(
        input.workflowId,
        input.topic,
        input.brandVoiceSamples
      );
      return { runId };
    }),

  getRunStatus: protectedProcedure
    .input(z.object({
      runId: z.string()
    }))
    .query(async ({ input, ctx }) => {
      return await ctx.prisma.workflowRun.findUnique({
        where: { id: input.runId },
        include: {
          contents: true
        }
      });
    })
});

// server/routers/brand-voice.ts
export const brandVoiceRouter = router({
  saveSample: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
      content: z.string(),
      source: z.enum(['user_provided', 'approved_content', 'external_url']),
      metadata: z.record(z.any()).optional()
    }))
    .mutation(async ({ input, ctx }) => {
      return await ctx.prisma.brandVoiceSample.create({
        data: input
      });
    }),

  analyzeSamples: protectedProcedure
    .input(z.object({
      workspaceId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      // Get all samples for workspace
      const samples = await ctx.prisma.brandVoiceSample.findMany({
        where: { workspaceId: input.workspaceId },
        orderBy: { createdAt: 'desc' },
        take: 20
      });

      if (samples.length === 0) {
        throw new Error('No brand voice samples found');
      }

      // Analyze with AI
      const analyzer = new BrandVoiceAnalyzerAgent(process.env.OPENROUTER_API_KEY!);
      const brandVoice = await analyzer.analyzeBrandVoice(
        samples.map(s => s.content)
      );

      // Update workspace
      await ctx.prisma.workspace.update({
        where: { id: input.workspaceId },
        data: { brandVoice }
      });

      return brandVoice;
    }),

  trackEdit: protectedProcedure
    .input(z.object({
      contentId: z.string(),
      fieldEdited: z.string(),
      originalText: z.string(),
      editedText: z.string(),
      editReason: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      // Get content and workspace
      const content = await ctx.prisma.content.findUnique({
        where: { id: input.contentId },
        include: { workspace: true }
      });

      if (!content) throw new Error('Content not found');

      // Save edit
      const edit = await ctx.prisma.contentEdit.create({
        data: {
          ...input,
          workspaceId: content.workspaceId
        }
      });

      // Learn from edit
      const analyzer = new BrandVoiceAnalyzerAgent(process.env.OPENROUTER_API_KEY!);
      const learnings = await analyzer.learnFromEdit(
        input.originalText,
        input.editedText,
        input.fieldEdited
      );

      // Update workspace brand voice with learnings
      const currentVoice = content.workspace.brandVoice || {};
      const updatedVoice = {
        ...currentVoice,
        learnings: [
          ...(currentVoice.learnings || []),
          { ...learnings, editId: edit.id, timestamp: new Date() }
        ]
      };

      await ctx.prisma.workspace.update({
        where: { id: content.workspaceId },
        data: { brandVoice: updatedVoice }
      });

      return edit;
    })
});
```

### 8. Frontend Components

```typescript
// app/dashboard/workflows/new/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';

export default function NewWorkflowPage() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [brandVoiceMethod, setBrandVoiceMethod] = useState<'none' | 'samples' | 'existing'>('none');
  const [brandVoiceSamples, setBrandVoiceSamples] = useState<string[]>([]);
  const [currentSample, setCurrentSample] = useState('');

  const createWorkflow = trpc.workflow.create.useMutation();
  const runWorkflow = trpc.workflow.run.useMutation();
  const saveBrandVoice = trpc.brandVoice.saveSample.useMutation();

  const addBrandVoiceSample = () => {
    if (currentSample.trim() && currentSample.length > 50) {
      setBrandVoiceSamples([...brandVoiceSamples, currentSample.trim()]);
      setCurrentSample('');
    } else {
      toast.error('Sample must be at least 50 characters');
    }
  };

  const removeSample = (index: number) => {
    setBrandVoiceSamples(brandVoiceSamples.filter((_, i) => i !== index));
  };

  const handleRunWorkflow = async () => {
    if (!topic) {
      toast.error('Please enter a topic');
      return;
    }

    if (brandVoiceMethod === 'samples' && brandVoiceSamples.length < 3) {
      toast.error('Please provide at least 3 brand voice samples for better results');
      return;
    }

    setIsRunning(true);
    try {
      // Create workflow
      const workflow = await createWorkflow.mutateAsync({
        name: `Content for: ${topic}`,
        workspaceId: 'current-workspace-id' // Get from context
      });

      // Save brand voice samples if provided
      if (brandVoiceMethod === 'samples' && brandVoiceSamples.length > 0) {
        await Promise.all(
          brandVoiceSamples.map(sample =>
            saveBrandVoice.mutateAsync({
              workspaceId: 'current-workspace-id',
              content: sample,
              source: 'user_provided',
              metadata: { workflowId: workflow.id }
            })
          )
        );
      }

      // Run workflow with samples
      const { runId } = await runWorkflow.mutateAsync({
        workflowId: workflow.id,
        topic,
        brandVoiceSamples: brandVoiceMethod === 'samples' ? brandVoiceSamples : undefined
      });

      toast.success('Workflow started! Redirecting to results...');
      router.push(`/dashboard/workflows/${runId}`);
    } catch (error) {
      toast.error('Failed to start workflow');
      console.error(error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="container max-w-4xl py-8">
      <Card>
        <CardHeader>
          <CardTitle>Create Content Workflow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="topic">Topic or Keyword</Label>
            <Input
              id="topic"
              placeholder="e.g., productivity tips, fitness motivation"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={isRunning}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Enter a topic to research and generate content about
            </p>
          </div>

          {/* Brand Voice Section */}
          <div className="space-y-4">
            <Label>Brand Voice Training (Optional)</Label>
            <Tabs value={brandVoiceMethod} onValueChange={(v) => setBrandVoiceMethod(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="none">Skip</TabsTrigger>
                <TabsTrigger value="samples">Provide Samples</TabsTrigger>
                <TabsTrigger value="existing">Use Existing</TabsTrigger>
              </TabsList>

              <TabsContent value="samples" className="space-y-4 mt-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Paste 3-5 examples of your best content. The AI will analyze these to match your writing style.
                  </p>

                  {brandVoiceSamples.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {brandVoiceSamples.map((sample, index) => (
                        <div key={index} className="p-3 bg-muted rounded-lg relative">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6"
                            onClick={() => removeSample(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <p className="text-sm pr-8 line-clamp-2">{sample}</p>
                          <Badge variant="secondary" className="mt-2">
                            Sample {index + 1}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  <Textarea
                    placeholder="Paste your content sample here..."
                    value={currentSample}
                    onChange={(e) => setCurrentSample(e.target.value)}
                    className="min-h-[100px]"
                  />

                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-muted-foreground">
                      {currentSample.length} characters
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={addBrandVoiceSample}
                      disabled={currentSample.length < 50}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Sample ({brandVoiceSamples.length}/5)
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="existing" className="mt-4">
                <p className="text-sm text-muted-foreground">
                  Your existing brand voice profile will be used automatically.
                </p>
              </TabsContent>

              <TabsContent value="none" className="mt-4">
                <p className="text-sm text-muted-foreground">
                  Content will be generated with a generic professional tone.
                </p>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Workflow Steps:</h3>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Scrape top 100 Instagram posts about "{topic || 'your topic'}"</li>
              {brandVoiceMethod === 'samples' && (
                <li className="text-primary">Analyze your brand voice from samples</li>
              )}
              <li>Analyze engagement patterns and extract trends</li>
              <li>Generate 10 content ideas based on data</li>
              <li>Research supporting facts for each idea</li>
              <li>Create 5 complete posts with AI {brandVoiceMethod !== 'none' && '(in your voice)'}</li>
              <li>Generate images for each post</li>
              <li>Send for your approval via Slack</li>
            </ol>
          </div>

          <Button
            onClick={handleRunWorkflow}
            disabled={isRunning}
            className="w-full"
          >
            {isRunning ? 'Running Workflow...' : 'Start Workflow'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// app/dashboard/workflows/[id]/page.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, Edit3, XCircle, Sparkles } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';

export default function WorkflowRunPage({ params }: { params: { id: string } }) {
  const { data: run, isLoading } = trpc.workflow.getRunStatus.useQuery({
    runId: params.id
  }, {
    refetchInterval: 2000 // Poll every 2 seconds
  });

  const [editingContent, setEditingContent] = useState<any>(null);
  const [editedFields, setEditedFields] = useState<Record<string, string>>({});

  const trackEdit = trpc.brandVoice.trackEdit.useMutation();
  const approveContent = trpc.content.approve.useMutation();

  const handleEdit = (content: any) => {
    setEditingContent(content);
    setEditedFields({
      caption: content.content.caption,
      hook: content.content.hook,
      hashtags: content.content.hashtags.join(' '),
      cta: content.content.cta
    });
  };

  const saveEdit = async (field: string) => {
    if (!editingContent || !editingContent.originalContent) return;

    const originalValue = editingContent.originalContent[field];
    const newValue = editedFields[field];

    if (originalValue !== newValue) {
      // Track the edit for learning
      await trackEdit.mutateAsync({
        contentId: editingContent.id,
        fieldEdited: field,
        originalText: originalValue,
        editedText: newValue,
        editReason: 'User preference' // Could add a dialog for this
      });

      toast.success('Edit saved and AI will learn from this change');
    }
  };

  const handleApprove = async (contentId: string, wasEdited: boolean) => {
    await approveContent.mutateAsync({ contentId });

    if (!wasEdited) {
      // Mark as perfect example for brand voice
      const content = run?.contents.find(c => c.id === contentId);
      if (content) {
        await trpc.brandVoice.saveSample.mutateAsync({
          workspaceId: content.workspaceId,
          content: content.content.caption,
          source: 'approved_content',
          metadata: {
            contentId,
            platform: content.platform,
            perfectMatch: true
          }
        });
      }
    }

    toast.success('Content approved!');
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="container py-8">
      <WorkflowProgress status={run?.status} />

      {run?.status === 'reviewing' && (
        <div className="grid gap-6 mt-8">
          {run.contents.map((content) => (
            <Card key={content.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Content #{run.contents.indexOf(content) + 1}</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(content)}
                    >
                      <Edit3 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleApprove(content.id, false)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleReject(content.id)}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-1">Hook</h4>
                    <p className="text-sm">{content.content.hook}</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Caption</h4>
                    <p className="text-sm whitespace-pre-wrap">{content.content.caption}</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Hashtags</h4>
                    <p className="text-sm text-muted-foreground">
                      {content.content.hashtags.join(' ')}
                    </p>
                  </div>
                  {content.content.imageUrl && (
                    <img
                      src={content.content.imageUrl}
                      alt="Generated content"
                      className="rounded-lg max-w-md"
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingContent} onOpenChange={() => setEditingContent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Edit Content (AI will learn from your changes)
            </DialogTitle>
          </DialogHeader>

          {editingContent && (
            <div className="space-y-4">
              <div>
                <Label>Hook</Label>
                <Textarea
                  value={editedFields.hook}
                  onChange={(e) => setEditedFields({ ...editedFields, hook: e.target.value })}
                  onBlur={() => saveEdit('hook')}
                  className="mt-1"
                />
                {editingContent.originalContent?.hook !== editedFields.hook && (
                  <p className="text-xs text-amber-600 mt-1">
                    AI will learn from this edit
                  </p>
                )}
              </div>

              <div>
                <Label>Caption</Label>
                <Textarea
                  value={editedFields.caption}
                  onChange={(e) => setEditedFields({ ...editedFields, caption: e.target.value })}
                  onBlur={() => saveEdit('caption')}
                  className="mt-1 min-h-[150px]"
                />
              </div>

              <div>
                <Label>Hashtags</Label>
                <Textarea
                  value={editedFields.hashtags}
                  onChange={(e) => setEditedFields({ ...editedFields, hashtags: e.target.value })}
                  onBlur={() => saveEdit('hashtags')}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Call-to-Action</Label>
                <Textarea
                  value={editedFields.cta}
                  onChange={(e) => setEditedFields({ ...editedFields, cta: e.target.value })}
                  onBlur={() => saveEdit('cta')}
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => setEditingContent(null)}>
                  Cancel
                </Button>
                <Button onClick={() => {
                  handleApprove(editingContent.id, true);
                  setEditingContent(null);
                }}>
                  Save & Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

### 9. Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# APIs
APIFY_TOKEN=your_apify_token
OPENROUTER_API_KEY=your_openrouter_key

# Redis
REDIS_URL=redis://localhost:6379

# Integrations
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
SLACK_APP_TOKEN=xoxb-...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 10. Implementation Instructions

1. **Setup Phase**
   - Initialize Next.js project with TypeScript
   - Install dependencies: `npm install @trpc/server @trpc/client bullmq apify-client @prisma/client zod`
   - Setup Prisma with the provided schema
   - Configure Redis for BullMQ

2. **Core Development**
   - Implement the workflow engine
   - Create all AI agents with OpenRouter integration
   - Setup Instagram scraper with Apify
   - Implement queue workers for background processing
   - Create tRPC routers for API

3. **Frontend Development**
   - Build workflow creation UI
   - Implement real-time status updates
   - Create content review interface
   - Add approval/editing workflows

4. **Integration Phase**
   - Connect Slack for notifications
   - Setup Google Docs creation
   - Implement social media publishing
   - Add webhook handlers

5. **Testing & Deployment**
   - Test full workflow end-to-end
   - Optimize queue processing
   - Setup error handling and retries
   - Deploy to production

## Success Criteria
- Complete workflow executes in under 5 minutes
- 80% of generated content requires no editing
- Engagement rates improve by 2x compared to manual content
- System handles 100+ concurrent workflows
- All API rate limits are respected with proper queuing

## Notes for Implementation
- Start with a single workflow path (Instagram → Content)
- Use placeholder data if API keys aren't ready
- Implement comprehensive error handling
- Add detailed logging for debugging
- Consider implementing a dry-run mode for testing

This PRD provides everything needed to build the complete AI content automation workflow using code instead of n8n, with all the same capabilities from the transcript but implemented as a scalable web application.