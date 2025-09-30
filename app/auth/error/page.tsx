'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case 'Configuration':
        return 'There is a problem with the server configuration.';
      case 'AccessDenied':
        return 'Access denied. You do not have permission to access this resource.';
      case 'Verification':
        return 'The verification token has expired or has already been used.';
      case 'OAuthSignin':
      case 'OAuthCallback':
      case 'OAuthCreateAccount':
      case 'EmailCreateAccount':
      case 'Callback':
        return 'There was an error with the authentication provider.';
      case 'OAuthAccountNotLinked':
        return 'This account is not linked. Please sign in with your original provider.';
      case 'EmailSignin':
        return 'Unable to send email. Please try again.';
      case 'CredentialsSignin':
        return 'Invalid credentials. Please check your email and password.';
      case 'SessionRequired':
        return 'You must be signed in to access this page.';
      default:
        return 'An authentication error occurred. Please try again.';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-red-600">Authentication Error</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <div className="p-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
            {getErrorMessage(error)}
          </div>

          <div className="space-y-2">
            <Button
              className="w-full"
              onClick={() => window.location.href = '/auth/signin'}
            >
              Try Again
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.location.href = '/'}
            >
              Go Home
            </Button>
          </div>

          {error === 'CredentialsSignin' && (
            <div className="text-sm text-muted-foreground">
              <p>Demo credentials:</p>
              <p>Email: demo@taskmaster.ai</p>
              <p>Password: demo123</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  );
}