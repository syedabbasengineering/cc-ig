'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { AppLayout } from '@/components/app-layout';

interface ContentEdit {
  id: string;
  fieldEdited: string;
  originalText: string;
  editedText: string;
  editReason?: string;
  createdAt: string;
  content: {
    platform: string;
    type: string;
  };
}

interface LearningInsight {
  category: string;
  insight: string;
  confidence: number;
  examples: string[];
  frequency: number;
}

interface LearningStats {
  totalEdits: number;
  avgEditsPerContent: number;
  mostEditedField: string;
  improvementTrend: 'improving' | 'stable' | 'declining';
  learningScore: number;
}

export default function LearningHistoryPage() {
  const { data: session } = useSession();
  const [edits, setEdits] = useState<ContentEdit[]>([]);
  const [insights, setInsights] = useState<LearningInsight[]>([]);
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState('30d');

  useEffect(() => {
    if (session?.user?.id) {
      Promise.all([
        fetchEdits(),
        fetchInsights(),
        fetchStats()
      ]).finally(() => setIsLoading(false));
    }
  }, [session, selectedTimeframe]);

  const fetchEdits = async () => {
    try {
      const response = await fetch(`/api/learning/edits?timeframe=${selectedTimeframe}`);
      if (response.ok) {
        const data = await response.json();
        setEdits(data);
      }
    } catch (error) {
      console.error('Error fetching edits:', error);
    }
  };

  const fetchInsights = async () => {
    try {
      const response = await fetch(`/api/learning/insights?timeframe=${selectedTimeframe}`);
      if (response.ok) {
        const data = await response.json();
        setInsights(data);
      }
    } catch (error) {
      console.error('Error fetching insights:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`/api/learning/stats?timeframe=${selectedTimeframe}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-50 border-green-200';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <span className="text-green-600">↗</span>;
      case 'stable':
        return <span className="text-yellow-600">→</span>;
      case 'declining':
        return <span className="text-red-600">↘</span>;
      default:
        return <span className="text-gray-600">−</span>;
    }
  };

  const formatEditType = (field: string) => {
    return field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1');
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Analyzing learning patterns...</p>
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
            <h1 className="text-3xl font-bold">Learning History</h1>
            <p className="text-muted-foreground">
              Track how the AI learns from your edits and preferences over time.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value)}
              className="px-3 py-2 border border-border rounded-md"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 3 Months</option>
              <option value="1y">Last Year</option>
            </select>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Edits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalEdits}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Learning Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.learningScore}%</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Most Edited</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-medium">{formatEditType(stats.mostEditedField)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-lg font-medium">
                  {getTrendIcon(stats.improvementTrend)}
                  <span className="ml-2 capitalize">{stats.improvementTrend}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="insights" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="insights">Learning Insights</TabsTrigger>
            <TabsTrigger value="edits">Edit History ({edits.length})</TabsTrigger>
            <TabsTrigger value="patterns">Patterns</TabsTrigger>
          </TabsList>

          <TabsContent value="insights" className="space-y-6">
            {insights.length > 0 ? (
              <div className="space-y-4">
                {insights.map((insight, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{insight.category}</CardTitle>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge
                              variant="outline"
                              className={getConfidenceColor(insight.confidence)}
                            >
                              {getConfidenceLabel(insight.confidence)} Confidence
                            </Badge>
                            <Badge variant="secondary">
                              {insight.frequency} times observed
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm">{insight.insight}</p>

                      {insight.examples.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Examples:</h4>
                          <div className="space-y-2">
                            {insight.examples.map((example, idx) => (
                              <div key={idx} className="text-xs bg-muted p-2 rounded">
                                {example}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    No learning insights available yet.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Edit more content to help the AI learn your preferences.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="edits" className="space-y-6">
            {edits.length > 0 ? (
              <div className="space-y-4">
                {edits.map((edit) => (
                  <Card key={edit.id}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-2">
                          <Badge variant="outline">
                            {formatEditType(edit.fieldEdited)}
                          </Badge>
                          <Badge variant="secondary">
                            {edit.content.platform}
                          </Badge>
                          <Badge variant="secondary">
                            {edit.content.type}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(edit.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <h4 className="text-sm font-medium text-red-600 mb-1">Original:</h4>
                        <p className="text-sm bg-red-50 p-2 rounded border border-red-200">
                          {edit.originalText}
                        </p>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-green-600 mb-1">Edited:</h4>
                        <p className="text-sm bg-green-50 p-2 rounded border border-green-200">
                          {edit.editedText}
                        </p>
                      </div>

                      {edit.editReason && (
                        <div>
                          <h4 className="text-sm font-medium mb-1">Reason:</h4>
                          <p className="text-sm text-muted-foreground italic">
                            "{edit.editReason}"
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No edit history found.</p>
                  <p className="text-sm text-muted-foreground">
                    Start creating and editing content to build your learning history.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="patterns" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Edit Frequency by Field</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {['caption', 'hook', 'hashtags', 'cta'].map((field) => {
                      const fieldEdits = edits.filter(e => e.fieldEdited === field);
                      const percentage = edits.length > 0 ? (fieldEdits.length / edits.length) * 100 : 0;

                      return (
                        <div key={field} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>{formatEditType(field)}</span>
                            <span>{fieldEdits.length} edits</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Platform Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {['instagram', 'linkedin', 'twitter'].map((platform) => {
                      const platformEdits = edits.filter(e => e.content.platform === platform);
                      const percentage = edits.length > 0 ? (platformEdits.length / edits.length) * 100 : 0;

                      return (
                        <div key={platform} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="capitalize">{platform}</span>
                            <span>{platformEdits.length} edits</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="bg-secondary h-2 rounded-full"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {stats && (
              <Card>
                <CardHeader>
                  <CardTitle>Learning Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>AI Learning Score</span>
                        <span>{stats.learningScore}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3">
                        <div
                          className="bg-primary h-3 rounded-full"
                          style={{ width: `${stats.learningScore}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      <p>
                        Based on your editing patterns, the AI is learning your preferences
                        and should require fewer edits over time.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}