'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProviderWrapper, useAuthWrapper } from '@/hooks/use-auth-wrapper';
import ChatPage from '@/components/chat-page';
import { Bot } from 'lucide-react';

function HomeContent() {
  const { user, loading } = useAuthWrapper();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Bot className="h-12 w-12 animate-pulse text-primary" />
      </div>
    );
  }

  return user ? <ChatPage user={user} /> : null;
}

export default function Home() {
  return (
    <AuthProviderWrapper>
      <HomeContent />
    </AuthProviderWrapper>
  );
}