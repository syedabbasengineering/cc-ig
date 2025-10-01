import crypto from 'crypto';

export interface SlackConfig {
  webhookUrl?: string;
  botToken?: string;
  signingSecret?: string;
  appId?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface SlackInstallation {
  id: string;
  workspaceId: string;
  teamId: string;
  teamName: string;
  botToken: string;
  botUserId: string;
  channelId?: string;
  installedAt: Date;
}

export class SlackConfigService {
  private config: SlackConfig;

  constructor(config?: SlackConfig) {
    this.config = {
      webhookUrl: config?.webhookUrl || process.env.SLACK_WEBHOOK_URL,
      botToken: config?.botToken || process.env.SLACK_BOT_TOKEN,
      signingSecret: config?.signingSecret || process.env.SLACK_SIGNING_SECRET,
      appId: config?.appId || process.env.SLACK_APP_ID,
      clientId: config?.clientId || process.env.SLACK_CLIENT_ID,
      clientSecret: config?.clientSecret || process.env.SLACK_CLIENT_SECRET,
    };
  }

  /**
   * Verify Slack request signature for security
   */
  verifySlackSignature(
    body: string,
    signature: string | null,
    timestamp: string | null
  ): boolean {
    if (!signature || !timestamp || !this.config.signingSecret) {
      return false;
    }

    // Check if timestamp is recent (within 5 minutes)
    const currentTime = Math.floor(Date.now() / 1000);
    const requestTime = parseInt(timestamp, 10);
    if (Math.abs(currentTime - requestTime) > 300) {
      return false;
    }

    const hmac = crypto.createHmac('sha256', this.config.signingSecret);
    const [version, hash] = signature.split('=');
    const baseString = `${version}:${timestamp}:${body}`;

    hmac.update(baseString, 'utf8');
    const expectedSignature = hmac.digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthorizationUrl(state: string, redirectUri: string): string {
    const scopes = [
      'chat:write',
      'commands',
      'incoming-webhook',
      'reactions:read',
      'reactions:write',
      'channels:read',
      'groups:read',
      'im:read',
      'mpim:read',
    ].join(',');

    const params = new URLSearchParams({
      client_id: this.config.clientId || '',
      scope: scopes,
      state,
      redirect_uri: redirectUri,
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /**
   * Exchange OAuth code for access token
   */
  async exchangeOAuthCode(code: string, redirectUri: string): Promise<any> {
    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId || '',
        client_secret: this.config.clientSecret || '',
        code,
        redirect_uri: redirectUri,
      }),
    });

    return await response.json();
  }

  /**
   * Call Slack Web API
   */
  async callSlackAPI(method: string, payload: any = {}): Promise<any> {
    if (!this.config.botToken) {
      throw new Error('Slack bot token not configured');
    }

    const response = await fetch(`https://slack.com/api/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.botToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    return data;
  }

  /**
   * Post a message to a channel
   */
  async postMessage(channel: string, text: string, blocks?: any[]): Promise<any> {
    return await this.callSlackAPI('chat.postMessage', {
      channel,
      text,
      blocks,
    });
  }

  /**
   * Update an existing message
   */
  async updateMessage(
    channel: string,
    timestamp: string,
    text: string,
    blocks?: any[]
  ): Promise<any> {
    return await this.callSlackAPI('chat.update', {
      channel,
      ts: timestamp,
      text,
      blocks,
    });
  }

  /**
   * Add a reaction to a message
   */
  async addReaction(channel: string, timestamp: string, reaction: string): Promise<any> {
    return await this.callSlackAPI('reactions.add', {
      channel,
      timestamp,
      name: reaction,
    });
  }

  /**
   * Open a modal/view
   */
  async openView(triggerId: string, view: any): Promise<any> {
    return await this.callSlackAPI('views.open', {
      trigger_id: triggerId,
      view,
    });
  }

  /**
   * Get user info
   */
  async getUserInfo(userId: string): Promise<any> {
    return await this.callSlackAPI('users.info', {
      user: userId,
    });
  }

  /**
   * Get channel info
   */
  async getChannelInfo(channelId: string): Promise<any> {
    return await this.callSlackAPI('conversations.info', {
      channel: channelId,
    });
  }

  /**
   * List all channels
   */
  async listChannels(): Promise<any> {
    return await this.callSlackAPI('conversations.list', {
      types: 'public_channel,private_channel',
    });
  }

  isConfigured(): boolean {
    return !!(this.config.webhookUrl || this.config.botToken);
  }

  getConfig(): SlackConfig {
    return { ...this.config };
  }
}

export const slackConfigService = new SlackConfigService();
