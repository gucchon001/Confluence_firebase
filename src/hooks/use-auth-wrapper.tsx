'use client';

import React, { ReactNode } from 'react';
import { AuthProvider } from './use-auth';
import { MockAuthProvider } from './use-mock-auth';

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

export function AuthProviderWrapper({ children }: { children: ReactNode }) {
  // モック認証を使用するかどうかを判定
  const useMock = isUsingMockAuth();
  
  // 適切な認証プロバイダーでラップ
  return useMock ? (
    <MockAuthProvider>{children}</MockAuthProvider>
  ) : (
    <AuthProvider>{children}</AuthProvider>
  );
}

// フックをエクスポート
export { useAuth } from './use-auth';
export { useMockAuth } from './use-mock-auth';

// 環境に応じて適切な認証フックを返す
export const useAuthWrapper = () => {
  const useMock = isUsingMockAuth();
  
  // 適切なフックを動的にインポート
  if (useMock) {
    // ESLintエラーを避けるためにrequireではなく直接インポート
    const { useMockAuth } = require('./use-mock-auth');
    return useMockAuth();
  } else {
    const { useAuth } = require('./use-auth');
    return useAuth();
  }
};
