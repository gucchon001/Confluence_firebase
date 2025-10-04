/**
 * デフォルト管理者を初期化するスクリプト
 * アプリケーション起動時に実行される
 */

import { adminService } from '@/lib/admin-service';

async function initializeDefaultAdmin() {
  try {
    console.log('🔧 デフォルト管理者の初期化を開始...');
    
    await adminService.initializeDefaultAdmin();
    
    console.log('✅ デフォルト管理者の初期化が完了しました');
  } catch (error) {
    console.error('❌ デフォルト管理者の初期化中にエラーが発生しました:', error);
  }
}

// スクリプトとして直接実行された場合
if (require.main === module) {
  initializeDefaultAdmin()
    .then(() => {
      console.log('初期化スクリプトが完了しました');
      process.exit(0);
    })
    .catch((error) => {
      console.error('初期化スクリプトでエラーが発生しました:', error);
      process.exit(1);
    });
}

export { initializeDefaultAdmin };
