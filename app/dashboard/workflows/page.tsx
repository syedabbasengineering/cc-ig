'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function WorkflowsPage() {
  // For now, showing empty state to avoid tRPC type complexity
  const workflows: any[] = [];
  const isLoading = false;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Workflows</h1>
          <p className="text-muted-foreground">
            Manage your AI content generation workflows
          </p>
        </div>
        <Button asChild>
          <a href="/dashboard/workflows/new">Create New Workflow</a>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent className="animate-pulse">
                <div className="h-3 bg-muted rounded w-full mb-2"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : workflows && workflows.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workflows.map((workflow) => (
            <Card key={workflow.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">{workflow.name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Created {new Date(workflow.createdAt).toLocaleDateString()}
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p><strong>Status:</strong> {workflow.status}</p>
                  <p><strong>Topic:</strong> {(workflow.config as any)?.topic || 'N/A'}</p>
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" asChild>
                      <a href={`/dashboard/workflows/${workflow.id}`}>
                        View Details
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <h3 className="text-lg font-medium mb-2">No workflows yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first workflow to start generating AI-powered content
            </p>
            <Button asChild>
              <a href="/dashboard/workflows/new">Create First Workflow</a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}