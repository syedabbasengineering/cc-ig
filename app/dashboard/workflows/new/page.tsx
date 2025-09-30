'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// import { trpc } from '@/src/lib/trpc/client';

interface BrandVoiceSample {
  id: string;
  content: string;
  platform: 'instagram' | 'linkedin' | 'twitter';
}

export default function NewWorkflowPage() {
  const [step, setStep] = useState(1);
  const [topic, setTopic] = useState('');
  const [brandVoiceSamples, setBrandVoiceSamples] = useState<BrandVoiceSample[]>([]);
  const [newSample, setNewSample] = useState({ content: '', platform: 'instagram' as const });
  const [workflowConfig, setWorkflowConfig] = useState({
    contentCount: 5,
    platforms: ['instagram'] as string[],
    schedulingEnabled: false,
  });

  // const createWorkflow = trpc.workflow.create.useMutation();

  const addBrandVoiceSample = () => {
    if (newSample.content.trim()) {
      setBrandVoiceSamples([
        ...brandVoiceSamples,
        {
          id: Date.now().toString(),
          content: newSample.content,
          platform: newSample.platform,
        },
      ]);
      setNewSample({ content: '', platform: 'instagram' });
    }
  };

  const removeSample = (id: string) => {
    setBrandVoiceSamples(brandVoiceSamples.filter(sample => sample.id !== id));
  };

  const handleCreateWorkflow = async () => {
    try {
      // For now, simulate workflow creation and redirect to demo page
      const mockWorkflowId = 'demo-workflow-' + Date.now();

      // Store the workflow data in localStorage for demo purposes
      localStorage.setItem('demo-workflow', JSON.stringify({
        id: mockWorkflowId,
        name: `Content Workflow - ${topic}`,
        topic,
        brandVoiceSamples,
        config: workflowConfig,
        createdAt: new Date().toISOString(),
      }));

      // Redirect to workflow execution page
      window.location.href = `/dashboard/workflows/${mockWorkflowId}`;
    } catch (error) {
      console.error('Failed to create workflow:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Create New Workflow</h1>
        <p className="text-muted-foreground">
          Set up an AI-powered content creation workflow
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center space-x-4 mb-8">
        {[1, 2, 3, 4].map((stepNumber) => (
          <div key={stepNumber} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= stepNumber
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {stepNumber}
            </div>
            {stepNumber < 4 && (
              <div
                className={`w-12 h-1 mx-2 ${
                  step > stepNumber ? 'bg-primary' : 'bg-muted'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <Tabs value={step.toString()} className="space-y-6">
        {/* Step 1: Topic Input */}
        <TabsContent value="1" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Define Your Topic</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="topic">Content Topic or Theme</Label>
                <textarea
                  id="topic"
                  className="w-full mt-2 p-3 border border-border rounded-md resize-none"
                  rows={4}
                  placeholder="Enter your content topic, theme, or specific area of focus. For example: 'Web development tips and tutorials', 'Fitness motivation for beginners', or 'Sustainable lifestyle practices'..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => setStep(2)}
                  disabled={!topic.trim()}
                >
                  Continue to Brand Voice
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Step 2: Brand Voice Samples */}
        <TabsContent value="2" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Brand Voice Samples</CardTitle>
              <p className="text-sm text-muted-foreground">
                Add examples of your brand voice to help AI match your style
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sample Input */}
              <div className="space-y-4 p-4 border border-border rounded-md">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="sample-content">Sample Content</Label>
                    <textarea
                      id="sample-content"
                      className="w-full mt-2 p-3 border border-border rounded-md resize-none"
                      rows={3}
                      placeholder="Paste a sample post that represents your brand voice..."
                      value={newSample.content}
                      onChange={(e) => setNewSample({...newSample, content: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="sample-platform">Platform</Label>
                    <select
                      id="sample-platform"
                      className="w-full mt-2 p-3 border border-border rounded-md"
                      value={newSample.platform}
                      onChange={(e) => setNewSample({...newSample, platform: e.target.value as any})}
                    >
                      <option value="instagram">Instagram</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="twitter">Twitter</option>
                    </select>
                  </div>
                </div>
                <Button onClick={addBrandVoiceSample} disabled={!newSample.content.trim()}>
                  Add Sample
                </Button>
              </div>

              {/* Sample Preview Cards */}
              {brandVoiceSamples.length > 0 && (
                <div className="space-y-4">
                  <Separator />
                  <h3 className="font-medium">Brand Voice Samples ({brandVoiceSamples.length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {brandVoiceSamples.map((sample) => (
                      <Card key={sample.id}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs bg-accent px-2 py-1 rounded capitalize">
                              {sample.platform}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeSample(sample.id)}
                            >
                              ×
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {sample.content}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button onClick={() => setStep(3)}>
                  Continue to Configuration
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Step 3: Configuration */}
        <TabsContent value="3" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Step 3: Workflow Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="content-count">Number of Posts to Generate</Label>
                  <select
                    id="content-count"
                    className="w-full mt-2 p-3 border border-border rounded-md"
                    value={workflowConfig.contentCount}
                    onChange={(e) => setWorkflowConfig({
                      ...workflowConfig,
                      contentCount: parseInt(e.target.value)
                    })}
                  >
                    <option value={3}>3 posts</option>
                    <option value={5}>5 posts</option>
                    <option value={10}>10 posts</option>
                    <option value={15}>15 posts</option>
                  </select>
                </div>

                <div>
                  <Label>Target Platforms</Label>
                  <div className="mt-2 space-y-2">
                    {['instagram', 'linkedin', 'twitter'].map((platform) => (
                      <label key={platform} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={workflowConfig.platforms.includes(platform)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setWorkflowConfig({
                                ...workflowConfig,
                                platforms: [...workflowConfig.platforms, platform]
                              });
                            } else {
                              setWorkflowConfig({
                                ...workflowConfig,
                                platforms: workflowConfig.platforms.filter(p => p !== platform)
                              });
                            }
                          }}
                        />
                        <span className="capitalize">{platform}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={workflowConfig.schedulingEnabled}
                    onChange={(e) => setWorkflowConfig({
                      ...workflowConfig,
                      schedulingEnabled: e.target.checked
                    })}
                  />
                  <span>Enable automatic scheduling</span>
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  Content will be automatically scheduled for publishing
                </p>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button onClick={() => setStep(4)} disabled={workflowConfig.platforms.length === 0}>
                  Continue to Preview
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Step 4: Preview and Create */}
        <TabsContent value="4" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Step 4: Workflow Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium mb-2">Topic</h3>
                  <p className="text-sm text-muted-foreground p-3 bg-accent rounded-md">
                    {topic}
                  </p>
                </div>

                <div>
                  <h3 className="font-medium mb-2">Configuration</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>Posts:</strong> {workflowConfig.contentCount}</p>
                    <p><strong>Platforms:</strong> {workflowConfig.platforms.join(', ')}</p>
                    <p><strong>Scheduling:</strong> {workflowConfig.schedulingEnabled ? 'Enabled' : 'Disabled'}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">Brand Voice Samples</h3>
                <p className="text-sm text-muted-foreground">
                  {brandVoiceSamples.length} samples provided for brand voice analysis
                </p>
              </div>

              <Separator />

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(3)}>
                  Back
                </Button>
                <Button
                  onClick={handleCreateWorkflow}
                  className="px-8"
                >
                  Create Workflow
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}