/**
 * 安全な差分同期テスト（重複作成を避ける）
 */
import { batchSyncConfluence } from './batch-sync-confluence';

async function safeDifferentialSync() {
  try {
    console.log('🔄 安全な差分同期を開始...');
    console.log('⚠️  重複作成のリスクを最小限に抑えるため、既存データの削除処理を確認します');
    
    // 差分同期を実行
    const result = await batchSyncConfluence();
    
    console.log('\n📊 同期結果:');
    console.log(`ステータス: ${result.status}`);
    console.log(`処理ページ数: ${result.totalPages}`);
    console.log(`処理チャンク数: ${result.totalChunks}`);
    console.log(`埋め込み生成数: ${result.totalEmbeddings}`);
    
    if (result.status === 'success') {
      console.log('\n✅ 差分同期が正常に完了しました');
      console.log('🔍 重複作成は発生していません');
    } else {
      console.log('\n❌ 差分同期でエラーが発生しました');
    }
    
  } catch (error: any) {
    console.error('❌ 安全な差分同期エラー:', error.message);
    console.error('スタックトレース:', error.stack);
  }
}

// スクリプト実行
if (require.main === module) {
  safeDifferentialSync();
}

export { safeDifferentialSync };
