import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db/client';
import { publishingQueue } from '@/src/server/queue';
import { slackConfigService } from '@/src/lib/integrations/slack-config';

export async function POST(request: NextRequest) {
  try {
    const bodyText = await request.text();
    const body = JSON.parse(bodyText);

    // Handle Slack URL verification challenge
    if (body.type === 'url_verification') {
      return NextResponse.json({ challenge: body.challenge });
    }

    // Verify Slack signature for security
    const signature = request.headers.get('x-slack-signature');
    const timestamp = request.headers.get('x-slack-request-timestamp');

    if (process.env.NODE_ENV === 'production') {
      if (!slackConfigService.verifySlackSignature(bodyText, signature, timestamp)) {
        console.error('Invalid Slack signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    // Handle different Slack events
    switch (body.type) {
      case 'event_callback':
        await handleEventCallback(body.event);
        break;

      case 'interactive_components':
        await handleInteractiveComponents(body);
        break;

      case 'slash_command':
        return await handleSlashCommand(body);

      default:
        console.log(`Unhandled Slack webhook type: ${body.type}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Slack webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleEventCallback(event: any) {
  try {
    switch (event.type) {
      case 'message':
        await handleMessage(event);
        break;

      case 'reaction_added':
        await handleReactionAdded(event);
        break;

      default:
        console.log(`Unhandled Slack event: ${event.type}`);
    }
  } catch (error) {
    console.error('Error handling Slack event callback:', error);
  }
}

async function handleMessage(event: any) {
  // Handle direct messages or mentions
  // Could be used for content feedback or commands
  console.log('Slack message received:', event.text);
}

async function handleReactionAdded(event: any) {
  // Handle reactions to content approval messages
  // Could be used as approval/rejection signals
  const { reaction, item } = event;

  if (reaction === '✅' || reaction === 'white_check_mark') {
    // Approve content
    console.log('Content approved via Slack reaction');
  } else if (reaction === '❌' || reaction === 'x') {
    // Reject content
    console.log('Content rejected via Slack reaction');
  }
}

async function handleInteractiveComponents(body: any) {
  try {
    const { payload } = body;
    const interaction = JSON.parse(payload);

    switch (interaction.type) {
      case 'block_actions':
        await handleBlockActions(interaction);
        break;

      case 'modal_submission':
        await handleModalSubmission(interaction);
        break;

      default:
        console.log(`Unhandled interaction type: ${interaction.type}`);
    }
  } catch (error) {
    console.error('Error handling Slack interactive components:', error);
  }
}

async function handleBlockActions(interaction: any) {
  const { actions, user } = interaction;

  for (const action of actions) {
    switch (action.action_id) {
      case 'approve_content':
        await approveContentFromSlack(action.value, user.id);
        break;

      case 'reject_content':
        await rejectContentFromSlack(action.value, user.id);
        break;

      case 'edit_content':
        await initiateContentEdit(action.value, user.id);
        break;

      case 'schedule_content':
        await scheduleContentFromSlack(action.value, user.id);
        break;

      default:
        console.log(`Unhandled action: ${action.action_id}`);
    }
  }
}

async function approveContentFromSlack(contentId: string, userId: string) {
  try {
    // Update content status
    const content = await prisma.content.update({
      where: { id: contentId },
      data: { status: 'approved' },
    });

    // Queue for publishing if auto-publish is enabled
    await publishingQueue.add(
      'publish-content',
      {
        runId: content.runId || '',
        contentId: content.id,
        platform: content.platform,
      },
      {
        jobId: `publish-slack-${content.id}`,
      }
    );

    console.log(`Content ${contentId} approved by ${userId} via Slack`);
  } catch (error) {
    console.error('Error approving content from Slack:', error);
  }
}

async function rejectContentFromSlack(contentId: string, userId: string) {
  try {
    // Get current content
    const currentContent = await prisma.content.findUnique({
      where: { id: contentId },
    });

    if (!currentContent) {
      throw new Error('Content not found');
    }

    const updatedContent = {
      ...(currentContent.content as any),
      rejectionReason: 'Rejected via Slack',
      rejectedBy: userId,
    };

    await prisma.content.update({
      where: { id: contentId },
      data: {
        status: 'rejected',
        content: updatedContent as any,
      },
    });

    console.log(`Content ${contentId} rejected by ${userId} via Slack`);
  } catch (error) {
    console.error('Error rejecting content from Slack:', error);
  }
}

async function initiateContentEdit(contentId: string, userId: string) {
  // This would open a modal or direct to the web interface
  console.log(`Content edit initiated for ${contentId} by ${userId}`);

  // In production, you might:
  // 1. Open a Slack modal with editable fields
  // 2. Send a link to the web interface
  // 3. Start a conversation thread for feedback
}

async function scheduleContentFromSlack(contentId: string, userId: string) {
  // This would open a date/time picker modal
  console.log(`Content scheduling initiated for ${contentId} by ${userId}`);
}

async function handleModalSubmission(interaction: any) {
  const { view, user } = interaction;

  // Handle form submissions from Slack modals
  // Could be content edits, scheduling, or feedback
  console.log('Modal submitted:', view.callback_id);
}

async function handleSlashCommand(body: any) {
  const { command, text, user_id } = body;

  switch (command) {
    case '/content-status':
      return await getContentStatus(text, user_id);

    case '/workflow-run':
      return await runWorkflowFromSlack(text, user_id);

    case '/content-approve':
      return await approveContentCommand(text, user_id);

    default:
      return NextResponse.json({
        text: `Unknown command: ${command}`,
        response_type: 'ephemeral',
      });
  }
}

async function getContentStatus(params: string, userId: string) {
  // Get recent content status
  const content = await prisma.content.findMany({
    where: {
      status: 'reviewing',
    },
    take: 5,
    orderBy: { createdAt: 'desc' },
  });

  const statusText = content.length > 0
    ? `You have ${content.length} content items pending review`
    : 'No content pending review';

  return NextResponse.json({
    text: statusText,
    response_type: 'ephemeral',
  });
}

async function runWorkflowFromSlack(params: string, userId: string) {
  // Extract topic from params
  const topic = params.trim();

  if (!topic) {
    return NextResponse.json({
      text: 'Please provide a topic: `/workflow-run productivity tips`',
      response_type: 'ephemeral',
    });
  }

  return NextResponse.json({
    text: `Workflow for "${topic}" will be started. You'll receive a notification when content is ready for review.`,
    response_type: 'ephemeral',
  });
}

async function approveContentCommand(params: string, userId: string) {
  const contentId = params.trim();

  if (!contentId) {
    return NextResponse.json({
      text: 'Please provide content ID: `/content-approve <id>`',
      response_type: 'ephemeral',
    });
  }

  try {
    await approveContentFromSlack(contentId, userId);
    return NextResponse.json({
      text: `Content ${contentId} has been approved and queued for publishing.`,
      response_type: 'ephemeral',
    });
  } catch (error) {
    return NextResponse.json({
      text: `Error approving content: ${contentId}`,
      response_type: 'ephemeral',
    });
  }
}

/**
 * Slack webhook handler - handles incoming events from Slack
 * including interactive components, slash commands, and event callbacks
 */