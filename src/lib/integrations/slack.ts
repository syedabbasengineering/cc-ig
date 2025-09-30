export interface SlackNotification {
  channel?: string;
  text: string;
  blocks?: any[];
  attachments?: any[];
}

export class SlackNotificationService {
  private webhookUrl: string;

  constructor(webhookUrl?: string) {
    this.webhookUrl = webhookUrl || process.env.SLACK_WEBHOOK_URL || '';
  }

  async sendNotification(notification: SlackNotification): Promise<boolean> {
    if (!this.webhookUrl) {
      console.warn('Slack webhook URL not configured, skipping notification');
      return false;
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notification),
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('Failed to send Slack notification:', error);
      return false;
    }
  }

  async notifyContentReady(runId: string, contents: any[], workspaceName?: string) {
    const contentCount = contents.length;
    const notification: SlackNotification = {
      text: `🎉 ${contentCount} new content items are ready for review!`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🎉 Content Ready for Review',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Workspace:* ${workspaceName || 'Unknown'}\n*Run ID:* ${runId}\n*Content Generated:* ${contentCount} items`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Your AI-generated content is ready! Click the buttons below to review:',
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '👀 Review Content',
              },
              url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/workflows/${runId}`,
              action_id: 'review_content',
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '✅ Approve All',
              },
              style: 'primary',
              action_id: 'approve_all_content',
              value: runId,
            },
          ],
        },
      ],
    };

    return await this.sendNotification(notification);
  }

  async notifyWorkflowStarted(runId: string, topic: string, workspaceName?: string) {
    const notification: SlackNotification = {
      text: `🚀 Workflow started for topic: ${topic}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🚀 *Workflow Started*\n*Topic:* ${topic}\n*Workspace:* ${workspaceName || 'Unknown'}\n*Run ID:* ${runId}`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: 'Scraping Instagram for trending content...',
            },
          ],
        },
      ],
    };

    return await this.sendNotification(notification);
  }

  async notifyWorkflowFailed(runId: string, error: string, stage: string) {
    const notification: SlackNotification = {
      text: `❌ Workflow failed at ${stage} stage`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '❌ Workflow Failed',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Run ID:* ${runId}\n*Stage:* ${stage}\n*Error:* ${error}`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '🔄 Retry Workflow',
              },
              action_id: 'retry_workflow',
              value: runId,
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '📋 View Details',
              },
              url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/workflows/${runId}`,
              action_id: 'view_workflow_details',
            },
          ],
        },
      ],
    };

    return await this.sendNotification(notification);
  }

  async notifyContentApproved(contentId: string, platform: string, publishedAt?: Date) {
    const status = publishedAt ? 'published' : 'approved';
    const emoji = publishedAt ? '🎊' : '✅';

    const notification: SlackNotification = {
      text: `${emoji} Content ${status} successfully!`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${emoji} *Content ${status.charAt(0).toUpperCase() + status.slice(1)}*\n*Platform:* ${platform}\n*Content ID:* ${contentId}${publishedAt ? `\n*Published:* ${publishedAt.toLocaleString()}` : ''}`,
          },
        },
      ],
    };

    return await this.sendNotification(notification);
  }

  async notifyBrandVoiceLearning(workspaceName: string, learningType: 'sample' | 'edit', details: string) {
    const emoji = learningType === 'sample' ? '🧠' : '📝';
    const action = learningType === 'sample' ? 'analyzed new samples' : 'learned from your edit';

    const notification: SlackNotification = {
      text: `${emoji} Brand voice ${action}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${emoji} *Brand Voice Learning*\n*Workspace:* ${workspaceName}\n*Action:* ${action}\n*Details:* ${details}`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: 'Your AI will now generate more personalized content based on this learning.',
            },
          ],
        },
      ],
    };

    return await this.sendNotification(notification);
  }

  async sendCustomMessage(message: string, blocks?: any[]) {
    const notification: SlackNotification = {
      text: message,
      blocks,
    };

    return await this.sendNotification(notification);
  }
}

// Export a default instance
export const slackNotificationService = new SlackNotificationService();