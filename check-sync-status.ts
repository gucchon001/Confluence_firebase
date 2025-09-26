/**
 * 現在の同期状況をチェック
 */

import 'dotenv/config';
import { LanceDBClient } from './src/lib/lancedb-client';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';

async function checkSyncStatus(): Promise<void> {
  console.log('🔍 現在の同期状況をチェック中...\n');

  try {
    // 1. LanceDBの状況を確認
    const lancedbClient = LanceDBClient.getInstance();
    await lancedbClient.connect();
    const table = await lancedbClient.getTable();
    
    console.log('📦 LanceDBの状況:');
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    
    // ページIDの重複を除去してページ数を計算
    const uniquePageIds = new Set<string>();
    allChunks.forEach((chunk: any) => {
      uniquePageIds.add(chunk.pageId.toString());
    });
    
    console.log(`  📄 総チャンク数: ${allChunks.length}`);
    console.log(`  📄 ユニークページ数: ${uniquePageIds.size}`);
    
    // 2. Confluence APIから全ページ数を取得
    console.log('\n🔍 Confluence APIの状況:');
    const syncService = new ConfluenceSyncService();
    const allConfluencePages = await syncService.getAllConfluencePages(2000); // 十分大きな数
    
    console.log(`  📄 Confluence総ページ数: ${allConfluencePages.length}`);
    
    // 3. 同期状況の比較
    console.log('\n📊 同期状況の比較:');
    const confluencePageIds = new Set<string>(allConfluencePages.map(page => page.id.toString()));
    const lancedbPageIds = uniquePageIds;
    
    const syncedPages = [...lancedbPageIds].filter(id => confluencePageIds.has(id));
    const missingPages = [...confluencePageIds].filter(id => !lancedbPageIds.has(id));
    
    console.log(`  ✅ 同期済みページ数: ${syncedPages.length}`);
    console.log(`  ❌ 未同期ページ数: ${missingPages.length}`);
    console.log(`  📊 同期率: ${((syncedPages.length / confluencePageIds.size) * 100).toFixed(1)}%`);
    
    if (missingPages.length > 0) {
      console.log('\n❌ 未同期ページ（最初の10ページ）:');
      missingPages.slice(0, 10).forEach((pageId, index) => {
        const page = allConfluencePages.find(p => p.id.toString() === pageId);
        console.log(`  ${index + 1}. ${pageId} - ${page?.title || 'タイトル不明'}`);
      });
      
      if (missingPages.length > 10) {
        console.log(`  ... 他 ${missingPages.length - 10} ページ`);
      }
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
    
    const excludedConfluencePages = allConfluencePages.filter(page => {
      // ラベルによる除外チェック
      const labels = page.labels || [];
      const hasExcludeLabel = labels.some((label: string) => excludeLabels.includes(label));
      
      // タイトルパターンによる除外チェック
      const hasExcludeTitle = excludeTitlePatterns.some(pattern => 
        page.title && page.title.includes(pattern)
      );
      
      return hasExcludeLabel || hasExcludeTitle;
    });
    
    console.log(`  🚫 Confluence除外対象ページ数: ${excludedConfluencePages.length}`);
    console.log(`  ✅ 同期対象ページ数: ${allConfluencePages.length - excludedConfluencePages.length}`);
    
    // 5. 次のアクションの提案
    console.log('\n🎯 次のアクション:');
    if (missingPages.length === 0) {
      console.log('  ✅ 全ページが同期済みです');
    } else {
      console.log(`  🔄 差分同期を実行して ${missingPages.length} ページを追加する必要があります`);
      console.log('  💡 実行コマンド: npx tsx differential-sync.ts');
    }

  } catch (error) {
    console.error('❌ 同期状況確認中にエラーが発生しました:', error);
    throw error;
  }
}

// 実行
checkSyncStatus().catch(console.error);
