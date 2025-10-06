'use client';

import { useEffect } from 'react';
import { globalErrorHandler } from '@/lib/global-error-handler';

interface ErrorHandlerProviderProps {
  children: React.ReactNode;
}

export function ErrorHandlerProvider({ children }: ErrorHandlerProviderProps) {
  useEffect(() => {
    // クライアントサイドでエラーハンドラーを初期化
    globalErrorHandler.init();
    
    console.log('[ErrorHandlerProvider] Global error handler initialized');
  }, []);

  return <>{children}</>;
}
