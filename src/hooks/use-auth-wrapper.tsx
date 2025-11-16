'use client';

import React, { ReactNode, useEffect, createContext, useContext } from 'react';
import { AuthProvider, useAuth } from './use-auth';
import { MockAuthProvider, useMockAuth } from './use-mock-auth';
import { initializeDefaultAdmin } from '@/scripts/initialize-default-admin';

// 環境変数またはブラウザのURLパラメータでモックモードを切り替え
const isUsingMockAuth = () => {
  // ブラウザ環境かどうかをチェック
  if (typeof window !== 'undefined') {
    // テスト用のグローバル変数が設定されていればモック認証を使用
    if (window.USE_MOCK_AUTH) {
      return true;
    }
    
    // URLパラメータで?mock=trueが指定されていればモック認証を使用
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mock') === 'true') {
      return true;
    }
    
    // ローカルストレージにmockAuthUserが設定されていればモック認証を使用
    if (localStorage.getItem('mockAuthUser')) {
      return true;
    }
  }
  
  // 環境変数でもモック認証の使用が指定されていればtrue
  return process.env.NEXT_PUBLIC_USE_MOCK_AUTH === 'true';
};

// 認証タイプを管理するコンテキスト
type AuthType = 'real' | 'mock';
const AuthTypeContext = createContext<AuthType>('real');

export function AuthProviderWrapper({ children }: { children: ReactNode }) {
  // モック認証を使用するかどうかを判定
  const useMock = isUsingMockAuth();
  const authType: AuthType = useMock ? 'mock' : 'real';
  
  // デフォルト管理者の初期化（実際の認証でのみ）
  useEffect(() => {
    if (!useMock) {
      initializeDefaultAdmin();
    }
  }, [useMock]);
  
  // React Hooksのルールに準拠するため、両方のプロバイダーを常に提供
  // ただし、authTypeに基づいて適切な方のみがアクティブに動作する
  return (
    <AuthTypeContext.Provider value={authType}>
      <AuthProvider>
        <MockAuthProvider>
          {children}
        </MockAuthProvider>
      </AuthProvider>
    </AuthTypeContext.Provider>
  );
}

// フックをエクスポート
export { useAuth } from './use-auth';
export { useMockAuth } from './use-mock-auth';

// 環境に応じて適切な認証フックを返す
// コンテキストを使用してどちらのプロバイダーがアクティブかを判断
export const useAuthWrapper = () => {
  const authType = useContext(AuthTypeContext);
  
  // React Hooksのルールに従い、両方のHooksを常に呼び出す
  // 両方のプロバイダーが常に提供されているため、エラーは発生しない
  const realAuth = useAuth();
  const mockAuth = useMockAuth();
  
  // コンテキストに基づいて適切な値を返す
  if (authType === 'mock') {
    return mockAuth;
  } else {
    return realAuth;
  }
};
