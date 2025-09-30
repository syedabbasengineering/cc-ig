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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { AppLayout } from '@/components/app-layout';

interface BrandVoiceSample {
  id: string;
  content: string;
  source: string;
  metadata?: {
    platform?: string;
    performance?: number;
    date?: string;
  };
  createdAt: string;
}

interface BrandVoiceAnalysis {
  tone: string[];
  style: string[];
  keywords: string[];
  commonPhrases: string[];
  sentimentScore: number;
  readabilityScore: number;
  avgWordsPerSentence: number;
  recommendations: string[];
}

interface Workspace {
  id: string;
  name: string;
  brandVoice?: {
    tone?: string;
    style?: string;
    keywords?: string[];
    guidelines?: string;
  };
}

export default function BrandVoicePage() {
  const { data: session } = useSession();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [samples, setSamples] = useState<BrandVoiceSample[]>([]);
  const [analysis, setAnalysis] = useState<BrandVoiceAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAddingContent, setIsAddingContent] = useState(false);

  // Form states
  const [newContent, setNewContent] = useState('');
  const [newSource, setNewSource] = useState('user_provided');
  const [newPlatform, setNewPlatform] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);

  useEffect(() => {
    if (session?.user?.id) {
      Promise.all([
        fetchWorkspace(),
        fetchSamples(),
        fetchAnalysis()
      ]);
    }
  }, [session]);

  const fetchWorkspace = async () => {
    try {
      const response = await fetch('/api/workspace');
      if (response.ok) {
        const data = await response.json();
        setWorkspace(data);
      }
    } catch (error) {
      console.error('Error fetching workspace:', error);
    }
  };

  const fetchSamples = async () => {
    try {
      const response = await fetch('/api/brand-voice/samples');
      if (response.ok) {
        const data = await response.json();
        setSamples(data);
      }
    } catch (error) {
      console.error('Error fetching samples:', error);
    }
  };

  const fetchAnalysis = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/brand-voice/analysis');
      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
      }
    } catch (error) {
      console.error('Error fetching analysis:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSample = async () => {
    if (!newContent.trim()) return;

    try {
      setIsAddingContent(true);
      const response = await fetch('/api/brand-voice/samples', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newContent.trim(),
          source: newSource,
          metadata: {
            platform: newPlatform.trim() || undefined,
            date: new Date().toISOString().split('T')[0]
          }
        }),
      });

      if (response.ok) {
        const newSample = await response.json();
        setSamples(prev => [newSample, ...prev]);
        setNewContent('');
        setNewPlatform('');
        setShowAddDialog(false);
        // Trigger re-analysis
        runAnalysis();
      }
    } catch (error) {
      console.error('Error adding sample:', error);
    } finally {
      setIsAddingContent(false);
    }
  };

  const handleDeleteSample = async (sampleId: string) => {
    if (!confirm('Are you sure you want to delete this sample?')) return;

    try {
      const response = await fetch(`/api/brand-voice/samples/${sampleId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSamples(prev => prev.filter(s => s.id !== sampleId));
        // Trigger re-analysis
        runAnalysis();
      }
    } catch (error) {
      console.error('Error deleting sample:', error);
    }
  };

  const runAnalysis = async () => {
    try {
      setIsAnalyzing(true);
      const response = await fetch('/api/brand-voice/analyze', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
      }
    } catch (error) {
      console.error('Error running analysis:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSentimentColor = (score: number) => {
    if (score > 0.1) return 'text-green-600 bg-green-50 border-green-200';
    if (score < -0.1) return 'text-red-600 bg-red-50 border-red-200';
    return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  };

  const getReadabilityGrade = (score: number) => {
    if (score >= 80) return { grade: 'Very Easy', color: 'text-green-600' };
    if (score >= 70) return { grade: 'Easy', color: 'text-green-500' };
    if (score >= 60) return { grade: 'Standard', color: 'text-yellow-600' };
    if (score >= 50) return { grade: 'Difficult', color: 'text-orange-600' };
    return { grade: 'Very Difficult', color: 'text-red-600' };
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Analyzing brand voice...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Brand Voice Dashboard</h1>
            <p className="text-muted-foreground">
              Analyze and manage your brand's voice and tone across all content.
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Sample
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add Brand Voice Sample</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="content">Content</Label>
                    <Textarea
                      id="content"
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      placeholder="Paste your content here..."
                      rows={8}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="source">Source</Label>
                      <select
                        id="source"
                        value={newSource}
                        onChange={(e) => setNewSource(e.target.value)}
                        className="w-full p-2 border border-border rounded-md"
                      >
                        <option value="user_provided">User Provided</option>
                        <option value="approved_content">Approved Content</option>
                        <option value="external_url">External URL</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="platform">Platform (Optional)</Label>
                      <Input
                        id="platform"
                        value={newPlatform}
                        onChange={(e) => setNewPlatform(e.target.value)}
                        placeholder="e.g., Instagram, LinkedIn"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddSample} disabled={isAddingContent || !newContent.trim()}>
                      {isAddingContent ? 'Adding...' : 'Add Sample'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              onClick={runAnalysis}
              disabled={isAnalyzing || samples.length === 0}
            >
              {isAnalyzing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Re-analyze
                </>
              )}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
            <TabsTrigger value="samples">Samples ({samples.length})</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Samples</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{samples.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Sentiment Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${analysis ? getSentimentColor(analysis.sentimentScore).split(' ')[0] : ''}`}>
                    {analysis ? (analysis.sentimentScore * 100).toFixed(1) : '--'}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Readability</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${analysis ? getReadabilityGrade(analysis.readabilityScore).color : ''}`}>
                    {analysis ? getReadabilityGrade(analysis.readabilityScore).grade : '--'}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Avg Words/Sentence</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analysis ? analysis.avgWordsPerSentence.toFixed(1) : '--'}
                  </div>
                </CardContent>
              </Card>
            </div>

            {workspace?.brandVoice && (
              <Card>
                <CardHeader>
                  <CardTitle>Current Brand Voice Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Tone</Label>
                      <p className="text-sm text-muted-foreground">{workspace.brandVoice.tone || 'Not set'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Style</Label>
                      <p className="text-sm text-muted-foreground">{workspace.brandVoice.style || 'Not set'}</p>
                    </div>
                  </div>
                  {workspace.brandVoice.keywords && workspace.brandVoice.keywords.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium">Keywords</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {workspace.brandVoice.keywords.map((keyword, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {workspace.brandVoice.guidelines && (
                    <div>
                      <Label className="text-sm font-medium">Guidelines</Label>
                      <p className="text-sm text-muted-foreground mt-1">{workspace.brandVoice.guidelines}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="analysis" className="space-y-6">
            {analysis ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Detected Tone</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {analysis.tone.map((tone, index) => (
                          <Badge key={index} variant="outline">
                            {tone}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Writing Style</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {analysis.style.map((style, index) => (
                          <Badge key={index} variant="outline">
                            {style}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Sentiment Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getSentimentColor(analysis.sentimentScore)}`}>
                      Score: {(analysis.sentimentScore * 100).toFixed(1)}%
                      {analysis.sentimentScore > 0.1 ? ' (Positive)' :
                       analysis.sentimentScore < -0.1 ? ' (Negative)' : ' (Neutral)'}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Keywords</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {analysis.keywords.map((keyword, index) => (
                        <Badge key={index} variant="secondary">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Common Phrases</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {analysis.commonPhrases.map((phrase, index) => (
                        <div key={index} className="text-sm bg-muted p-2 rounded">
                          "{phrase}"
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No analysis available yet.</p>
                  <Button onClick={runAnalysis} disabled={samples.length === 0}>
                    Run Analysis
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="samples" className="space-y-6">
            {samples.length > 0 ? (
              <div className="space-y-4">
                {samples.map((sample) => (
                  <Card key={sample.id}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-2">
                          <Badge variant={sample.source === 'user_provided' ? 'default' : 'secondary'}>
                            {sample.source.replace('_', ' ')}
                          </Badge>
                          {sample.metadata?.platform && (
                            <Badge variant="outline">
                              {sample.metadata.platform}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSample(sample.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-wrap">{sample.content}</p>
                      <Separator className="my-3" />
                      <p className="text-xs text-muted-foreground">
                        Added {new Date(sample.createdAt).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No voice samples added yet.</p>
                  <Button onClick={() => setShowAddDialog(true)}>
                    Add Your First Sample
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-6">
            {analysis?.recommendations ? (
              <div className="space-y-4">
                {analysis.recommendations.map((recommendation, index) => (
                  <Card key={index}>
                    <CardContent className="pt-6">
                      <p className="text-sm">{recommendation}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    Add more voice samples and run analysis to get personalized recommendations.
                  </p>
                  <Button onClick={() => setShowAddDialog(true)}>
                    Add Voice Sample
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}