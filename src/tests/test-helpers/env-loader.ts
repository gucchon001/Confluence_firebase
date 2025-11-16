/**
 * テスト用環境変数ローダー
 * テスト実行時に環境変数を緩和して読み込む
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

/**
 * テスト用の環境変数を読み込む
 * .env.localが存在しない場合でも、デフォルト値や最小限の設定でテストを実行可能にする
 * 
 * 注意: この関数はapp-configのインポート前に呼び出す必要があります。
 * app-configはモジュール読み込み時に環境変数を検証するため、
 * この関数で環境変数を設定してからapp-configをインポートする必要があります。
 */
export function loadTestEnv(): void {
  try {
    // まず.env.localを読み込む（存在する場合）
    const envPath = path.resolve(process.cwd(), '.env.local');
    const envResult = dotenv.config({ path: envPath, override: false });
    
    // .env.localが読み込まれたか確認（デバッグ用）
    if (envResult.error) {
      // ファイルが存在しない場合はエラーではなく正常（.env.localはオプション）
      // Node.jsのファイルシステムエラーはcodeプロパティを持つ（NodeJS.ErrnoException）
      const errnoError = envResult.error as NodeJS.ErrnoException;
      if (errnoError.code !== 'ENOENT') {
        console.warn('[TestEnvLoader] .env.localの読み込みでエラーが発生しました:', envResult.error.message);
      }
    } else if (envResult.parsed) {
      // .env.localが正常に読み込まれた場合
      const loadedKeys = Object.keys(envResult.parsed).length;
      console.log(`[TestEnvLoader] ✅ .env.localから${loadedKeys}個の環境変数を読み込みました`);
    }
    
    // 必須環境変数が設定されていない場合のデフォルト値（テスト用）
    // 実際の接続は失敗する可能性があるが、テストは実行可能
    // 注意: Zodスキーマ検証を通過するために、形式要件を満たす必要があります
    // 参照: src/config/app-config.ts の EnvSchema
    const defaultEnv: Record<string, string> = {
      // Confluence設定（必須）
      CONFLUENCE_BASE_URL: 'https://example.atlassian.net', // URL形式必須
      CONFLUENCE_USER_EMAIL: 'test@example.com', // メール形式必須
      CONFLUENCE_API_TOKEN: 'dummy-token-1234567890', // min(1)必須
      CONFLUENCE_SPACE_KEY: 'TEST', // min(1)必須
      
      // Jira設定（オプション、Confluence設定をフォールバック）
      // JIRA_BASE_URL: オプション（未設定でOK）
      // JIRA_USER_EMAIL: オプション（未設定でOK）
      // JIRA_API_TOKEN: オプション（未設定でOK）
      // JIRA_PROJECT_KEY: オプション（未設定でOK）
      // JIRA_MAX_ISSUES: オプション（未設定でOK）
      
      // Gemini設定（必須）
      GEMINI_API_KEY: 'dummy-key-1234567890', // min(1)必須
      
      // Firebase設定（クライアント側、必須）
      NEXT_PUBLIC_FIREBASE_API_KEY: 'AIzaSyDummyKey1234567890', // min(1)必須
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'dummy-project.firebaseapp.com', // min(1)必須
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'dummy-project', // min(1)必須
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'dummy-project.appspot.com', // min(1)必須
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123456789', // min(1)必須
      NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456789:web:abcdef123456', // min(1)必須
      
      // Firebase設定（サーバー側、オプション）
      // FIREBASE_PROJECT_ID: オプション（未設定でOK）
      // GOOGLE_CLOUD_PROJECT: オプション（未設定でOK）
      
      // 環境判定
      NODE_ENV: 'development', // enum: 'development' | 'production' | 'test'
      
      // デプロイメント環境判定（オプション）
      // K_SERVICE: オプション（未設定でOK）
      // USE_INMEMORY_FS: オプション（未設定でOK）
      
      // その他の設定（オプション）
      // USE_LLM_EXPANSION: オプション（未設定でOK）
      // SKIP_DATA_DOWNLOAD: オプション（未設定でOK）
      // EMBEDDINGS_PROVIDER: オプション（未設定でOK）
    };

    // 環境変数が設定されていない場合のみデフォルト値を設定
    const missingVars: string[] = [];
    const safeDefaultVars = ['NODE_ENV']; // 警告を表示しない安全なデフォルト値
    for (const [key, defaultValue] of Object.entries(defaultEnv)) {
      const currentValue = process.env[key];
      if (!currentValue || currentValue.trim() === '') {
        process.env[key] = defaultValue;
        if (!safeDefaultVars.includes(key)) {
          missingVars.push(key);
        }
      }
    }
    
    if (missingVars.length > 0) {
      console.warn(`[TestEnvLoader] ⚠️  ${missingVars.length}個の環境変数が設定されていません。デフォルト値を使用します（テストのみ）`);
      console.warn(`[TestEnvLoader] 未設定の環境変数: ${missingVars.join(', ')}`);
      console.warn(`[TestEnvLoader] 注意: デフォルト値では実際の接続は失敗する可能性があります`);
    }
  } catch (error) {
    console.warn('[TestEnvLoader] .env.localの読み込みに失敗しました:', error);
    // エラーが発生してもデフォルト値を設定して続行
    // 必須環境変数のみ設定（オプションは除外）
    const fallbackEnv: Record<string, string> = {
      // Confluence設定（必須）
      CONFLUENCE_BASE_URL: 'https://example.atlassian.net',
      CONFLUENCE_USER_EMAIL: 'test@example.com',
      CONFLUENCE_API_TOKEN: 'dummy-token-1234567890',
      CONFLUENCE_SPACE_KEY: 'TEST',
      
      // Gemini設定（必須）
      GEMINI_API_KEY: 'dummy-key-1234567890',
      
      // Firebase設定（クライアント側、必須）
      NEXT_PUBLIC_FIREBASE_API_KEY: 'AIzaSyDummyKey1234567890',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'dummy-project.firebaseapp.com',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'dummy-project',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'dummy-project.appspot.com',
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123456789',
      NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456789:web:abcdef123456',
      
      // 環境判定
      NODE_ENV: 'development',
    };
    
    for (const [key, value] of Object.entries(fallbackEnv)) {
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

