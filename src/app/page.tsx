'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bot } from 'lucide-react';
import { AuthProviderWrapper, useAuthWrapper } from '@/hooks/use-auth-wrapper';
import ChatPage from '@/components/chat-page';

function HomeContent() {
  const { user, loading } = useAuthWrapper();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Bot className="h-12 w-12 animate-pulse text-primary" />
      </div>
    );
  }

  if (user) {
    return <ChatPage user={user} />;
  }

  return null;
}

export default function Home() {
  return (
    <AuthProviderWrapper>
      <HomeContent />
    </AuthProviderWrapper>
  );
}
