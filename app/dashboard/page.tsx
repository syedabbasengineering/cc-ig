'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { trpc } from '@/src/lib/trpc/client';
import Link from 'next/link';

export default function DashboardPage() {
  // Get current workspace
  const { data: workspaces } = trpc.workspace.list.useQuery();
  const workspaceId = workspaces?.[0]?.id;

  // Fetch workflows for the workspace
  const { data: workflows, isLoading: loadingWorkflows } = trpc.workflow.list.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId }
  );

  // Fetch recent content
  const { data: content } = trpc.content.list.useQuery(
    { workspaceId: workspaceId!, status: 'reviewing' },
    { enabled: !!workspaceId }
  );

  const activeWorkflows = workflows?.filter((w: any) => w.status === 'active')?.length || 0;
  const pendingContent = content?.length || 0;
  const publishedTodayCount = 0; // TODO: Add publishedAfter filter to content.list procedure

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your AI content automation workflows
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Workflows
            </CardTitle>
            <svg
              className="h-4 w-4 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M12 2v20m9-9H3" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeWorkflows}</div>
            <p className="text-xs text-muted-foreground">
              {activeWorkflows === 0 ? 'No workflows running' : 'workflows currently active'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Content Generated
            </CardTitle>
            <svg
              className="h-4 w-4 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14,2 14,8 20,8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10,9 9,9 8,9" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{content?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {content && content.length > 0 ? 'pieces of content generated' : 'Start your first workflow'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Review
            </CardTitle>
            <svg
              className="h-4 w-4 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingContent}</div>
            <p className="text-xs text-muted-foreground">
              {pendingContent === 0 ? 'No content awaiting review' : 'pieces awaiting review'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Published Today
            </CardTitle>
            <svg
              className="h-4 w-4 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M8 6l4-4 4 4" />
              <path d="M12 2v10.3a4 4 0 0 1-1.172 2.872L4 22" />
              <path d="M20 22l-6.828-6.828A4 4 0 0 1 12 12.3" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{publishedTodayCount}</div>
            <p className="text-xs text-muted-foreground">
              {publishedTodayCount === 0 ? 'No posts published today' : 'posts published today'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Workflows</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingWorkflows ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Loading workflows...</p>
              </div>
            ) : workflows && workflows.length > 0 ? (
              <div className="space-y-3">
                {workflows.slice(0, 5).map((workflow: any) => (
                  <Link
                    key={workflow.id}
                    href={`/dashboard/workflows/${workflow.id}`}
                    className="block p-3 border border-border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{workflow.name}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {workflow._count?.runs || 0} runs
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        workflow.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {workflow.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No workflows created yet</p>
                <p className="text-sm mt-2">
                  Create your first workflow to get started
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <p>No performance data available</p>
              <p className="text-sm mt-2">
                Metrics will appear after content is published
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}