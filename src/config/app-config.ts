/**
 * 統合アプリケーション設定ファイル
 * 
 * 環境変数の一元管理と型安全な設定値の提供
 * - 環境変数のスキーマ定義（Zod）
 * - 型安全な設定値のエクスポート
 * - 環境変数の検証ロジック
 * 
 * 使用方法:
 *   import { appConfig } from '@/config/app-config';
 *   const baseUrl = appConfig.confluence.baseUrl;
 */

import { z } from 'zod';

/**
 * スクリプト実行時かどうかを判定
 * Next.jsアプリケーションコンテキスト外（スクリプト実行時）では、
 * Firebaseクライアント側の環境変数は不要
 */
function isScriptContext(): boolean {
  // Next.jsアプリケーションコンテキストでは NEXT_RUNTIME が設定される
  // スクリプト実行時は設定されない
  const isScript = !process.env.NEXT_RUNTIME;
  
  // デバッグ用（本番環境ではログが出ないように）
  if (process.env.NODE_ENV !== 'production' && process.env.DEBUG_ENV_CHECK) {
    console.log('[app-config] NEXT_RUNTIME:', process.env.NEXT_RUNTIME);
    console.log('[app-config] isScriptContext:', isScript);
  }
  
  return isScript;
}

/**
 * 環境変数のスキーマ定義
 * スクリプト実行時はFirebaseクライアント側の環境変数をオプショナルにする
 */
const createEnvSchema = () => {
  const baseSchema = {
    // Confluence設定（必須）
    CONFLUENCE_BASE_URL: z.string().url('CONFLUENCE_BASE_URL は有効なURLである必要があります'),
    CONFLUENCE_USER_EMAIL: z.string().email('CONFLUENCE_USER_EMAIL は有効なメールアドレスである必要があります'),
    CONFLUENCE_API_TOKEN: z.string().min(1, 'CONFLUENCE_API_TOKEN は必須です'),
    CONFLUENCE_SPACE_KEY: z.string().min(1, 'CONFLUENCE_SPACE_KEY は必須です'),
    
    // Jira設定（オプション、Confluence設定をフォールバック）
    JIRA_BASE_URL: z.string().url().optional(),
    JIRA_USER_EMAIL: z.string().email().optional(),
    JIRA_API_TOKEN: z.string().min(1).optional(),
    JIRA_PROJECT_KEY: z.string().optional(),
    JIRA_MAX_ISSUES: z.string().regex(/^\d+$/).optional(),
    
    // Gemini設定（必須）
    GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY は必須です'),
    
    // Firebase設定（サーバー側、オプション）
    FIREBASE_PROJECT_ID: z.string().optional(),
    GOOGLE_CLOUD_PROJECT: z.string().optional(),
    
    // 環境判定
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    
    // デプロイメント環境判定
    K_SERVICE: z.string().optional(), // Cloud Run
    USE_INMEMORY_FS: z.string().optional(), // インメモリファイルシステムを使用するか
    
    // その他の設定
    USE_LLM_EXPANSION: z.string().optional(),
    SKIP_DATA_DOWNLOAD: z.string().optional(),
    EMBEDDINGS_PROVIDER: z.string().optional(),
  };

  // スクリプト実行時はFirebaseクライアント側の環境変数をオプショナルにする
  if (isScriptContext()) {
    return z.object({
      ...baseSchema,
      // Firebase設定（クライアント側、スクリプト実行時はオプション）
      NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1).optional(),
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1).optional(),
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1).optional(),
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1).optional(),
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1).optional(),
      NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1).optional(),
    });
  }

  // Next.jsアプリケーションコンテキストではFirebaseクライアント側の環境変数は必須
  return z.object({
    ...baseSchema,
    // Firebase設定（クライアント側、必須）
    NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1, 'NEXT_PUBLIC_FIREBASE_API_KEY は必須です'),
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1, 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN は必須です'),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1, 'NEXT_PUBLIC_FIREBASE_PROJECT_ID は必須です'),
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1, 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET は必須です'),
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1, 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID は必須です'),
    NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1, 'NEXT_PUBLIC_FIREBASE_APP_ID は必須です'),
  });
};

const EnvSchema = createEnvSchema();

/**
 * 環境変数の検証と型安全な取得
 */
