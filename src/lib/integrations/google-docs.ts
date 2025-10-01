import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleDocsConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  credentials?: any;
}

export interface GoogleDocContent {
  title: string;
  content: string;
  metadata?: Record<string, any>;
}

export class GoogleDocsService {
  private oauth2Client: OAuth2Client;
  private config: GoogleDocsConfig;

  constructor(config?: GoogleDocsConfig) {
    this.config = {
      clientId: config?.clientId || process.env.GOOGLE_CLIENT_ID,
      clientSecret: config?.clientSecret || process.env.GOOGLE_CLIENT_SECRET,
      redirectUri:
        config?.redirectUri ||
        `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google/callback`,
    };

    this.oauth2Client = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri
    );

    if (config?.credentials) {
      this.oauth2Client.setCredentials(config.credentials);
    }
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.email',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state,
      prompt: 'consent', // Force consent to get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string): Promise<any> {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    return tokens;
  }

  /**
   * Set credentials from stored tokens
   */
  setCredentials(credentials: any): void {
    this.oauth2Client.setCredentials(credentials);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<any> {
    const { credentials } = await this.oauth2Client.refreshAccessToken();
    this.oauth2Client.setCredentials(credentials);
    return credentials;
  }

  /**
   * Create a new Google Doc
   */
  async createDocument(
    title: string,
    content?: string,
    folderId?: string
  ): Promise<any> {
    const docs = google.docs({ version: 'v1', auth: this.oauth2Client });
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

    // Create the document
    const createResponse = await docs.documents.create({
      requestBody: {
        title,
      },
    });

    const documentId = createResponse.data.documentId!;

    // Add content if provided
    if (content) {
      await this.appendContent(documentId, content);
    }

    // Move to folder if specified
    if (folderId) {
      await drive.files.update({
        fileId: documentId,
        addParents: folderId,
        fields: 'id, parents',
      });
    }

    return createResponse.data;
  }

  /**
   * Append content to an existing document
   */
  async appendContent(documentId: string, content: string): Promise<any> {
    const docs = google.docs({ version: 'v1', auth: this.oauth2Client });

    // Get current document to determine end index
    const doc = await docs.documents.get({ documentId });
    const endIndex = doc.data.body?.content?.[doc.data.body.content.length - 1]?.endIndex || 1;

    const requests = [
      {
        insertText: {
          location: {
            index: endIndex - 1,
          },
          text: content,
        },
      },
    ];

    const response = await docs.documents.batchUpdate({
      documentId,
      requestBody: { requests },
    });

    return response.data;
  }

  /**
   * Create a formatted content document with sections
   */
  async createFormattedDocument(
    title: string,
    sections: Array<{ heading?: string; content: string; style?: string }>,
    folderId?: string
  ): Promise<any> {
    const docs = google.docs({ version: 'v1', auth: this.oauth2Client });
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

    // Create the document
    const createResponse = await docs.documents.create({
      requestBody: {
        title,
      },
    });

    const documentId = createResponse.data.documentId!;

    // Build batch update requests for formatting
    const requests: any[] = [];
    let currentIndex = 1;

    for (const section of sections) {
      if (section.heading) {
        // Insert heading
        requests.push({
          insertText: {
            location: { index: currentIndex },
            text: section.heading + '\n',
          },
        });

        // Style heading
        requests.push({
          updateParagraphStyle: {
            range: {
              startIndex: currentIndex,
              endIndex: currentIndex + section.heading.length + 1,
            },
            paragraphStyle: {
              namedStyleType: 'HEADING_1',
            },
            fields: 'namedStyleType',
          },
        });

        currentIndex += section.heading.length + 1;
      }

      // Insert content
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: section.content + '\n\n',
        },
      });

      currentIndex += section.content.length + 2;
    }

    // Apply all formatting
    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId,
        requestBody: { requests },
      });
    }

    // Move to folder if specified
    if (folderId) {
      await drive.files.update({
        fileId: documentId,
        addParents: folderId,
        fields: 'id, parents',
      });
    }

    return createResponse.data;
  }

  /**
   * Export content to Google Docs with rich formatting
   */
  async exportContentToDocs(
    contentItem: any,
    workspaceName: string,
    folderId?: string
  ): Promise<string> {
    const content = contentItem.content;
    const platform = contentItem.platform || 'Instagram';

    const sections = [
      {
        heading: 'Platform',
        content: platform.charAt(0).toUpperCase() + platform.slice(1),
      },
      {
        heading: 'Caption',
        content: content.caption || '',
      },
      {
        heading: 'Hook',
        content: content.hook || '',
      },
      {
        heading: 'Call to Action',
        content: content.cta || '',
      },
      {
        heading: 'Hashtags',
        content: (content.hashtags || []).join(' '),
      },
    ];

    if (content.imagePrompt) {
      sections.push({
        heading: 'Image Prompt',
        content: content.imagePrompt,
      });
    }

    const title = `${workspaceName} - ${platform} Content - ${new Date().toLocaleDateString()}`;

    const doc = await this.createFormattedDocument(title, sections, folderId);

    return `https://docs.google.com/document/d/${doc.documentId}/edit`;
  }

  /**
   * Get document content
   */
  async getDocument(documentId: string): Promise<any> {
    const docs = google.docs({ version: 'v1', auth: this.oauth2Client });
    const response = await docs.documents.get({ documentId });
    return response.data;
  }

  /**
   * Share document with specific users
   */
  async shareDocument(
    documentId: string,
    emails: string[],
    role: 'reader' | 'writer' | 'commenter' = 'writer'
  ): Promise<void> {
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

    for (const email of emails) {
      await drive.permissions.create({
        fileId: documentId,
        requestBody: {
          type: 'user',
          role,
          emailAddress: email,
        },
        sendNotificationEmail: true,
      });
    }
  }

  /**
   * Create a folder in Google Drive
   */
  async createFolder(folderName: string, parentFolderId?: string): Promise<string> {
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

    const fileMetadata: any = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };

    if (parentFolderId) {
      fileMetadata.parents = [parentFolderId];
    }

    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id',
    });

    return response.data.id!;
  }

  /**
   * List documents in a folder
   */
  async listDocuments(folderId?: string): Promise<any[]> {
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

    const query = folderId
      ? `'${folderId}' in parents and mimeType='application/vnd.google-apps.document'`
      : "mimeType='application/vnd.google-apps.document'";

    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name, createdTime, modifiedTime)',
      orderBy: 'modifiedTime desc',
    });

    return response.data.files || [];
  }

  /**
   * Batch export multiple content items to Google Docs
   */
  async batchExportContent(
    contentItems: any[],
    workspaceName: string,
    folderId?: string
  ): Promise<string[]> {
    const urls: string[] = [];

    for (const item of contentItems) {
      try {
        const url = await this.exportContentToDocs(item, workspaceName, folderId);
        urls.push(url);
      } catch (error) {
        console.error(`Failed to export content ${item.id}:`, error);
      }
    }

    return urls;
  }

  isConfigured(): boolean {
    return !!(this.config.clientId && this.config.clientSecret);
  }
}

export const googleDocsService = new GoogleDocsService();
