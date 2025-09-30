import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db/client';
import { aiProcessingQueue } from '@/src/server/queue';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Verify webhook signature (in production)
    // const signature = request.headers.get('x-apify-webhook-signature');
    // if (!verifyApifySignature(body, signature)) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    // }

    const { eventType, eventData, resource } = body;

    // Handle different Apify webhook events
    switch (eventType) {
      case 'ACTOR_RUN_SUCCEEDED':
        await handleActorRunSucceeded(eventData, resource);
        break;

      case 'ACTOR_RUN_FAILED':
        await handleActorRunFailed(eventData, resource);
        break;

      case 'ACTOR_RUN_ABORTED':
        await handleActorRunAborted(eventData, resource);
        break;

      default:
        console.log(`Unhandled Apify webhook event: ${eventType}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Apify webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleActorRunSucceeded(eventData: any, resource: any) {
  try {
    const { id: runId, defaultDatasetId } = resource;

    // Find workflow run by metadata (if we stored the Apify run ID)
    // For now, we'll skip this as our scraping worker handles the data directly
    console.log(`Apify actor run ${runId} succeeded`);

    // In a more sophisticated setup, you might:
    // 1. Find the corresponding workflow run
    // 2. Fetch the results from the dataset
    // 3. Continue the workflow pipeline

    // Example:
    // const workflowRun = await prisma.workflowRun.findFirst({
    //   where: {
    //     scrapedData: {
    //       path: ['apifyRunId'],
    //       equals: runId
    //     }
    //   }
    // });

    // if (workflowRun) {
    //   // Queue AI processing if not already done
    //   await aiProcessingQueue.add('process-content', {
    //     runId: workflowRun.id,
    //     apifyRunId: runId,
    //     datasetId: defaultDatasetId
    //   });
    // }

  } catch (error) {
    console.error('Error handling Apify success webhook:', error);
  }
}

async function handleActorRunFailed(eventData: any, resource: any) {
  try {
    const { id: runId } = resource;
    console.log(`Apify actor run ${runId} failed:`, eventData.exitCode);

    // Find and update the corresponding workflow run
    // const workflowRun = await prisma.workflowRun.findFirst({
    //   where: {
    //     scrapedData: {
    //       path: ['apifyRunId'],
    //       equals: runId
    //     }
    //   }
    // });

    // if (workflowRun) {
    //   await prisma.workflowRun.update({
    //     where: { id: workflowRun.id },
    //     data: {
    //       status: 'failed',
    //       errors: {
    //         stage: 'scraping',
    //         apifyError: eventData,
    //         timestamp: new Date()
    //       } as any
    //     }
    //   });
    // }

  } catch (error) {
    console.error('Error handling Apify failure webhook:', error);
  }
}

async function handleActorRunAborted(eventData: any, resource: any) {
  try {
    const { id: runId } = resource;
    console.log(`Apify actor run ${runId} was aborted`);

    // Similar to failure handling
    // Mark workflow as cancelled/failed

  } catch (error) {
    console.error('Error handling Apify abort webhook:', error);
  }
}

// Helper function to verify webhook signature (implement when needed)
// function verifyApifySignature(body: any, signature: string | null): boolean {
//   if (!signature) return false;
//
//   const expectedSignature = crypto
//     .createHmac('sha256', process.env.APIFY_WEBHOOK_SECRET!)
//     .update(JSON.stringify(body))
//     .digest('hex');
//
//   return signature === `sha256=${expectedSignature}`;
// }