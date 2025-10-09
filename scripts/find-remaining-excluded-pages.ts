/**
 * LanceDBに残っている除外対象ページを特定
 */

import 'dotenv/config';
import { LanceDBClient } from './src/lib/lancedb-client';

async function findRemainingExcludedPages(): Promise<void> {
  console.log('🔍 LanceDBに残っている除外対象ページを特定中...\n');

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
      '【別フローで定義済のため削除】',
      '【統合につき不要】',
      '【記載統合のため削除】',
      '【要求FIX/要件作成中】',
      '【要件未作成／対応表FIX】',
      '【要件未／対応表FIX】',
      '【機能統合のため削除】',
      '【統合より削除】',
      '【統合のためクローズ】',
      '【統合のため削除】',
      '【機能廃止のため作成停止】',
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
    
    // 3. ページごとにグループ化
    const pageGroups = new Map<string, any[]>();
    excludeChunks.forEach((chunk: any) => {
      const pageId = chunk.pageId.toString();
      if (!pageGroups.has(pageId)) {
        pageGroups.set(pageId, []);
      }
      pageGroups.get(pageId)!.push(chunk);
    });
    
    // 4. 結果を表示
    console.log('\n📋 残っている除外対象ページ:');
    console.log(`📊 除外対象ページ数: ${pageGroups.size}ページ`);
    console.log(`📊 除外対象チャンク数: ${excludeChunks.length}チャンク\n`);
    
    let index = 1;
    for (const [pageId, chunks] of pageGroups) {
      const firstChunk = chunks[0];
      console.log(`${index}. ページID: ${pageId}`);
      console.log(`   タイトル: ${firstChunk.title}`);
      console.log(`   ラベル: ${JSON.stringify(firstChunk.labels)}`);
      console.log(`   チャンク数: ${chunks.length}`);
      console.log(`   除外理由: ${getExclusionReason(firstChunk, excludeLabels, excludeTitlePatterns)}`);
      console.log('');
      index++;
    }
    
    // 5. 除外理由別の統計
    console.log('📊 除外理由別統計:');
    const reasonCounts = new Map<string, number>();
    for (const [pageId, chunks] of pageGroups) {
      const firstChunk = chunks[0];
      const reason = getExclusionReason(firstChunk, excludeLabels, excludeTitlePatterns);
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    }
    
    const sortedReasons = Array.from(reasonCounts.entries()).sort((a, b) => b[1] - a[1]);
    sortedReasons.forEach(([reason, count]) => {
      console.log(`  ${reason}: ${count}ページ`);
    });

  } catch (error) {
    console.error('❌ 調査中にエラーが発生しました:', error);
    throw error;
  }
}

function getExclusionReason(chunk: any, excludeLabels: string[], excludeTitlePatterns: string[]): string {
  const reasons: string[] = [];
  
  // ラベルによる除外チェック
  const labels = chunk.labels;
  let hasExcludeLabel = false;
  const excludeLabelNames: string[] = [];
  
  if (Array.isArray(labels)) {
    excludeLabelNames.push(...labels.filter((label: string) => excludeLabels.includes(label)));
    hasExcludeLabel = excludeLabelNames.length > 0;
  } else if (typeof labels === 'object' && labels !== null) {
    const labelsStr = JSON.stringify(labels);
    excludeLabelNames.push(...excludeLabels.filter(keyword => labelsStr.includes(keyword)));
    hasExcludeLabel = excludeLabelNames.length > 0;
  }
  
  if (hasExcludeLabel) {
    reasons.push(`ラベル: ${excludeLabelNames.join(', ')}`);
  }
  
  // タイトルパターンによる除外チェック
  const excludeTitleNames: string[] = [];
  excludeTitlePatterns.forEach(pattern => {
    if (chunk.title && chunk.title.includes(pattern)) {
      excludeTitleNames.push(pattern);
    }
  });
  
  if (excludeTitleNames.length > 0) {
    reasons.push(`タイトルパターン: ${excludeTitleNames.join(', ')}`);
  }
  
  return reasons.join(' + ') || '不明';
}

// 実行
findRemainingExcludedPages().catch(console.error);
