/**
 * 20件限定のテスト同期処理（修正版）
 * ラベルの格納確認とラベル機能の動作確認用
 */

import 'dotenv/config';
import { confluenceSyncService } from '../lib/confluence-sync-service';

async function testSync20PagesFixed() {
  console.log('🧪 20件限定のテスト同期を開始します...');
  console.log('=' .repeat(50));
  
  try {
    // 20件限定でページを取得
    console.log('🔍 Confluence APIから全ページを取得中...');
    const allPages = await confluenceSyncService.getAllConfluencePages();
    
    console.log(`📄 取得したページ数: ${allPages.length}件`);
    
    // 最初の20件のみを使用
    const pages = allPages.slice(0, 20);
    console.log(`🔄 20件に制限して同期を実行します`);
    
    console.log(`🔄 ${pages.length}件のページを同期中...`);
    
    // 20件限定で同期を実行
    const result = await confluenceSyncService.syncPages(pages);
    
    console.log('\n📊 同期結果:');
    console.log(`  追加: ${result.added}件`);
    console.log(`  更新: ${result.updated}件`);
    console.log(`  変更なし: ${result.unchanged}件`);
    console.log(`  エラー: ${result.errors.length}件`);
    
    if (result.errors.length > 0) {
      console.log('\n❌ エラー詳細:');
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
    
    console.log('\n✅ 20件限定のテスト同期が完了しました');
    console.log('📊 次のステップ: ラベルの格納確認とラベル機能の動作確認');
    
  } catch (error) {
    console.error('❌ テスト同期エラー:', error);
  }
}

testSync20PagesFixed().catch(console.error);
