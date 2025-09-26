/**
 * アーカイブページをLanceDBから削除
 */

import 'dotenv/config';
import { LanceDBClient } from './src/lib/lancedb-client';

async function removeArchivePages(): Promise<void> {
  console.log('🗑️ アーカイブページをLanceDBから削除中...\n');

  try {
    const lancedbClient = LanceDBClient.getInstance();
    await lancedbClient.connect();

    const table = await lancedbClient.getTable();
    
    // 1. 全チャンクを取得
    console.log('📦 全チャンクを取得中...');
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    
    console.log(`📄 総チャンク数: ${allChunks.length}`);
    
    // 2. 除外対象のチャンクを特定
    console.log('🔍 除外対象のチャンクを特定中...');
    const excludeLabels = ['アーカイブ', 'archive', 'フォルダ'];
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
      '【別フローで定義済のため削除】',
      '【他ツールへ機能切り出しのため作成停止】'
    ];
    
    const excludeChunks = allChunks.filter((chunk: any) => {
      // ラベルによる除外チェック
      const labels = chunk.labels;
      let hasExcludeLabel = false;
      
      if (Array.isArray(labels)) {
        hasExcludeLabel = labels.some((label: string) => excludeLabels.includes(label));
      } else if (typeof labels === 'object' && labels !== null) {
        // オブジェクト形式の場合、JSON文字列で検索
        const labelsStr = JSON.stringify(labels);
        hasExcludeLabel = excludeLabels.some(keyword => labelsStr.includes(keyword));
      }
      
      // タイトルパターンによる除外チェック
      const hasExcludeTitle = excludeTitlePatterns.some(pattern => 
        chunk.title && chunk.title.includes(pattern)
      );
      
      return hasExcludeLabel || hasExcludeTitle;
    });
    
    console.log(`🚫 除外対象チャンク数: ${excludeChunks.length}`);
    
    if (excludeChunks.length === 0) {
      console.log('✅ 除外対象チャンクは見つかりませんでした');
      return;
    }
    
    // 3. 除外対象チャンクの詳細を表示
    console.log('\n📋 除外対象チャンクの詳細:');
    const pageIds = new Set<string>();
    excludeChunks.forEach((chunk: any, index: number) => {
      const pageId = chunk.pageId.toString();
      pageIds.add(pageId);
      console.log(`  ${index + 1}. ページID: ${pageId}, タイトル: ${chunk.title}, ラベル: ${JSON.stringify(chunk.labels)}`);
    });
    
    console.log(`\n📊 除外対象ページ数: ${pageIds.size}ページ`);
    console.log(`📊 除外対象チャンク数: ${excludeChunks.length}チャンク`);
    
    // 4. 削除実行
    console.log('\n🗑️ 除外対象チャンクを削除中...');
    let deletedCount = 0;
    
    for (const chunk of excludeChunks) {
      try {
        // チャンクを削除
        await table.delete(`"pageId" = '${chunk.pageId}' AND "chunkIndex" = ${chunk.chunkIndex}`);
        deletedCount++;
        console.log(`  ✅ 削除完了: ${chunk.title} (${chunk.pageId}) - チャンク ${chunk.chunkIndex}`);
      } catch (error) {
        console.error(`  ❌ 削除エラー: ${chunk.title} (${chunk.pageId}) - ${error}`);
      }
    }
    
    console.log(`\n🎉 除外対象ページの削除が完了しました！`);
    console.log(`📊 削除結果:`);
    console.log(`  🗑️ 削除チャンク数: ${deletedCount}/${excludeChunks.length}`);
    console.log(`  📄 削除ページ数: ${pageIds.size}ページ`);
    
    // 5. 削除後の確認
    console.log('\n🔍 削除後の確認中...');
    const remainingChunks = await table.search(dummyVector).limit(10000).toArray();
    const remainingExcludeChunks = remainingChunks.filter((chunk: any) => {
      // ラベルによる除外チェック
      const labels = chunk.labels;
      let hasExcludeLabel = false;
      
      if (Array.isArray(labels)) {
        hasExcludeLabel = labels.some((label: string) => excludeLabels.includes(label));
      } else if (typeof labels === 'object' && labels !== null) {
        const labelsStr = JSON.stringify(labels);
        hasExcludeLabel = excludeLabels.some(keyword => labelsStr.includes(keyword));
      }
      
      // タイトルパターンによる除外チェック
      const hasExcludeTitle = excludeTitlePatterns.some(pattern => 
        chunk.title && chunk.title.includes(pattern)
      );
      
      return hasExcludeLabel || hasExcludeTitle;
    });
    
    console.log(`📊 削除後統計:`);
    console.log(`  📄 残りチャンク数: ${remainingChunks.length}`);
    console.log(`  🚫 残り除外対象チャンク数: ${remainingExcludeChunks.length}`);
    
    if (remainingExcludeChunks.length === 0) {
      console.log('✅ 除外対象チャンクは完全に削除されました');
    } else {
      console.log('⚠️ 一部の除外対象チャンクが残っています');
      remainingExcludeChunks.forEach((chunk: any) => {
        console.log(`  - ${chunk.title} (${chunk.pageId}) - ラベル: ${JSON.stringify(chunk.labels)}`);
      });
    }

  } catch (error) {
    console.error('❌ アーカイブページ削除中にエラーが発生しました:', error);
    throw error;
  }
}

// 実行
removeArchivePages().catch(console.error);
