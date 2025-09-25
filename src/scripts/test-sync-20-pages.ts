/**
 * 20件限定のテスト同期処理
 * ラベルの格納確認とラベル機能の動作確認用
 */

import 'dotenv/config';
import { confluenceSyncService } from '../lib/confluence-sync-service';

async function testSync20Pages() {
  console.log('🧪 20件限定のテスト同期を開始します...');
  console.log('=' .repeat(50));
  
  try {
    // 20件限定で同期を実行
    const pages = await confluenceSyncService.getAllConfluencePages(20);
    const result = await confluenceSyncService.syncPages(pages);
    
    console.log('📊 同期結果:');
    console.log(`  追加: ${result.added}件`);
    console.log(`  更新: ${result.updated}件`);
    console.log(`  変更なし: ${result.unchanged}件`);
    console.log(`  エラー: ${result.errors.length}件`);
    
    console.log('\n✅ 20件限定のテスト同期が完了しました');
    console.log('📊 次のステップ: ラベルの格納確認とラベル機能の動作確認');
    
  } catch (error) {
    console.error('❌ テスト同期エラー:', error);
  }
}

testSync20Pages().catch(console.error);
