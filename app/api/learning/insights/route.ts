import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/src/lib/auth';
import { prisma } from '@/src/lib/db/client';


function generateLearningInsights(edits: any[]) {
  if (edits.length === 0) return [];

  const insights = [];

  // Analyze caption editing patterns
  const captionEdits = edits.filter(e => e.fieldEdited === 'caption');
  if (captionEdits.length >= 3) {
    const avgOriginalLength = captionEdits.reduce((sum, e) => sum + e.originalText.length, 0) / captionEdits.length;
    const avgEditedLength = captionEdits.reduce((sum, e) => sum + e.editedText.length, 0) / captionEdits.length;

    if (avgEditedLength > avgOriginalLength * 1.2) {
      insights.push({
        category: 'Caption Length Preference',
        insight: 'You consistently expand captions, preferring more detailed content.',
        confidence: 0.8,
        examples: captionEdits.slice(0, 2).map(e => `"${e.originalText.slice(0, 50)}..." → "${e.editedText.slice(0, 50)}..."`),
        frequency: captionEdits.length
      });
    } else if (avgEditedLength < avgOriginalLength * 0.8) {
      insights.push({
        category: 'Caption Length Preference',
        insight: 'You prefer shorter, more concise captions.',
        confidence: 0.8,
        examples: captionEdits.slice(0, 2).map(e => `"${e.originalText.slice(0, 50)}..." → "${e.editedText.slice(0, 50)}..."`),
        frequency: captionEdits.length
      });
    }
  }

  // Analyze hook editing patterns
  const hookEdits = edits.filter(e => e.fieldEdited === 'hook');
  if (hookEdits.length >= 2) {
    const questionHooks = hookEdits.filter(e => e.editedText.includes('?')).length;
    if (questionHooks > hookEdits.length * 0.6) {
      insights.push({
        category: 'Hook Style Preference',
        insight: 'You prefer question-based hooks to engage your audience.',
        confidence: 0.7,
        examples: hookEdits.filter(e => e.editedText.includes('?')).slice(0, 2).map(e => `"${e.editedText}"`),
        frequency: questionHooks
      });
    }
  }

  // Analyze hashtag editing patterns
  const hashtagEdits = edits.filter(e => e.fieldEdited === 'hashtags');
  if (hashtagEdits.length >= 2) {
    const avgOriginalHashtags = hashtagEdits.reduce((sum, e) => {
      return sum + (e.originalText.match(/#\w+/g) || []).length;
    }, 0) / hashtagEdits.length;

    const avgEditedHashtags = hashtagEdits.reduce((sum, e) => {
      return sum + (e.editedText.match(/#\w+/g) || []).length;
    }, 0) / hashtagEdits.length;

    if (avgEditedHashtags > avgOriginalHashtags * 1.2) {
      insights.push({
        category: 'Hashtag Strategy',
        insight: 'You tend to add more hashtags for better discoverability.',
        confidence: 0.75,
        examples: hashtagEdits.slice(0, 2).map(e => `Added ${(e.editedText.match(/#\w+/g) || []).length - (e.originalText.match(/#\w+/g) || []).length} hashtags`),
        frequency: hashtagEdits.length
      });
    }
  }

  // Analyze CTA editing patterns
  const ctaEdits = edits.filter(e => e.fieldEdited === 'cta');
  if (ctaEdits.length >= 2) {
    const urgencyWords = ['now', 'today', 'limited', 'hurry', 'don\'t miss'];
    const urgencyEdits = ctaEdits.filter(e => {
      return urgencyWords.some(word => e.editedText.toLowerCase().includes(word));
    }).length;

    if (urgencyEdits > ctaEdits.length * 0.5) {
      insights.push({
        category: 'Call-to-Action Style',
        insight: 'You prefer CTAs with urgency and action-oriented language.',
        confidence: 0.6,
        examples: ctaEdits.filter(e => urgencyWords.some(word => e.editedText.toLowerCase().includes(word))).slice(0, 2).map(e => `"${e.editedText}"`),
        frequency: urgencyEdits
      });
    }
  }

  // Analyze platform-specific patterns
  const platformEdits = edits.reduce((acc, edit) => {
    acc[edit.content.platform] = (acc[edit.content.platform] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const mostEditedPlatform = Object.entries(platformEdits).sort(([,a], [,b]) => (b as number) - (a as number))[0];
  if (mostEditedPlatform && (mostEditedPlatform[1] as number) > edits.length * 0.5) {
    insights.push({
      category: 'Platform Focus',
      insight: `You make the most adjustments to ${mostEditedPlatform[0] as string} content, showing focused optimization for this platform.`,
      confidence: 0.8,
      examples: [`${mostEditedPlatform[1] as number} out of ${edits.length} total edits`],
      frequency: mostEditedPlatform[1] as number
    });
  }

  return insights.sort((a, b) => b.confidence - a.confidence);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const timeframe = url.searchParams.get('timeframe') || '30d';

    const workspace = await prisma.workspace.findFirst({
      where: {
        userId: session.user.id
      }
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Calculate date range
    const now = new Date();
    let startDate = new Date();

    switch (timeframe) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    const edits = await prisma.contentEdit.findMany({
      where: {
        workspaceId: workspace.id,
        createdAt: {
          gte: startDate
        }
      },
      include: {
        content: {
          select: {
            platform: true,
            type: true
          }
        }
      }
    });

    const insights = generateLearningInsights(edits);
    return NextResponse.json(insights);
  } catch (error) {
    console.error('Error generating insights:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}