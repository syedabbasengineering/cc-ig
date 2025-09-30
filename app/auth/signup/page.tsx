'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Join Taskmaster</CardTitle>
          <p className="text-muted-foreground">
            Start automating your content creation
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Demo Notice */}
          <div className="p-4 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-md text-center">
            <p className="font-medium mb-2">Demo Version</p>
            <p className="mb-3">
              Registration is currently disabled in demo mode.
              Use the demo credentials to explore the platform:
            </p>
            <div className="bg-white p-2 rounded border text-left">
              <p><strong>Email:</strong> demo@taskmaster.ai</p>
              <p><strong>Password:</strong> demo123</p>
            </div>
          </div>

          <Button
            className="w-full"
            onClick={() => window.location.href = '/auth/signin'}
          >
            Go to Sign In
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            <p>
              Already have an account?{' '}
              <a href="/auth/signin" className="text-primary hover:underline">
                Sign in
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}