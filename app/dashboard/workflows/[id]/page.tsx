'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface WorkflowData {
  id: string;
  name: string;
  topic: string;
  brandVoiceSamples: any[];
  config: any;
  createdAt: string;
}

interface WorkflowRun {
  id: string;
  status: 'pending' | 'scraping' | 'analyzing' | 'generating' | 'reviewing' | 'published' | 'failed';
  startedAt: string;
  completedAt?: string;
  progress: number;
  currentStage: string;
  stageDetails: string;
}

export default function WorkflowExecutionPage() {
  const params = useParams();
  const workflowId = params.id as string;
  const [workflow, setWorkflow] = useState<WorkflowData | null>(null);
  const [currentRun, setCurrentRun] = useState<WorkflowRun | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [realTimeUpdates, setRealTimeUpdates] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('connected');
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Load workflow data from localStorage (demo)
    const demoWorkflow = localStorage.getItem('demo-workflow');
    if (demoWorkflow) {
      const workflowData = JSON.parse(demoWorkflow);
      if (workflowData.id === workflowId) {
        setWorkflow(workflowData);
      }
    }

    // For demo purposes, if no workflow found, create a mock one
    if (!demoWorkflow) {
      const mockWorkflow = {
        id: workflowId,
        name: 'Demo Content Workflow',
        topic: 'AI and Technology',
        brandVoiceSamples: [],
        config: { contentCount: 5, platforms: ['instagram'] },
        createdAt: new Date().toISOString(),
      };
      setWorkflow(mockWorkflow);
    }

    // Start real-time polling if enabled
    if (realTimeUpdates) {
      startRealtimePolling();
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [workflowId, realTimeUpdates]); // Note: startRealtimePolling is intentionally not in deps to avoid infinite loops

  const startRealtimePolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(() => {
      // Simulate checking for workflow updates
      pollWorkflowStatus();
    }, 2000); // Poll every 2 seconds
  };

  const pollWorkflowStatus = () => {
    // Simulate API call to check workflow status
    try {
      setConnectionStatus('connected');

      // Check if there's a stored run in progress
      const storedRun = localStorage.getItem(`workflow-run-${workflowId}`);
      if (storedRun) {
        const runData = JSON.parse(storedRun);
        setCurrentRun(runData);

        // If run is completed, stop polling
        if (runData.status === 'published' || runData.status === 'failed') {
          setIsRunning(false);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
        }
      }
    } catch (error) {
      setConnectionStatus('error');
      console.error('Failed to poll workflow status:', error);
    }
  };

  const toggleRealTimeUpdates = () => {
    setRealTimeUpdates(!realTimeUpdates);
    if (!realTimeUpdates) {
      startRealtimePolling();
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    }
  };

  const startWorkflow = () => {
    setIsRunning(true);
    const newRun: WorkflowRun = {
      id: 'run-' + Date.now(),
      status: 'scraping',
      startedAt: new Date().toISOString(),
      progress: 0,
      currentStage: 'Instagram Scraping',
      stageDetails: 'Collecting trending content from Instagram...',
    };
    setCurrentRun(newRun);

    // Simulate workflow progress
    simulateWorkflowProgress(newRun);
  };

  const simulateWorkflowProgress = (run: WorkflowRun) => {
    const stages = [
      { status: 'scraping', stage: 'Instagram Scraping', details: 'Collecting trending content from Instagram...', progress: 20 },
      { status: 'analyzing', stage: 'Content Analysis', details: 'Analyzing engagement patterns and trends...', progress: 40 },
      { status: 'generating', stage: 'AI Content Generation', details: 'Generating content ideas and captions...', progress: 70 },
      { status: 'reviewing', stage: 'Content Review', details: 'Content ready for review and approval...', progress: 90 },
      { status: 'published', stage: 'Completed', details: 'Workflow completed successfully!', progress: 100 },
    ];

    let currentStageIndex = 0;

    const progressInterval = setInterval(() => {
      if (currentStageIndex < stages.length) {
        const stage = stages[currentStageIndex];
        const updatedRun = {
          ...run,
          status: stage.status as any,
          currentStage: stage.stage,
          stageDetails: stage.details,
          progress: stage.progress,
          completedAt: stage.status === 'published' ? new Date().toISOString() : undefined,
        };

        // Store in localStorage for real-time polling
        localStorage.setItem(`workflow-run-${workflowId}`, JSON.stringify(updatedRun));

        setCurrentRun(updatedRun);
        currentStageIndex++;
      } else {
        setIsRunning(false);
        clearInterval(progressInterval);
      }
    }, 3000); // Update every 3 seconds for demo
  };

  if (!workflow) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{workflow.name}</h1>
          <p className="text-muted-foreground">
            Created {new Date(workflow.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {/* Real-time Status Indicator */}
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500' :
              connectionStatus === 'error' ? 'bg-red-500' : 'bg-gray-500'
            }`} />
            <span className="text-muted-foreground">
              {connectionStatus === 'connected' ? 'Live' :
               connectionStatus === 'error' ? 'Error' : 'Offline'}
            </span>
          </div>

          {/* Real-time Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleRealTimeUpdates}
          >
            {realTimeUpdates ? '🔴 Live' : '⚫ Paused'}
          </Button>

          <Button
            onClick={startWorkflow}
            disabled={isRunning}
            size="lg"
          >
            {isRunning ? 'Running...' : 'Start Workflow'}
          </Button>
        </div>
      </div>

      {/* Workflow Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h3 className="font-medium mb-1">Topic</h3>
              <p className="text-sm text-muted-foreground">{workflow.topic}</p>
            </div>
            <div>
              <h3 className="font-medium mb-1">Content Count</h3>
              <p className="text-sm text-muted-foreground">{workflow.config.contentCount} posts</p>
            </div>
            <div>
              <h3 className="font-medium mb-1">Platforms</h3>
              <p className="text-sm text-muted-foreground">{workflow.config.platforms.join(', ')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Run Status */}
      {currentRun && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Workflow Progress
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                currentRun.status === 'published' ? 'bg-green-100 text-green-800' :
                currentRun.status === 'failed' ? 'bg-red-100 text-red-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {currentRun.status.toUpperCase()}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>{currentRun.currentStage}</span>
                <span>{currentRun.progress}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${currentRun.progress}%` }}
                ></div>
              </div>
            </div>

            {/* Stage Details */}
            <p className="text-sm text-muted-foreground">{currentRun.stageDetails}</p>

            {/* Stage Visualization */}
            <div className="grid grid-cols-5 gap-2">
              {['Scraping', 'Analyzing', 'Generating', 'Reviewing', 'Published'].map((stage, index) => {
                const isActive = currentRun.progress > index * 20;
                const isCurrent = currentRun.currentStage.includes(stage);

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

            {/* Timing */}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Started: {new Date(currentRun.startedAt).toLocaleTimeString()}</span>
              {currentRun.completedAt && (
                <span>Completed: {new Date(currentRun.completedAt).toLocaleTimeString()}</span>
              )}
            </div>

            {/* Real-time Activity Feed */}
            {realTimeUpdates && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Live Activity Feed
                </h3>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  <div className="text-xs text-muted-foreground flex justify-between">
                    <span>⚡ Real-time updates active</span>
                    <span>{new Date().toLocaleTimeString()}</span>
                  </div>
                  <div className="text-xs text-muted-foreground flex justify-between">
                    <span>📊 Monitoring workflow progress</span>
                    <span>Every 2s</span>
                  </div>
                  {currentRun.status === 'scraping' && (
                    <div className="text-xs text-blue-600 flex justify-between">
                      <span>🔍 Scraping Instagram content...</span>
                      <span>{new Date().toLocaleTimeString()}</span>
                    </div>
                  )}
                  {currentRun.status === 'analyzing' && (
                    <div className="text-xs text-purple-600 flex justify-between">
                      <span>🧠 AI analyzing engagement patterns...</span>
                      <span>{new Date().toLocaleTimeString()}</span>
                    </div>
                  )}
                  {currentRun.status === 'generating' && (
                    <div className="text-xs text-orange-600 flex justify-between">
                      <span>✨ Generating content ideas...</span>
                      <span>{new Date().toLocaleTimeString()}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs for different views */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="content">Generated Content</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Brand Voice Samples</CardTitle>
              </CardHeader>
              <CardContent>
                {workflow.brandVoiceSamples.length > 0 ? (
                  <div className="space-y-3">
                    {workflow.brandVoiceSamples.map((sample, index) => (
                      <div key={index} className="p-3 bg-accent rounded-md">
                        <span className="text-xs bg-background px-2 py-1 rounded mb-2 inline-block">
                          {sample.platform}
                        </span>
                        <p className="text-sm">{sample.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No brand voice samples provided</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {currentRun ? (
                    <div className="text-sm">
                      <p className="font-medium">Workflow Started</p>
                      <p className="text-muted-foreground">
                        {new Date(currentRun.startedAt).toLocaleString()}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No recent activity</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generated Content</CardTitle>
            </CardHeader>
            <CardContent>
              {currentRun?.status === 'reviewing' || currentRun?.status === 'published' ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((index) => (
                    <div key={index} className="p-4 border border-border rounded-lg">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-medium">Post {index}</h3>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">Edit</Button>
                          <Button size="sm">Approve</Button>
                        </div>
                      </div>
                      <p className="text-sm mb-2">
                        🚀 Exciting developments in AI technology are reshaping how we work...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        #AI #Technology #Innovation #Future
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  Content will appear here once the AI generation stage completes
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Processing Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currentRun?.completedAt
                    ? Math.round((new Date(currentRun.completedAt).getTime() - new Date(currentRun.startedAt).getTime()) / 1000) + 's'
                    : '--'
                  }
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Content Generated</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currentRun?.status === 'published' ? workflow.config.contentCount : '--'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currentRun?.status === 'published' ? '100%' : '--'}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}