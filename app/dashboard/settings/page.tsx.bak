'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AppLayout } from '@/components/app-layout';

interface Workspace {
  id: string;
  name: string;
  brandVoice?: {
    tone?: string;
    style?: string;
    keywords?: string[];
    guidelines?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [workspaceName, setWorkspaceName] = useState('');
  const [brandTone, setBrandTone] = useState('');
  const [brandStyle, setBrandStyle] = useState('');
  const [brandKeywords, setBrandKeywords] = useState('');
  const [brandGuidelines, setBrandGuidelines] = useState('');

  useEffect(() => {
    if (session?.user?.id) {
      fetchWorkspace();
    }
  }, [session]);

  const fetchWorkspace = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/workspace');
      if (response.ok) {
        const data = await response.json();
        setWorkspace(data);
        setWorkspaceName(data.name || '');
        setBrandTone(data.brandVoice?.tone || '');
        setBrandStyle(data.brandVoice?.style || '');
        setBrandKeywords(data.brandVoice?.keywords?.join(', ') || '');
        setBrandGuidelines(data.brandVoice?.guidelines || '');
      }
    } catch (error) {
      console.error('Error fetching workspace:', error);
      setMessage({ type: 'error', text: 'Failed to load workspace settings' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveWorkspace = async () => {
    try {
      setIsSaving(true);
      setMessage(null);

      const brandVoice = {
        tone: brandTone.trim(),
        style: brandStyle.trim(),
        keywords: brandKeywords.split(',').map(k => k.trim()).filter(k => k),
        guidelines: brandGuidelines.trim()
      };

      const response = await fetch('/api/workspace', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: workspaceName.trim(),
          brandVoice
        }),
      });

      if (response.ok) {
        const updatedWorkspace = await response.json();
        setWorkspace(updatedWorkspace);
        setMessage({ type: 'success', text: 'Workspace settings updated successfully!' });
      } else {
        throw new Error('Failed to update workspace');
      }
    } catch (error) {
      console.error('Error updating workspace:', error);
      setMessage({ type: 'error', text: 'Failed to update workspace settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!confirm('Are you sure you want to delete this workspace? This action cannot be undone.')) {
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch('/api/workspace', {
        method: 'DELETE',
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Workspace deleted successfully!' });
        // Redirect to workspace creation or main page
        window.location.href = '/dashboard';
      } else {
        throw new Error('Failed to delete workspace');
      }
    } catch (error) {
      console.error('Error deleting workspace:', error);
      setMessage({ type: 'error', text: 'Failed to delete workspace' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading workspace settings...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Workspace Settings</h1>
          <p className="text-muted-foreground">
            Manage your workspace configuration and brand voice settings.
          </p>
        </div>

        {message && (
          <div className={`p-4 rounded-md ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="brand-voice">Brand Voice</TabsTrigger>
            <TabsTrigger value="danger">Danger Zone</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Workspace Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="workspace-name">Workspace Name</Label>
                    <Input
                      id="workspace-name"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      placeholder="Enter workspace name"
                    />
                  </div>
                  <div>
                    <Label>Workspace ID</Label>
                    <Input
                      value={workspace?.id || ''}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Created</Label>
                    <Input
                      value={workspace?.createdAt ? new Date(workspace.createdAt).toLocaleDateString() : ''}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div>
                    <Label>Last Updated</Label>
                    <Input
                      value={workspace?.updatedAt ? new Date(workspace.updatedAt).toLocaleDateString() : ''}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleSaveWorkspace}
                  disabled={isSaving || !workspaceName.trim()}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="brand-voice" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Brand Voice Configuration</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Define your brand's voice and tone to ensure consistent content generation.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="brand-tone">Brand Tone</Label>
                    <Input
                      id="brand-tone"
                      value={brandTone}
                      onChange={(e) => setBrandTone(e.target.value)}
                      placeholder="e.g., Professional, Friendly, Casual"
                    />
                  </div>
                  <div>
                    <Label htmlFor="brand-style">Brand Style</Label>
                    <Input
                      id="brand-style"
                      value={brandStyle}
                      onChange={(e) => setBrandStyle(e.target.value)}
                      placeholder="e.g., Informative, Inspirational, Humorous"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="brand-keywords">Brand Keywords</Label>
                  <Input
                    id="brand-keywords"
                    value={brandKeywords}
                    onChange={(e) => setBrandKeywords(e.target.value)}
                    placeholder="Enter keywords separated by commas"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Keywords that should frequently appear in your content
                  </p>
                </div>

                <div>
                  <Label htmlFor="brand-guidelines">Brand Guidelines</Label>
                  <Textarea
                    id="brand-guidelines"
                    value={brandGuidelines}
                    onChange={(e) => setBrandGuidelines(e.target.value)}
                    placeholder="Enter detailed brand voice guidelines..."
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Detailed guidelines for content creation, including what to avoid
                  </p>
                </div>

                {brandKeywords && (
                  <div>
                    <Label>Current Keywords</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {brandKeywords.split(',').map((keyword, index) => (
                        <Badge key={index} variant="secondary">
                          {keyword.trim()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleSaveWorkspace}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Brand Voice Settings'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="danger" className="space-y-6">
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-600">Danger Zone</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Irreversible actions that will permanently affect your workspace.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border border-red-200 rounded-md bg-red-50">
                  <h3 className="font-medium text-red-800 mb-2">Delete Workspace</h3>
                  <p className="text-sm text-red-700 mb-4">
                    Once you delete a workspace, there is no going back. This will permanently delete:
                  </p>
                  <ul className="text-sm text-red-700 list-disc list-inside space-y-1 mb-4">
                    <li>All workflows and content</li>
                    <li>Brand voice samples and analysis</li>
                    <li>Publishing schedules and metrics</li>
                    <li>All workspace data and history</li>
                  </ul>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteWorkspace}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Deleting...' : 'Delete Workspace'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}