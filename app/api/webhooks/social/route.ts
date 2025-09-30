import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const platform = request.nextUrl.searchParams.get('platform') || 'unknown';

    // Route to appropriate platform handler
    switch (platform) {
      case 'instagram':
        return await handleInstagramWebhook(body, request);

      case 'linkedin':
        return await handleLinkedInWebhook(body, request);

      case 'twitter':
        return await handleTwitterWebhook(body, request);

      default:
        console.log(`Unhandled social platform webhook: ${platform}`);
        return NextResponse.json({ error: 'Unknown platform' }, { status: 400 });
    }
  } catch (error) {
    console.error('Social platform webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleInstagramWebhook(body: any, request: NextRequest) {
  try {
    // Verify Instagram webhook signature
    // const signature = request.headers.get('x-hub-signature-256');
    // if (!verifyInstagramSignature(body, signature)) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    // }

    const { object, entry } = body;

    if (object === 'instagram') {
      for (const entryItem of entry) {
        for (const change of entryItem.changes) {
          await handleInstagramChange(change);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Instagram webhook error:', error);
    return NextResponse.json({ error: 'Processing error' }, { status: 500 });
  }
}

async function handleInstagramChange(change: any) {
  const { field, value } = change;

  switch (field) {
    case 'media':
      await handleMediaUpdate(value, 'instagram');
      break;

    case 'comments':
      await handleCommentsUpdate(value, 'instagram');
      break;

    case 'live_comments':
      await handleLiveCommentsUpdate(value, 'instagram');
      break;

    default:
      console.log(`Unhandled Instagram change: ${field}`);
  }
}

async function handleLinkedInWebhook(body: any, request: NextRequest) {
  try {
    // LinkedIn webhook handling
    const { events } = body;

    for (const event of events || []) {
      await handleLinkedInEvent(event);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('LinkedIn webhook error:', error);
    return NextResponse.json({ error: 'Processing error' }, { status: 500 });
  }
}

async function handleLinkedInEvent(event: any) {
  const { eventType, data } = event;

  switch (eventType) {
    case 'SHARE_STATISTICS_UPDATE':
      await handleShareStatsUpdate(data, 'linkedin');
      break;

    case 'COMMENT_ON_SHARE':
      await handleCommentEvent(data, 'linkedin');
      break;

    default:
      console.log(`Unhandled LinkedIn event: ${eventType}`);
  }
}

async function handleTwitterWebhook(body: any, request: NextRequest) {
  try {
    // Twitter/X webhook handling
    const { tweet_create_events, favorite_events, follow_events } = body;

    if (tweet_create_events) {
      for (const tweet of tweet_create_events) {
        await handleTweetCreate(tweet);
      }
    }

    if (favorite_events) {
      for (const favorite of favorite_events) {
        await handleTweetFavorite(favorite);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Twitter webhook error:', error);
    return NextResponse.json({ error: 'Processing error' }, { status: 500 });
  }
}

// Generic handlers for social media events
async function handleMediaUpdate(value: any, platform: string) {
  try {
    const { media_id } = value;

    // Find content by platform-specific ID
    const content = await prisma.content.findFirst({
      where: {
        platform,
        content: {
          path: ['platformId'],
          equals: media_id,
        },
      },
    });

    if (content) {
      // Update performance metrics
      await updateContentPerformance(content.id, value);
    }
  } catch (error) {
    console.error('Error handling media update:', error);
  }
}

async function handleCommentsUpdate(value: any, platform: string) {
  try {
    const { media_id, comment_id, text } = value;

    // Find associated content
    const content = await prisma.content.findFirst({
      where: {
        platform,
        content: {
          path: ['platformId'],
          equals: media_id,
        },
      },
    });

    if (content) {
      // Store comment for analysis
      console.log(`New comment on ${platform} content ${content.id}: ${text}`);

      // Could analyze sentiment, extract insights, etc.
      // await analyzeCommentSentiment(comment_id, text, content.id);
    }
  } catch (error) {
    console.error('Error handling comments update:', error);
  }
}

async function handleShareStatsUpdate(data: any, platform: string) {
  try {
    const { share, statistics } = data;

    // Find content by share ID
    const content = await prisma.content.findFirst({
      where: {
        platform,
        content: {
          path: ['shareId'],
          equals: share,
        },
      },
    });

    if (content) {
      await updateContentPerformance(content.id, statistics);
    }
  } catch (error) {
    console.error('Error handling share stats update:', error);
  }
}

async function handleCommentEvent(data: any, platform: string) {
  try {
    const { share, comment } = data;

    // Similar to handleCommentsUpdate but for LinkedIn
    console.log(`New ${platform} comment:`, comment.text);
  } catch (error) {
    console.error('Error handling comment event:', error);
  }
}

async function handleTweetCreate(tweet: any) {
  try {
    const { id_str, text, user } = tweet;

    // Handle mentions, replies to our content, etc.
    console.log(`Tweet created: ${text} by @${user.screen_name}`);
  } catch (error) {
    console.error('Error handling tweet create:', error);
  }
}

async function handleTweetFavorite(favorite: any) {
  try {
    const { favorited_status } = favorite;

    // Update performance metrics for favorited tweets
    await handleMediaUpdate({ media_id: favorited_status.id_str }, 'twitter');
  } catch (error) {
    console.error('Error handling tweet favorite:', error);
  }
}

async function handleLiveCommentsUpdate(value: any, platform: string) {
  try {
    // Handle live video comments
    console.log(`Live comment on ${platform}:`, value);
  } catch (error) {
    console.error('Error handling live comments update:', error);
  }
}

// Helper function to update content performance
async function updateContentPerformance(contentId: string, metrics: any) {
  try {
    const existingContent = await prisma.content.findUnique({
      where: { id: contentId },
    });

    if (!existingContent) return;

    const currentPerformance = (existingContent.performance as any) || {};
    const updatedPerformance = {
      ...currentPerformance,
      ...metrics,
      lastUpdated: new Date(),
    };

    await prisma.content.update({
      where: { id: contentId },
      data: {
        performance: updatedPerformance as any,
      },
    });

    console.log(`Updated performance for content ${contentId}`);
  } catch (error) {
    console.error('Error updating content performance:', error);
  }
}

// Signature verification helpers (implement when needed)
// function verifyInstagramSignature(body: any, signature: string | null): boolean {
//   if (!signature) return false;
//
//   const expectedSignature = crypto
//     .createHmac('sha256', process.env.INSTAGRAM_WEBHOOK_SECRET!)
//     .update(JSON.stringify(body))
//     .digest('hex');
//
//   return signature === `sha256=${expectedSignature}`;
// }