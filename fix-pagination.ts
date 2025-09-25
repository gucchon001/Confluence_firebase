/**
 * Confluence APIのページネーション修正版
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('fix-pagination.txt', message + '\n');
}

async function fixPagination() {
  fs.writeFileSync('fix-pagination.txt', '');
  
  log('🔧 Confluence APIのページネーション修正版をテスト中...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    
    // 1. 現在のLanceDBの状況を確認
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    const dummyVector = new Array(768).fill(0);
    const currentChunks = await table.search(dummyVector).limit(10000).toArray();
    
    log(`📊 現在のLanceDB: ${currentChunks.length}チャンク`);
    
    // 2. ページネーション修正版のテスト
    log('\n🔄 ページネーション修正版のテスト開始...');
    
    const allPages: any[] = [];
    let start = 0;
    const limit = 50; // 50ページずつ取得
    let hasMore = true;
    let totalFetched = 0;
    
    while (hasMore) {
      log(`📄 ページ ${start + 1}-${start + limit} を取得中...`);
      
      try {
        const pages = await confluenceSyncService.getConfluencePages(limit, start);
        log(`  取得したページ数: ${pages.length}`);
        
        if (pages.length === 0) {
          hasMore = false;
          log('  これ以上ページがありません');
          break;
        }
        
        allPages.push(...pages);
        totalFetched += pages.length;
        
        // 取得したページ数がlimitより少ない場合は最後のページ
        if (pages.length < limit) {
          hasMore = false;
          log('  最後のページに到達しました');
        }
        
        start += limit;
        
        // 安全のため最大1000ページで制限
        if (totalFetched >= 1000) {
          log('  最大取得数（1000ページ）に到達しました');
          hasMore = false;
        }
        
        // 少し待機してAPI制限を回避
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        log(`❌ ページ取得エラー: ${error}`);
        hasMore = false;
      }
    }
    
    log(`\n📊 総取得ページ数: ${allPages.length}`);
    
    // 3. 重複チェック
    const pageIds = new Set();
    const duplicates = [];
    
    allPages.forEach(page => {
      if (pageIds.has(page.id)) {
        duplicates.push(page.id);
      } else {
        pageIds.add(page.id);
      }
    });
    
    log(`📊 ユニークページ数: ${pageIds.size}`);
    log(`📊 重複ページ数: ${duplicates.length}`);
    
    if (duplicates.length > 0) {
      log(`重複ページID: ${duplicates.slice(0, 10).join(', ')}`);
    }
    
    // 4. ページネーション修正版のメソッドを実装
    log('\n🔧 ページネーション修正版メソッドを実装中...');
    
    // 修正版のgetAllConfluencePagesメソッド
    const getAllConfluencePages = async (maxPages: number = 1000): Promise<any[]> => {
      const allPages: any[] = [];
      let start = 0;
      const limit = 50;
      let hasMore = true;
      
      while (hasMore && allPages.length < maxPages) {
        try {
          const pages = await confluenceSyncService.getConfluencePages(limit, start);
          
          if (pages.length === 0) {
            hasMore = false;
            break;
          }
          
          allPages.push(...pages);
          start += limit;
          
          // 取得したページ数がlimitより少ない場合は最後のページ
          if (pages.length < limit) {
            hasMore = false;
          }
          
          // API制限を回避するための待機
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`ページ取得エラー (start=${start}): ${error}`);
          hasMore = false;
        }
      }
      
      return allPages;
    };
    
    // 5. 修正版で全ページ取得をテスト
    log('\n🧪 修正版で全ページ取得をテスト中...');
    const allPagesFixed = await getAllConfluencePages(500); // 500ページまで取得
    log(`📊 修正版で取得したページ数: ${allPagesFixed.length}`);
    
    // 6. 同期テスト
    if (allPagesFixed.length > 0) {
      log('\n🔄 同期テストを実行中...');
      const syncResult = await confluenceSyncService.syncPages(allPagesFixed.slice(0, 100)); // 最初の100ページでテスト
      
      log(`📊 同期結果:`);
      log(`  - 追加: ${syncResult.added}`);
      log(`  - 更新: ${syncResult.updated}`);
      log(`  - 変更なし: ${syncResult.unchanged}`);
      log(`  - 除外: ${syncResult.excluded}`);
      log(`  - エラー: ${syncResult.errors.length}`);
    }
    
    // 7. 最終的なLanceDBの状況を確認
    const finalChunks = await table.search(dummyVector).limit(10000).toArray();
    log(`\n📊 最終的なLanceDB: ${finalChunks.length}チャンク`);
    
    // 8. ページID別の集計
    const pageIdMap = new Map();
    finalChunks.forEach((chunk: any) => {
      const pageId = chunk.pageId;
      if (!pageIdMap.has(pageId)) {
        pageIdMap.set(pageId, []);
      }
      pageIdMap.get(pageId).push(chunk);
    });
    
    log(`📊 最終的なユニークページ数: ${pageIdMap.size}`);
    
    log('\n✅ ページネーション修正完了');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

fixPagination().catch(console.error);
