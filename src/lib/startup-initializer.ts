/**
 * アプリケーション起動時の初期化処理
 * サーバー起動時に必要なインデックスやクライアントを初期化
 */

import { initializeLunrOnStartup } from './lunr-initializer';

/**
 * アプリケーション起動時の初期化処理を実行
 * この関数はサーバーの起動時に呼び出される
 */
export async function initializeOnStartup(): Promise<void> {
  console.log('🚀 Starting application initialization...');
  
  try {
    // Lunrインデックスの初期化（非同期）
    await initializeLunrOnStartup();
    
    console.log('✅ Application initialization completed successfully');
  } catch (error) {
    console.error('❌ Application initialization failed:', error);
    // 初期化に失敗してもアプリケーションは起動を続行
    // 各機能は個別にフォールバック処理を行う
  }
}

/**
 * 初期化状態を確認するヘルスチェック関数
 */
export function getInitializationStatus(): {
  lunr: {
    ready: boolean;
    status: string;
    message: string;
  };
} {
  const { lunrInitializer } = require('./lunr-initializer');
  const lunrStatus = lunrInitializer.getProgress();
  
  return {
    lunr: {
      ready: lunrInitializer.isReady(),
      status: lunrStatus.status,
      message: lunrStatus.message
    }
  };
}
