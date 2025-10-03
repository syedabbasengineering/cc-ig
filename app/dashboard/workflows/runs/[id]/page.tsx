'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/src/lib/trpc/client';

export default function WorkflowRunPage() {
  const params = useParams();
  const runId = params.id as string;
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch workflow run status
  const { data: run, refetch } = trpc.workflow.getRunStatus.useQuery(
    { runId },
    {
      refetchInterval: autoRefresh ? 2000 : false, // Poll every 2 seconds if auto-refresh is on
    }
  );

  if (!run) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  const isComplete = run.status === 'reviewing' || run.status === 'published' || run.status === 'failed';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Workflow Run: {run.workflow.name}
          </h1>
          <p className="text-muted-foreground">
            Topic: {run.topic}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${
              autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
            }`} />
            <span className="text-muted-foreground">
              {autoRefresh ? 'Live' : 'Paused'}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? '🔴 Live' : '⚫ Paused'}
          </Button>
        </div>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Workflow Progress
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              run.status === 'published' || run.status === 'reviewing' ? 'bg-green-100 text-green-800' :
              run.status === 'failed' ? 'bg-red-100 text-red-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {run.status.toUpperCase()}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress stages */}
          <div className="grid grid-cols-5 gap-2">
            {['pending', 'scraping', 'analyzing', 'generating', 'reviewing'].map((stage) => {
              const stages = ['pending', 'scraping', 'analyzing', 'generating', 'reviewing', 'published'];
              const currentIndex = stages.indexOf(run.status);
              const stageIndex = stages.indexOf(stage);
              const isActive = stageIndex <= currentIndex;
              const isCurrent = stage === run.status;

              return (
                <div
                  key={stage}
                  className={`p-3 rounded-md text-center text-xs font-medium ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : isCurrent
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {stage}
                </div>
              );
            })}
          </div>

          {!isComplete && (
            <p className="text-sm text-muted-foreground">
              The AI agents are working on your content. This may take 2-5 minutes depending on complexity.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="content" className="space-y-4">
        <TabsList>
          <TabsTrigger value="content">Generated Content</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generated Content</CardTitle>
            </CardHeader>
            <CardContent>
              {run.status === 'failed' ? (
                <div className="text-center py-8">
                  <p className="text-lg font-semibold text-red-600 mb-2">Oops, something went wrong...</p>
                  <p className="text-sm text-muted-foreground">
                    The AI workflow encountered an error. Please try again.
                  </p>
                </div>
              ) : run.contents && run.contents.length > 0 ? (
                <div className="space-y-4">
                  {run.contents.map((content: any, index: number) => (
                    <div key={content.id} className="p-4 border border-border rounded-lg">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-medium">Post {index + 1}</h3>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">Edit</Button>
                          <Button size="sm">Approve</Button>
                        </div>
                      </div>
                      <p className="text-sm mb-2 whitespace-pre-wrap">
                        {typeof content.content === 'object' && content.content !== null
                          ? (content.content as any).caption || (content.content as any).hook || 'No caption'
                          : String(content.content)}
                      </p>
                      {typeof content.content === 'object' && content.content !== null && (content.content as any).hashtags && (
                        <p className="text-xs text-muted-foreground">
                          {Array.isArray((content.content as any).hashtags)
                            ? (content.content as any).hashtags.join(' ')
                            : ''}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : isComplete ? (
                <p className="text-center py-8 text-muted-foreground">
                  No content generated. Check the workflow status above.
                </p>
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  ⏳ AI agents are generating content about "{run.topic}"... Please wait.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Workflow Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-medium mb-1">Topic</h3>
                <p className="text-sm text-muted-foreground">{run.topic}</p>
              </div>
              <div>
                <h3 className="font-medium mb-1">Workspace</h3>
                <p className="text-sm text-muted-foreground">{run.workflow.workspace.name}</p>
              </div>
              <div>
                <h3 className="font-medium mb-1">Started At</h3>
                <p className="text-sm text-muted-foreground">
                  {new Date(run.startedAt).toLocaleString()}
                </p>
              </div>
              {run.completedAt && (
                <div>
                  <h3 className="font-medium mb-1">Completed At</h3>
                  <p className="text-sm text-muted-foreground">
                    {new Date(run.completedAt).toLocaleString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
