// Firebase設定ファイル
// 注: 実際のプロジェクトでは、これらの値は環境変数から取得することを推奨

// クライアントサイドでwindow.FIREBASE_CONFIGが設定されている場合はそれを使用（テスト用）
const getFirebaseConfig = () => {
  if (typeof window !== 'undefined' && window.FIREBASE_CONFIG) {
    console.log('Using test Firebase config');
    return window.FIREBASE_CONFIG;
  }

  // 開発用のダミー設定値
  // 注: 実際のプロジェクトでは、Firebase Consoleから取得した値を使用してください
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDummyKeyForLocalDevelopment123",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "dummy-project.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "dummy-project",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "dummy-project.appspot.com",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789012:web:abc123def456ghi789jkl"
  };
};

export const firebaseConfig = getFirebaseConfig();
