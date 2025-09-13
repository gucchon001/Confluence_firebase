'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// モックユーザー型定義
interface MockUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

interface AuthContextType {
  user: MockUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// モックユーザーデータ
const mockUser: MockUser = {
  uid: 'mock-user-123',
  displayName: 'テストユーザー',
  email: 'test@example.com',
  photoURL: 'https://via.placeholder.com/150',
};

export function MockAuthProvider({ children }: { children: ReactNode }) {
  // ローカルストレージから初期状態を取得
  const getSavedUser = (): MockUser | null => {
    if (typeof window === 'undefined') return null;
    
    try {
      const savedUser = localStorage.getItem('mockAuthUser');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      console.error('Error parsing mockAuthUser from localStorage', e);
      return null;
    }
  };

  const [user, setUser] = useState<MockUser | null>(getSavedUser());
  const [loading, setLoading] = useState(false);

  // テスト用のFirebase Authモックを使用
  useEffect(() => {
    if (typeof window !== 'undefined' && window.mockFirebaseAuth) {
      // テスト環境では、モックのonAuthStateChangedを使用
      const unsubscribe = window.mockFirebaseAuth.onAuthStateChanged((mockUser) => {
        setUser(mockUser);
        setLoading(false);
      });
      return unsubscribe;
    }
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    
    // テスト環境ではモックのsignInWithPopupを使用
    if (typeof window !== 'undefined' && window.mockFirebaseAuth) {
      try {
        const result = await window.mockFirebaseAuth.signInWithPopup();
        setUser(result.user);
        // ローカルストレージに保存
        localStorage.setItem('mockAuthUser', JSON.stringify(result.user));
      } catch (error) {
        console.error('Mock sign in failed:', error);
      } finally {
        setLoading(false);
      }
      return;
    }
    
    // 通常の開発環境では1秒後にモックユーザーでログイン完了
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        setUser(mockUser);
        // ローカルストレージに保存
        localStorage.setItem('mockAuthUser', JSON.stringify(mockUser));
        setLoading(false);
        resolve();
      }, 1000);
    });
  };

  const signOut = async () => {
    setLoading(true);
    
    // テスト環境ではモックのsignOutを使用
    if (typeof window !== 'undefined' && window.mockFirebaseAuth) {
      try {
        await window.mockFirebaseAuth.signOut();
        setUser(null);
      } catch (error) {
        console.error('Mock sign out failed:', error);
      } finally {
        setLoading(false);
      }
      return;
    }
    
    // 通常の開発環境では0.5秒後にログアウト完了
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        setUser(null);
        // ローカルストレージから削除
        localStorage.removeItem('mockAuthUser');
        setLoading(false);
        resolve();
      }, 500);
    });
  };

  const value = { user, loading, signInWithGoogle, signOut };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useMockAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useMockAuth must be used within a MockAuthProvider');
  }
  return context;
};
