import { NextResponse } from 'next/server';
import { getQueueStatus } from '@/src/server/queue';

export async function GET() {
  try {
    const [scrapingStatus, aiStatus, publishingStatus] = await Promise.all([
      getQueueStatus('scraping'),
      getQueueStatus('ai-processing'),
      getQueueStatus('publishing'),
    ]);

    return NextResponse.json({
      scraping: scrapingStatus,
      aiProcessing: aiStatus,
      publishing: publishingStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get queue status' },
      { status: 500 }
    );
  }
}