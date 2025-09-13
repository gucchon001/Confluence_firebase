import { Page } from '@playwright/test';

// ログイン状態をモックするヘルパー関数
export async function mockAuthState(page: Page, isLoggedIn: boolean = true) {
  // Firebase初期化前にモック設定を注入
  await page.addInitScript(() => {
    // Firebase認証エラーを防ぐためのモック設定
    window.FIREBASE_CONFIG = {
      apiKey: "test-api-key",
      authDomain: "test-project.firebaseapp.com",
      projectId: "test-project",
      storageBucket: "test-project.appspot.com",
      messagingSenderId: "123456789012",
      appId: "1:123456789012:web:abc123def456"
    };
    
    // モック認証を有効化するフラグを設定
    window.USE_MOCK_AUTH = true;
    
    // URLパラメータにmock=trueを追加
    const url = new URL(window.location.href);
    url.searchParams.set('mock', 'true');
    window.history.replaceState({}, '', url.toString());
    
    if (isLoggedIn) {
      // ログイン済み状態をモック
      localStorage.setItem('mockAuthUser', JSON.stringify({
        uid: 'mock-user-123',
        displayName: 'テストユーザー',
        email: 'test@example.com',
        photoURL: 'https://via.placeholder.com/150'
      }));
    } else {
      // 未ログイン状態をモック
      localStorage.removeItem('mockAuthUser');
    }
    
    // Firebase Auth SDKをモック
    window.mockFirebaseAuth = {
      onAuthStateChanged: (callback) => {
        if (isLoggedIn) {
          const mockUser = JSON.parse(localStorage.getItem('mockAuthUser') || '{}');
          callback(mockUser);
        } else {
          callback(null);
        }
        return () => {}; // unsubscribe関数
      },
      signInWithPopup: () => Promise.resolve({ user: JSON.parse(localStorage.getItem('mockAuthUser') || '{}') }),
      signOut: () => {
        localStorage.removeItem('mockAuthUser');
        return Promise.resolve();
      }
    };
  });
}

// チャットサービスをモックするヘルパー関数
export async function mockChatService(page: Page) {
  await page.addInitScript(() => {
    // グローバル変数としてモックデータを定義
    window.__mockMessages = [
      {
        id: '1',
        content: '求人詳細機能の仕様について教えてください',
        role: 'user',
        createdAt: '2023-10-01T10:00:00Z',
        userId: 'mock-user-123',
        user: {
          uid: 'mock-user-123',
          displayName: 'テストユーザー',
          email: 'test@example.com',
          photoURL: 'https://via.placeholder.com/150',
        }
      },
      {
        id: '2',
        content: '求人詳細機能は、主に以下の3つの主要コンポーネントで構成されています：\n\n1. 求人情報の表示エリア\n2. 応募ボタンと関連アクション\n3. 関連求人の表示セクション',
        role: 'assistant',
        createdAt: '2023-10-01T10:00:30Z',
        userId: 'mock-user-123',
        sources: [
          {
            title: '[PROJ-123] 求人詳細画面仕様書',
            url: 'https://example.atlassian.net/wiki/spaces/PROJ/pages/123456/job-detail-spec'
          },
          {
            title: '[ARCH-45] 求人データモデル定義',
            url: 'https://example.atlassian.net/wiki/spaces/ARCH/pages/45678/job-data-model'
          }
        ]
      }
    ];

    // getMessagesとaddMessageBatchをモック
    window.__originalFetch = window.fetch;
    window.fetch = async (url, options) => {
      if (url.includes('/api/chat')) {
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return window.__originalFetch(url, options);
    };
  });
}

// RAGサービスをモックするヘルパー関数
export async function mockRAGService(page: Page) {
  await page.addInitScript(() => {
    // askQuestionアクションをモック
    window.__askQuestionMock = async (question) => {
      // 1秒後に応答を返す
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        id: 'mock-response-id',
        content: `これはモックの回答です。質問: "${question}"`,
        role: 'assistant',
        createdAt: new Date().toISOString(),
        userId: 'mock-user-123',
        sources: [
          {
            title: '[MOCK-123] モック参照元',
            url: 'https://example.atlassian.net/wiki/spaces/MOCK/pages/123456/mock-doc'
          }
        ]
      };
    };
  });
}