function getValidatedEnv(): z.infer<typeof EnvSchema> {
  const raw = {
    CONFLUENCE_BASE_URL: process.env.CONFLUENCE_BASE_URL,
    CONFLUENCE_USER_EMAIL: process.env.CONFLUENCE_USER_EMAIL,
    CONFLUENCE_API_TOKEN: process.env.CONFLUENCE_API_TOKEN,
    CONFLUENCE_SPACE_KEY: process.env.CONFLUENCE_SPACE_KEY,
    
    JIRA_BASE_URL: process.env.JIRA_BASE_URL,
    JIRA_USER_EMAIL: process.env.JIRA_USER_EMAIL,
    JIRA_API_TOKEN: process.env.JIRA_API_TOKEN,
    JIRA_PROJECT_KEY: process.env.JIRA_PROJECT_KEY,
    JIRA_MAX_ISSUES: process.env.JIRA_MAX_ISSUES,
    
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
    
    NODE_ENV: process.env.NODE_ENV || 'development',
    
    K_SERVICE: process.env.K_SERVICE,
    USE_INMEMORY_FS: process.env.USE_INMEMORY_FS,
    
    USE_LLM_EXPANSION: process.env.USE_LLM_EXPANSION,
    SKIP_DATA_DOWNLOAD: process.env.SKIP_DATA_DOWNLOAD,
    EMBEDDINGS_PROVIDER: process.env.EMBEDDINGS_PROVIDER,
  };
  
  try {
    return EnvSchema.parse(raw);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missing = error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join('\n  - ');
      throw new Error(
        `必須環境変数が設定されていませんまたは無効です:\n  - ${missing}\n\n` +
        `詳細: ${error.message}`
      );
    }
    throw error;
  }
}

// 環境変数を検証済み状態で取得（一度だけ検証）
const validatedEnv = getValidatedEnv();

/**
 * アプリケーション設定オブジェクト
 * 
 * 検証済み環境変数から構築された型安全な設定値
 */
export const appConfig = {
  /**
   * Confluence設定
   */
  confluence: {
    baseUrl: validatedEnv.CONFLUENCE_BASE_URL,
    userEmail: validatedEnv.CONFLUENCE_USER_EMAIL,
    apiToken: validatedEnv.CONFLUENCE_API_TOKEN,
    spaceKey: validatedEnv.CONFLUENCE_SPACE_KEY,
  },
  
  /**
   * Jira設定
   * Jira固有の環境変数がない場合は、Confluence設定をフォールバックとして使用
   */
  jira: {
    baseUrl: validatedEnv.JIRA_BASE_URL || validatedEnv.CONFLUENCE_BASE_URL,
    userEmail: validatedEnv.JIRA_USER_EMAIL || validatedEnv.CONFLUENCE_USER_EMAIL,
    apiToken: validatedEnv.JIRA_API_TOKEN || validatedEnv.CONFLUENCE_API_TOKEN,
    projectKey: validatedEnv.JIRA_PROJECT_KEY || '',
    maxIssues: validatedEnv.JIRA_MAX_ISSUES ? parseInt(validatedEnv.JIRA_MAX_ISSUES, 10) : 1000,
  },
  
  /**
   * Gemini設定
   */
  gemini: {
    apiKey: validatedEnv.GEMINI_API_KEY,
  },
  
  /**
   * Firebase設定（クライアント側）
   * スクリプト実行時は値がundefinedになる可能性がある
   */
  firebase: {
    apiKey: validatedEnv.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: validatedEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: validatedEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: validatedEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: validatedEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: validatedEnv.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  },
  
  /**
   * Firebase設定（サーバー側）
   * スクリプト実行時はNEXT_PUBLIC_FIREBASE_PROJECT_IDがundefinedになる可能性がある
   */
  firebaseServer: {
    projectId: validatedEnv.FIREBASE_PROJECT_ID || validatedEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    googleCloudProject: validatedEnv.GOOGLE_CLOUD_PROJECT || validatedEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  },
  
  /**
   * 環境判定
   */
  environment: {
    isDevelopment: validatedEnv.NODE_ENV === 'development',
    isProduction: validatedEnv.NODE_ENV === 'production',
    isTest: validatedEnv.NODE_ENV === 'test',
    nodeEnv: validatedEnv.NODE_ENV,
  },
  
  /**
   * デプロイメント環境判定
   */
  deployment: {
    isCloudRun: !!validatedEnv.K_SERVICE,
    useInMemoryFS: validatedEnv.USE_INMEMORY_FS === 'true' && !!validatedEnv.K_SERVICE,
    kService: validatedEnv.K_SERVICE,
  },
  
  /**
   * その他の設定
   */
  other: {
    useLlmExpansion: validatedEnv.USE_LLM_EXPANSION === 'true',
    skipDataDownload: validatedEnv.SKIP_DATA_DOWNLOAD === 'true',
    embeddingsProvider: validatedEnv.EMBEDDINGS_PROVIDER || 'local',
  },
} as const;

/**
 * 型安全なアプリケーション設定の型定義
 */
export type AppConfig = typeof appConfig;

/**
 * Confluence設定のデフォルトベースURL
 * フォールバック用
 */
export const DEFAULT_CONFLUENCE_BASE_URL = 'https://giginc.atlassian.net';

