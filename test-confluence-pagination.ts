/**
 * Confluence APIのページネーション制限をテスト
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';

async function testConfluencePagination(): Promise<void> {
  console.log('🧪 Confluence APIのページネーション制限をテスト中...\n');

  try {
    const syncService = new ConfluenceSyncService();
    
    // 1. 異なるlimit値でテスト
    const testLimits = [50, 100, 200, 500];
    
    for (const limit of testLimits) {
      console.log(`📄 limit=${limit} でテスト中...`);
      
      try {
        const pages = await syncService.getConfluencePages(limit, 0);
        console.log(`  ✅ 取得ページ数: ${pages.length}`);
        
        if (pages.length > 0) {
          console.log(`  🆔 最初のページID: ${pages[0].id}`);
          console.log(`  🆔 最後のページID: ${pages[pages.length - 1].id}`);
        }
        
        // API制限を遵守
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`  ❌ limit=${limit} でエラー: ${error}`);
      }
    }
    
    // 2. ページネーションテスト
    console.log('\n📄 ページネーションテスト:');
    let start = 0;
    const limit = 50;
    let totalPages = 0;
    let batchCount = 0;
    
    while (batchCount < 10) { // 最大10バッチまでテスト
      try {
        console.log(`  バッチ ${batchCount + 1}: start=${start}, limit=${limit}`);
        const pages = await syncService.getConfluencePages(limit, start);
        
        if (pages.length === 0) {
          console.log('    ✅ これ以上ページがありません');
          break;
        }
        
        totalPages += pages.length;
        console.log(`    ✅ 取得ページ数: ${pages.length} (累計: ${totalPages})`);
        
        if (pages.length < limit) {
          console.log('    ✅ 最後のページに到達しました');
          break;
        }
        
        start += pages.length;
        batchCount++;
        
        // API制限を遵守
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`    ❌ バッチ ${batchCount + 1} でエラー: ${error}`);
        break;
      }
    }
    
    console.log(`\n📊 ページネーションテスト結果:`);
    console.log(`  📄 総取得ページ数: ${totalPages}`);
    console.log(`  📦 処理バッチ数: ${batchCount}`);
    
    // 3. 特定のページIDが存在するかチェック
    console.log('\n🔍 特定ページIDの存在確認:');
    const testPageIds = ['717979831', '686325840', '694779918'];
    
    for (const pageId of testPageIds) {
      try {
        const page = await syncService.getConfluencePageById(pageId);
        if (page) {
          console.log(`  ✅ ページID ${pageId}: 存在 (${page.title})`);
        } else {
          console.log(`  ❌ ページID ${pageId}: 存在しない`);
        }
      } catch (error) {
        console.log(`  ❌ ページID ${pageId}: エラー - ${error}`);
      }
      
      // API制限を遵守
      await new Promise(resolve => setTimeout(resolve, 200));
    }

  } catch (error) {
    console.error('❌ ページネーションテスト中にエラーが発生しました:', error);
  }
}

testConfluencePagination().catch(console.error);
