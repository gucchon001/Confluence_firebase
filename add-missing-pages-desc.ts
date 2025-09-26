/**
 * まだLanceDBにない新規ページを降順（ページIDの大きい順）で追加
 */

import 'dotenv/config';
import { LanceDBClient } from './src/lib/lancedb-client';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';

async function addMissingPagesDesc(): Promise<void> {
  console.log('🔄 まだLanceDBにない新規ページを降順で追加中...\n');

  try {
    // 1. LanceDBの現在のページIDを取得
    const lancedbClient = LanceDBClient.getInstance();
    await lancedbClient.connect();
    const table = await lancedbClient.getTable();
    
    console.log('📦 LanceDBの現在のページIDを取得中...');
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    
    // ページIDの重複を除去
    const lancedbPageIds = new Set<string>();
    allChunks.forEach((chunk: any) => {
      lancedbPageIds.add(chunk.pageId.toString());
    });
    
    console.log(`📄 LanceDB現在のページ数: ${lancedbPageIds.size}`);
    
    // 2. Confluence APIから全ページを取得
    console.log('\n🔍 Confluence APIから全ページを取得中...');
    const syncService = new ConfluenceSyncService();
    const allConfluencePages = await syncService.getAllConfluencePages(2000);
    
    console.log(`📄 Confluence総ページ数: ${allConfluencePages.length}`);
    
    // 3. 未同期ページを特定（降順でソート）
    const missingPages = allConfluencePages
      .filter(page => !lancedbPageIds.has(page.id.toString()))
      .sort((a, b) => parseInt(b.id) - parseInt(a.id)); // 降順ソート
    
    console.log(`\n📊 未同期ページ数: ${missingPages.length}`);
    
    if (missingPages.length === 0) {
      console.log('✅ 未同期ページはありません');
      return;
    }
    
    // 4. 除外対象ページの確認
    console.log('\n🚫 除外対象ページの確認:');
    const excludeLabels = ['アーカイブ', 'archive', 'フォルダ', 'スコープ外'];
    const excludeTitlePatterns = [
      '■要件定義', 
      '【削除】', 
      '【不要】', 
      '【統合により削除】', 
      '【機能廃止のため作成停止】', 
      '【他ツールへ機能切り出しのため作成停止】',
      '【不要のため削除】',
      '【統合のため削除】',
      '【移行により削除予定】',
      '【統合により削除予定】',
      '【削除予定】',
      '【ページ統合により削除】',
      '【帳票統合により削除】',
      '【別フローで定義済のため削除】'
    ];
    
    const syncTargetPages = missingPages.filter(page => {
      // ラベルによる除外チェック
      const labels = page.labels || [];
      const hasExcludeLabel = labels.some((label: string) => excludeLabels.includes(label));
      
      // タイトルパターンによる除外チェック
      const hasExcludeTitle = excludeTitlePatterns.some(pattern => 
        page.title && page.title.includes(pattern)
      );
      
      return !hasExcludeLabel && !hasExcludeTitle;
    });
    
    console.log(`🚫 除外対象ページ数: ${missingPages.length - syncTargetPages.length}`);
    console.log(`✅ 同期対象ページ数: ${syncTargetPages.length}`);
    
    if (syncTargetPages.length === 0) {
      console.log('✅ 同期対象ページはありません');
      return;
    }
    
    // 5. 降順で同期実行
    console.log('\n🔄 降順で同期実行中...');
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    
    for (const page of syncTargetPages) {
      try {
        console.log(`\n📝 処理中: ${page.title} (${page.id}) - ${processedCount + 1}/${syncTargetPages.length}`);
        
        // ページを同期
        await syncService.syncPages([page]);
        successCount++;
        
        console.log(`  ✅ 同期完了: ${page.title} (${page.id})`);
        
      } catch (error) {
        errorCount++;
        console.error(`  ❌ 同期エラー: ${page.title} (${page.id}) - ${error}`);
      }
      
      processedCount++;
      
      // 進捗表示（10ページごと）
      if (processedCount % 10 === 0) {
        console.log(`\n📊 進捗: ${processedCount}/${syncTargetPages.length} (成功: ${successCount}, エラー: ${errorCount})`);
      }
    }
    
    // 6. 最終結果
    console.log('\n🎉 同期処理完了！');
    console.log(`📊 最終結果:`);
    console.log(`  📄 処理ページ数: ${processedCount}`);
    console.log(`  ✅ 成功: ${successCount}`);
    console.log(`  ❌ エラー: ${errorCount}`);
    
    // 7. 同期後の確認
    console.log('\n🔍 同期後の確認中...');
    const updatedChunks = await table.search(dummyVector).limit(10000).toArray();
    const updatedPageIds = new Set<string>();
    updatedChunks.forEach((chunk: any) => {
      updatedPageIds.add(chunk.pageId.toString());
    });
    
    console.log(`📄 同期後LanceDBページ数: ${updatedPageIds.size}`);
    console.log(`📄 追加されたページ数: ${updatedPageIds.size - lancedbPageIds.size}`);

  } catch (error) {
    console.error('❌ 同期処理中にエラーが発生しました:', error);
    throw error;
  }
}

// 実行
addMissingPagesDesc().catch(console.error);
