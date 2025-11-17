'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, ChromeIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthProviderWrapper, useAuthWrapper } from '@/hooks/use-auth-wrapper';
import { showErrorToast, handleNetworkError } from '@/lib/toast-helpers';

// Disable static generation for this page
export const dynamic = 'force-dynamic';

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg role="img" viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.02-2.62 1.62-4.55 1.62-3.83 0-6.95-3.12-6.95-6.95s3.12-6.95 6.95-6.95c2.21 0 3.63.85 4.5 1.68l2.5-2.5C17.96 3.06 15.49 2 12.48 2c-5.54 0-10 4.46-10 10s4.46 10 10 10c5.19 0 9.59-3.79 9.59-9.82 0-.74-.06-1.25-.16-1.73l-9.43-.01z"
      />
    </svg>
  );

function LoginContent() {
  const { user, loading, signInWithGoogle } = useAuthWrapper();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
      router.push('/');
    } catch (error) {
      console.error('Sign in failed:', error);
      if (!handleNetworkError(error)) {
        showErrorToast('unauthorized', 'ログインに失敗しました。もう一度お試しください。');
      }
    }
  };

  if (loading || user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Bot className="h-12 w-12 animate-pulse text-primary" />
      </div>
    );
  }

  return (
    <main className="flex h-full w-full items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">JUKUST Confluence Spec Jira Development Status Chat</CardTitle>
          <CardDescription>Sign in to access your Confluence specifications, Jira issues, and development status</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleSignIn}
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
            size="lg"
          >
            <GoogleIcon className="mr-2 h-5 w-5" />
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <AuthProviderWrapper>
      <LoginContent />
    </AuthProviderWrapper>
  );
}
