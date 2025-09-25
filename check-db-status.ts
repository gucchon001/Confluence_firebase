/**
 * LanceDBデータベース状態チェック
 */

import { confluenceSyncService } from './src/lib/confluence-sync-service';

async function checkDatabaseStatus() {
  try {
    console.log('🔍 LanceDBデータベース状態を確認中...');
    await confluenceSyncService.showDatabaseStatus();
    console.log('✅ データベース状態確認完了');
  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

checkDatabaseStatus();
