import 'dotenv/config';
import { confluenceSyncService } from '../lib/confluence-sync-service';

async function fastSyncClassroomPages() {
  console.log('🚀 教室管理ページの高速同期を開始します...');
  
  try {
    // 教室管理関連のページのみを取得
    console.log('🔍 教室管理関連ページを検索中...');
    const allPages = await confluenceSyncService.getAllConfluencePages();
    
    // 教室管理関連ページをフィルタリング
    const classroomPages = allPages.filter(page => 
      page.title && (
        page.title.includes('教室管理') ||
        page.title.includes('教室一覧') ||
        page.title.includes('教室新規') ||
        page.title.includes('教室情報') ||
        page.title.includes('教室コピー') ||
        page.title.includes('教室グループ')
      )
    );
    
    console.log(`📊 教室管理関連ページ: ${classroomPages.length}件`);
    console.log('📋 対象ページ一覧:');
    classroomPages.forEach((page, i) => {
      console.log(`  ${i+1}. ${page.title} (ID: ${page.id})`);
    });
    
    if (classroomPages.length === 0) {
      console.log('❌ 教室管理関連ページが見つかりませんでした');
      return;
    }
    
    // 教室管理ページのみを同期
    console.log(`\n🔄 ${classroomPages.length}件の教室管理ページを同期中...`);
    const result = await confluenceSyncService.syncPages(classroomPages);
    
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
    
    console.log('\n✅ 教室管理ページの高速同期が完了しました');
    
  } catch (error) {
    console.error('❌ 高速同期エラー:', error);
  }
}

fastSyncClassroomPages().catch(console.error);
