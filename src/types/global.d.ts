// グローバル型定義

interface Window {
  // Firebase設定のモック
  FIREBASE_CONFIG?: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
  
  // モック認証フラグ
  USE_MOCK_AUTH?: boolean;
  
  // Firebase Authのモック
  mockFirebaseAuth?: {
    onAuthStateChanged: (callback: (user: any) => void) => () => void;
    signInWithPopup: () => Promise<{ user: any }>;
    signOut: () => Promise<void>;
  };
  
  // モックメッセージデータ
  __mockMessages?: any[];
  
  // オリジナルのfetch関数
  __originalFetch?: typeof fetch;
  
  // モックの質問応答関数
  __askQuestionMock?: (question: string) => Promise<any>;
  
  // モックの会話履歴データ
  __mockChatHistory?: any[];
  
  // モックの会話履歴取得関数
  __getChatHistoryMock?: () => Promise<any[]>;
}
