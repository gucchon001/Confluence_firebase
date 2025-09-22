import dotenv from 'dotenv';
import { batchSyncConfluence } from './batch-sync-confluence';

dotenv.config();

async function testDifferential200() {
  try {
    console.log('🔍 1回目の差分更新テスト開始（200件）...');
    
    // 差分同期を実行
    const result = await batchSyncConfluence(true, false); // isDifferentialSync=true, shouldDelete=false
    
    console.log('\n=== 1回目差分更新テスト結果 ===');
    console.log(`ステータス: ${result.status}`);
    console.log(`処理ページ数: ${result.totalPages}`);
    console.log(`チャンク数: ${result.totalChunks}`);
    console.log(`埋め込み数: ${result.totalEmbeddings}`);
    
    if (result.totalPages > 0) {
      console.log(`✅ 1回目完了: ${result.totalPages}件のページが処理されました`);
    } else {
      console.log('✅ 1回目完了: 全てのページが更新不要としてスキップされました');
    }
    
  } catch (error: any) {
    console.error('❌ 1回目差分更新テストエラー:', error.message);
  }
}

testDifferential200().catch(console.error);
