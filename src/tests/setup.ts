// テスト実行前に必要な設定を行うファイル
import { vi } from 'vitest';

// 環境変数のモック
process.env.CONFLUENCE_BASE_URL = 'https://test.atlassian.net';
process.env.CONFLUENCE_USER_EMAIL = 'test@example.com';
process.env.CONFLUENCE_API_TOKEN = 'test-token';
process.env.CONFLUENCE_SPACE_KEY = 'TEST';

process.env.VERTEX_AI_PROJECT_ID = 'test-project';
process.env.VERTEX_AI_LOCATION = 'asia-northeast1';
process.env.VERTEX_AI_INDEX_ID = 'test-index';

process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-api-key';
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'test-project';
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'test.appspot.com';
process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = '123456789';
process.env.NEXT_PUBLIC_FIREBASE_APP_ID = '1:123456789:web:abcdef';

// グローバルモック
// 注意: 実際の実行テストでは実際のfetchが必要なため、モックは条件付きで設定
// 実際の実行テストでは、テストファイル内でモックを解除する必要がある
if (typeof global.fetch === 'undefined') {
  // Node.js 18未満の環境では、node-fetchを使用
  // Node.js 18以降では、グローバルfetchが利用可能
  global.fetch = vi.fn();
}

// その他の必要な設定
