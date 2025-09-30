'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ContentItem {
  id: string;
  title: string;
  caption: string;
  hook: string;
  hashtags: string[];
  cta: string;
  platform: string;
  status: 'draft' | 'reviewing' | 'approved' | 'rejected' | 'published';
  createdAt: string;
  workflowId: string;
  originalCaption?: string;
}

export default function ContentPage() {
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState<Partial<ContentItem>>({});

  // Mock content data
  const [content] = useState<ContentItem[]>([
    {
      id: '1',
      title: 'AI Revolution in Content Creation',
      caption: '🚀 The future of content creation is here! AI-powered tools are transforming how we tell stories, engage audiences, and build communities. From automated captions to smart hashtag suggestions, technology is becoming our creative partner. What\'s your experience with AI in content creation? Share your thoughts below! 👇',
      hook: '🚀 The future of content creation is here!',
      hashtags: ['#AI', '#ContentCreation', '#DigitalMarketing', '#Technology', '#Innovation'],
      cta: 'What\'s your experience with AI in content creation? Share your thoughts below! 👇',
      platform: 'instagram',
      status: 'reviewing',
      createdAt: new Date().toISOString(),
      workflowId: 'workflow-1',
    },
    {
      id: '2',
      title: 'Building Authentic Brand Voice',
      caption: '💡 Authenticity is the cornerstone of meaningful brand connections. Your voice isn\'t just what you say—it\'s how you make your audience feel. Here are 3 key principles for developing an authentic brand voice: 1) Stay true to your values 2) Listen to your community 3) Be consistent across all platforms. Ready to amplify your authentic voice?',
      hook: '💡 Authenticity is the cornerstone of meaningful brand connections.',
      hashtags: ['#BrandVoice', '#Authenticity', '#Marketing', '#BrandBuilding', '#Community'],
      cta: 'Ready to amplify your authentic voice?',
      platform: 'linkedin',
      status: 'approved',
      createdAt: new Date().toISOString(),
      workflowId: 'workflow-1',
    },
    {
      id: '3',
      title: 'The Power of Visual Storytelling',
      caption: '📸 A picture tells a thousand words, but a strategic visual tells a story that converts. In today\'s fast-paced digital world, visual content captures attention 65% faster than text alone. Master the art of visual storytelling to transform your brand narrative.',
      hook: '📸 A picture tells a thousand words, but a strategic visual tells a story that converts.',
      hashtags: ['#VisualStorytelling', '#ContentStrategy', '#DigitalMarketing', '#Branding'],
      cta: 'Master the art of visual storytelling to transform your brand narrative.',
      platform: 'instagram',
      status: 'rejected',
      createdAt: new Date().toISOString(),
      workflowId: 'workflow-2',
    },
  ]);

  const filterContentByStatus = (status: string) => {
    if (status === 'all') return content;
    return content.filter(item => item.status === status);
  };

  const handleEdit = (contentItem: ContentItem) => {
    setSelectedContent(contentItem);
    setEditedContent({
      caption: contentItem.caption,
      hook: contentItem.hook,
      hashtags: contentItem.hashtags,
      cta: contentItem.cta,
    });
    setEditMode(true);
  };

  const handleSaveEdit = () => {
    if (selectedContent && editedContent) {
      // In a real app, this would make an API call
      console.log('Saving edits:', editedContent);
      setEditMode(false);
      setSelectedContent(null);
      setEditedContent({});
    }
  };

  const handleApprove = (contentId: string) => {
    console.log('Approving content:', contentId);
    // Update content status to approved
  };

  const handleReject = (contentId: string) => {
    console.log('Rejecting content:', contentId);
    // Update content status to rejected
  };

  const handleBulkAction = (action: string, contentIds: string[]) => {
    console.log(`Bulk ${action}:`, contentIds);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'reviewing': return 'bg-yellow-100 text-yellow-800';
      case 'published': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Content Review</h1>
          <p className="text-muted-foreground">
            Review, edit, and approve AI-generated content
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            Bulk Actions
          </Button>
          <Button>
            Schedule Publishing
          </Button>
        </div>
      </div>

      {/* Content Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Pending Review', count: filterContentByStatus('reviewing').length, color: 'text-yellow-600' },
          { label: 'Approved', count: filterContentByStatus('approved').length, color: 'text-green-600' },
          { label: 'Rejected', count: filterContentByStatus('rejected').length, color: 'text-red-600' },
          { label: 'Published', count: filterContentByStatus('published').length, color: 'text-blue-600' },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.count}</div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content Tabs */}
      <Tabs defaultValue="reviewing" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Content</TabsTrigger>
          <TabsTrigger value="reviewing">Pending Review</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        {['all', 'reviewing', 'approved', 'rejected'].map((status) => (
          <TabsContent key={status} value={status} className="space-y-4">
            <div className="grid grid-cols-1 gap-6">
              {filterContentByStatus(status).map((contentItem) => (
                <Card key={contentItem.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-2">{contentItem.title}</CardTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="capitalize">{contentItem.platform}</span>
                          <span>•</span>
                          <span>{new Date(contentItem.createdAt).toLocaleDateString()}</span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(contentItem.status)}`}>
                            {contentItem.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(contentItem)}
                        >
                          Edit
                        </Button>
                        {contentItem.status === 'reviewing' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReject(contentItem.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleApprove(contentItem.id)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Approve
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Hook */}
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground">HOOK</Label>
                      <p className="text-sm font-medium mt-1">{contentItem.hook}</p>
                    </div>

                    {/* Caption */}
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground">CAPTION</Label>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{contentItem.caption}</p>
                    </div>

                    {/* Hashtags */}
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground">HASHTAGS</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {contentItem.hashtags.map((hashtag) => (
                          <span
                            key={hashtag}
                            className="text-xs bg-accent text-accent-foreground px-2 py-1 rounded"
                          >
                            {hashtag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* CTA */}
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground">CALL TO ACTION</Label>
                      <p className="text-sm mt-1">{contentItem.cta}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Edit Dialog */}
      {editMode && selectedContent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Edit Content: {selectedContent.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Hook Edit */}
              <div>
                <Label htmlFor="edit-hook">Hook</Label>
                <textarea
                  id="edit-hook"
                  className="w-full mt-2 p-3 border border-border rounded-md resize-none"
                  rows={2}
                  value={editedContent.hook || ''}
                  onChange={(e) => setEditedContent({ ...editedContent, hook: e.target.value })}
                />
              </div>

              {/* Caption Edit */}
              <div>
                <Label htmlFor="edit-caption">Caption</Label>
                <textarea
                  id="edit-caption"
                  className="w-full mt-2 p-3 border border-border rounded-md resize-none"
                  rows={6}
                  value={editedContent.caption || ''}
                  onChange={(e) => setEditedContent({ ...editedContent, caption: e.target.value })}
                />
              </div>

              {/* Hashtags Edit */}
              <div>
                <Label htmlFor="edit-hashtags">Hashtags (comma-separated)</Label>
                <input
                  id="edit-hashtags"
                  type="text"
                  className="w-full mt-2 p-3 border border-border rounded-md"
                  value={editedContent.hashtags?.join(', ') || ''}
                  onChange={(e) => setEditedContent({
                    ...editedContent,
                    hashtags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                  })}
                />
              </div>

              {/* CTA Edit */}
              <div>
                <Label htmlFor="edit-cta">Call to Action</Label>
                <textarea
                  id="edit-cta"
                  className="w-full mt-2 p-3 border border-border rounded-md resize-none"
                  rows={2}
                  value={editedContent.cta || ''}
                  onChange={(e) => setEditedContent({ ...editedContent, cta: e.target.value })}
                />
              </div>

              {/* Original vs Edited Diff */}
              <div className="border-t pt-4">
                <h3 className="font-medium mb-2">Changes Preview</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">ORIGINAL</Label>
                    <div className="bg-red-50 border border-red-200 rounded p-2 mt-1">
                      <p className="line-clamp-3">{selectedContent.caption}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">EDITED</Label>
                    <div className="bg-green-50 border border-green-200 rounded p-2 mt-1">
                      <p className="line-clamp-3">{editedContent.caption}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditMode(false);
                    setSelectedContent(null);
                    setEditedContent({});
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit}>
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}