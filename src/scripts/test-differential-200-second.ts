import dotenv from 'dotenv';
import { batchSyncConfluence } from './batch-sync-confluence';

dotenv.config();

async function testDifferential200Second() {
  try {
    console.log('🔍 2回目の差分更新テスト開始（200件）...');
    console.log('期待結果: 全てのページが更新不要としてスキップされること');
    
    // 差分同期を実行
    const result = await batchSyncConfluence(true, false); // isDifferentialSync=true, shouldDelete=false
    
    console.log('\n=== 2回目差分更新テスト結果 ===');
    console.log(`ステータス: ${result.status}`);
    console.log(`処理ページ数: ${result.totalPages}`);
    console.log(`チャンク数: ${result.totalChunks}`);
    console.log(`埋め込み数: ${result.totalEmbeddings}`);
    
    if (result.totalPages === 0) {
      console.log('✅ テスト成功: 全てのページが更新不要としてスキップされました');
      console.log('✅ 差分更新ロジックは正常に動作しています');
    } else {
      console.log('❌ テスト失敗: 一部のページが新規追加として処理されました');
      console.log('❌ 差分更新ロジックに問題があります');
      console.log(`   新規追加されたページ数: ${result.totalPages}`);
    }
    
  } catch (error: any) {
    console.error('❌ 2回目差分更新テストエラー:', error.message);
  }
}

testDifferential200Second().catch(console.error);
