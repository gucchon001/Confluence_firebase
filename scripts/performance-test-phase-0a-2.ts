/**
 * Phase 0A-2 パフォーマンステスト
 * 
 * Knowledge Graph統合後のパフォーマンスを詳細に測定
 */

import { searchLanceDB } from '../src/lib/lancedb-search-client';
import { OptimizedLanceDBClient } from '../src/lib/optimized-lancedb-client';
import { kgStorageService } from '../src/lib/kg-storage-service';
import { kgSearchService } from '../src/lib/kg-search-service';
import { enrichWithAllChunks, filterInvalidPagesServer } from '../src/ai/flows/retrieve-relevant-docs-lancedb';

interface PerformanceMetrics {
  queryName: string;
  query: string;
  
  // 検索フェーズ
  searchTime: number;
  vectorSearchTime?: number;
  bm25SearchTime?: number;
  
  // チャンク統合フェーズ（Phase 0A-3）
  chunkMergeTime: number;
  chunksSkipped?: number;
  chunksMerged?: number;
  
  // フィルタリングフェーズ
  filterTime: number;
  filteredCount?: number;
  
  // KG拡張フェーズ
  kgExpansionTime: number;
  kgNodesQueried: number;
  kgEdgesTraversed: number;
  initialResults: number;
  expandedResults: number;
  
  // 全体
  totalTime: number;
  
  // 結果品質
  topResultTitle: string;
  expectedFound: boolean;
  expectedRank?: number;
}

interface TestCase {
  name: string;
  query: string;
  expectedPageTitle: string;
}

const TEST_CASES: TestCase[] = [
  {
    name: '事例1: 退会後の再登録',
    query: '退会した会員が再度登録することは可能ですか',
    expectedPageTitle: '046_【FIX】会員退会機能' // 修正: "退会機能" → "会員退会機能"
  },
  {
    name: '事例2: 教室削除条件',
    query: '教室削除ができないのは何が原因ですか',
    expectedPageTitle: '164_【FIX】教室削除機能'
  },
  {
    name: '事例3: 教室コピー項目',
    query: '教室コピーでコピーされる項目を教えてください',
    expectedPageTitle: '168_【FIX】教室コピー機能'
  },
  {
    name: '事例4: 応募制限',
    query: '塾講師が同時に何件まで応募できるか教えてください',
    expectedPageTitle: '014_【FIX】求人応募機能' // 修正: "応募機能" → "求人応募機能"
  },
  {
    name: '事例5: 重複応募期間',
    query: '重複応募不可期間はいつからいつまでですか',
    expectedPageTitle: '014_【FIX】求人応募機能' // 修正: "応募機能" → "求人応募機能"
  },
  {
    name: '事例6: 学年・職業更新',
    query: '塾講師プロフィールの学年・職業を更新する方法を教えてください',
    expectedPageTitle: '721_【作成中】学年自動更新バッチ' // 修正: "塾講師-学年・職業更新機能" → "学年自動更新バッチ"
  }
];

async function getAllChunksByPageId(pageId: string): Promise<any[]> {
  try {
    const client = OptimizedLanceDBClient.getInstance();
    const connection = await client.getConnection();
    const table = connection.table;

    const allArrow = await table.query().limit(10000).toArrow();
    
    const chunks: any[] = [];
    const idFieldIndex = allArrow.schema.fields.findIndex((f: any) => f.name === 'id');
    
    if (idFieldIndex === -1) {
      console.error(`[getAllChunksByPageId] 'id' field not found in schema`);
      return [];
    }

    const idVector = allArrow.getChildAt(idFieldIndex);
    if (!idVector) {
      return [];
    }

    for (let i = 0; i < allArrow.numRows; i++) {
      const idValue = idVector.get(i);
      if (idValue && idValue.startsWith(`${pageId}-`)) {
        const row: any = {};
        for (let j = 0; j < allArrow.schema.fields.length; j++) {
          const field = allArrow.schema.fields[j];
          const vector = allArrow.getChildAt(j);
          row[field.name] = vector?.get(i);
        }
        chunks.push(row);
      }
    }

    return chunks;
  } catch (error) {
    console.error(`[getAllChunksByPageId] Error for ${pageId}:`, error);
    return [];
  }
}

async function getPageContent(pageId: string): Promise<string> {
  try {
    const chunks = await getAllChunksByPageId(pageId);
    
    if (chunks.length === 0) {
      return '';
    }
    
    const fullContent = chunks
      .sort((a, b) => {
        const orderA = a.chunkOrder ?? 0;
        const orderB = b.chunkOrder ?? 0;
        return orderA - orderB;
      })
      .map((c: any) => c.content || '')
      .join('\n\n');
    
    return fullContent;
  } catch (error: any) {
    console.error(`[getPageContent] Error for ${pageId}:`, error.message);
    return '';
  }
}

async function expandWithKnowledgeGraph(
  results: any[],
  metrics: { nodesQueried: number; edgesTraversed: number }
): Promise<any[]> {
  const stats = await kgStorageService.getStats();
  
  if (stats.nodeCount === 0) {
    console.log('[KG Expansion] No Knowledge Graph available');
    return results;
  }
  
  const expanded = [...results];
  const addedPageIds = new Set(results.map(r => r.pageId));
  
  for (const result of results) {
    const pageId = result.pageId;
    
    if (!pageId) continue;
    
    // 参照関係を取得（高重み優先）
    const referenced = await kgSearchService.getReferencedPages(pageId, 2);
    metrics.nodesQueried += 1;
    metrics.edgesTraversed += referenced.relatedPages.length;
    
    for (const { node, edge } of referenced.relatedPages) {
      if (addedPageIds.has(node.pageId!)) continue;
      if (expanded.length >= 12) break;
      
      const relatedContent = await getPageContent(node.pageId!);
      
      expanded.push({
        ...node,
        content: relatedContent,
        source: 'knowledge-graph',
        kgWeight: edge.weight,
        kgEdgeType: edge.type
      });
      
      addedPageIds.add(node.pageId!);
    }
    
    // ドメイン関連を追加（12件未満の場合）
    if (expanded.length < 12) {
      const domainRelated = await kgSearchService.getRelatedPagesInDomain(pageId, 1);
      metrics.nodesQueried += 1;
      metrics.edgesTraversed += domainRelated.relatedPages.length;
      
      for (const { node, edge } of domainRelated.relatedPages) {
        if (addedPageIds.has(node.pageId!)) continue;
        if (expanded.length >= 12) break;
        
        const relatedContent = await getPageContent(node.pageId!);
        
        expanded.push({
          ...node,
          content: relatedContent,
          source: 'knowledge-graph',
          kgWeight: edge.weight,
          kgEdgeType: edge.type
        });
        
        addedPageIds.add(node.pageId!);
      }
    }
  }
  
  return expanded;
}

async function runPerformanceTest(testCase: TestCase): Promise<PerformanceMetrics> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🏃 ${testCase.name}`);
  console.log(`📝 クエリ: "${testCase.query}"`);
  console.log(`🎯 期待ページ: ${testCase.expectedPageTitle}`);
  console.log(`${'='.repeat(80)}`);
  
  const totalStartTime = Date.now();
  
  // 1. ハイブリッド検索
  console.log('\n[Phase 1] ハイブリッド検索実行中...');
  const searchStartTime = Date.now();
  
  const searchResults = await searchLanceDB({
    query: testCase.query,
    topK: 50,
    minScore: 0.3,
    titleWeight: 3.0 // Phase 0A-3 FIX: タイトルマッチングを有効化
  });
  
  const searchTime = Date.now() - searchStartTime;
  console.log(`✅ 検索完了: ${searchTime}ms (${searchResults.length}件)`);
  
  // 2. チャンク統合処理（Phase 0A-3最適化）
  console.log('\n[Phase 2] チャンク統合処理中...');
  const chunkMergeStartTime = Date.now();
  
  const mapped = searchResults.slice(0, 12).map((r: any) => ({
    id: r.id,
    pageId: r.pageId || r.id,
    title: r.title,
    content: r.content,
    isChunked: r.isChunked,  // Phase 0A-3フラグ
    url: r.url,
    lastUpdated: r.lastUpdated,
    labels: r.labels || [],
    score: r.score,
    source: r.source,
    scoreText: r.scoreText,
  }));
  
  const enriched = await enrichWithAllChunks(mapped);
  const chunkMergeTime = Date.now() - chunkMergeStartTime;
  console.log(`✅ チャンク統合完了: ${chunkMergeTime}ms`);
  
  // 3. 空ページフィルター
  console.log('\n[Phase 3] 空ページフィルタリング中...');
  const filterStartTime = Date.now();
  
  const filtered = await filterInvalidPagesServer(enriched);
  const filterTime = Date.now() - filterStartTime;
  console.log(`✅ フィルタリング完了: ${filterTime}ms (${filtered.length}件)`);
  
  // 4. Knowledge Graph拡張
  console.log('\n[Phase 4] Knowledge Graph拡張中...');
  const kgStartTime = Date.now();
  
  const kgMetrics = { nodesQueried: 0, edgesTraversed: 0 };
  const expandedResults = await expandWithKnowledgeGraph(
    filtered.slice(0, 8),
    kgMetrics
  );
  
  const kgExpansionTime = Date.now() - kgStartTime;
  console.log(`✅ KG拡張完了: ${kgExpansionTime}ms`);
  console.log(`   初期結果: ${searchResults.length}件 → 拡張後: ${expandedResults.length}件`);
  console.log(`   クエリしたノード: ${kgMetrics.nodesQueried}個`);
  console.log(`   走査したエッジ: ${kgMetrics.edgesTraversed}本`);
  
  const totalTime = Date.now() - totalStartTime;
  
  // 結果品質チェック
  const topResult = expandedResults[0];
  const topResultTitle = topResult?.title || 'N/A';
  
  let expectedRank: number | undefined;
  let expectedFound = false;
  
  for (let i = 0; i < expandedResults.length; i++) {
    const result = expandedResults[i];
    if (result.title && result.title.includes(testCase.expectedPageTitle)) {
      expectedFound = true;
      expectedRank = i + 1;
      break;
    }
  }
  
  console.log('\n[結果品質]');
  console.log(`   Top 1: ${topResultTitle}`);
  console.log(`   期待ページ発見: ${expectedFound ? '✅' : '❌'}`);
  if (expectedRank) {
    console.log(`   期待ページ順位: ${expectedRank}位`);
  }
  
  console.log('\n[パフォーマンスサマリー]');
  console.log(`   検索時間: ${searchTime}ms`);
  console.log(`   チャンク統合時間: ${chunkMergeTime}ms`);
  console.log(`   フィルタリング時間: ${filterTime}ms`);
  console.log(`   KG拡張時間: ${kgExpansionTime}ms`);
  console.log(`   合計時間: ${totalTime}ms`);
  
  return {
    queryName: testCase.name,
    query: testCase.query,
    searchTime,
    chunkMergeTime,
    filterTime,
    kgExpansionTime,
    kgNodesQueried: kgMetrics.nodesQueried,
    kgEdgesTraversed: kgMetrics.edgesTraversed,
    initialResults: searchResults.length,
    expandedResults: expandedResults.length,
    totalTime,
    topResultTitle,
    expectedFound,
    expectedRank
  };
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║         Phase 0A-2 パフォーマンステスト                                  ║');
  console.log('║         Knowledge Graph統合後の検索パフォーマンス測定                    ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝\n');
  
  // Knowledge Graph統計情報
  console.log('📊 Knowledge Graph統計情報:');
  const kgStats = await kgStorageService.getStats();
  console.log(`   ノード数: ${kgStats.nodeCount.toLocaleString()}件`);
  console.log(`   エッジ数: ${kgStats.edgeCount.toLocaleString()}件`);
  console.log('');
  
  const allMetrics: PerformanceMetrics[] = [];
  
  // 各テストケースを実行
  for (const testCase of TEST_CASES) {
    const metrics = await runPerformanceTest(testCase);
    allMetrics.push(metrics);
    
    // クールダウン
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 集計レポート
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║                         📊 パフォーマンスレポート                        ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝\n');
  
  // パフォーマンス統計
  const avgSearchTime = allMetrics.reduce((sum, m) => sum + m.searchTime, 0) / allMetrics.length;
  const avgChunkMergeTime = allMetrics.reduce((sum, m) => sum + m.chunkMergeTime, 0) / allMetrics.length;
  const avgFilterTime = allMetrics.reduce((sum, m) => sum + m.filterTime, 0) / allMetrics.length;
  const avgKgTime = allMetrics.reduce((sum, m) => sum + m.kgExpansionTime, 0) / allMetrics.length;
  const avgTotalTime = allMetrics.reduce((sum, m) => sum + m.totalTime, 0) / allMetrics.length;
  const avgKgNodes = allMetrics.reduce((sum, m) => sum + m.kgNodesQueried, 0) / allMetrics.length;
  const avgKgEdges = allMetrics.reduce((sum, m) => sum + m.kgEdgesTraversed, 0) / allMetrics.length;
  const avgExpansion = allMetrics.reduce((sum, m) => sum + (m.expandedResults - m.initialResults), 0) / allMetrics.length;
  
  console.log('⏱️  平均パフォーマンス:');
  console.log(`   検索時間:            ${avgSearchTime.toFixed(1)}ms`);
  console.log(`   チャンク統合時間:    ${avgChunkMergeTime.toFixed(1)}ms`);
  console.log(`   フィルタリング時間:  ${avgFilterTime.toFixed(1)}ms`);
  console.log(`   KG拡張時間:          ${avgKgTime.toFixed(1)}ms`);
  console.log(`   合計時間:            ${avgTotalTime.toFixed(1)}ms`);
  console.log(`   KGオーバーヘッド:    ${((avgKgTime / avgTotalTime) * 100).toFixed(1)}%`);
  console.log('');
  
  console.log('🕸️  Knowledge Graph統計:');
  console.log(`   平均クエリノード:  ${avgKgNodes.toFixed(1)}個`);
  console.log(`   平均走査エッジ:    ${avgKgEdges.toFixed(1)}本`);
  console.log(`   平均拡張数:        +${avgExpansion.toFixed(1)}件`);
  console.log('');
  
  // 品質統計
  const foundCount = allMetrics.filter(m => m.expectedFound).length;
  const top3Count = allMetrics.filter(m => m.expectedRank && m.expectedRank <= 3).length;
  
  console.log('🎯 検索品質:');
  console.log(`   発見率:            ${foundCount}/${allMetrics.length} (${((foundCount / allMetrics.length) * 100).toFixed(0)}%)`);
  console.log(`   Top 3 以内:       ${top3Count}/${allMetrics.length} (${((top3Count / allMetrics.length) * 100).toFixed(0)}%)`);
  console.log('');
  
  // 詳細テーブル
  console.log('📋 詳細結果:');
  console.log('━'.repeat(120));
  console.log(
    '事例'.padEnd(20) +
    '検索時間'.padStart(10) +
    'KG拡張時間'.padStart(12) +
    '合計時間'.padStart(10) +
    '初期結果'.padStart(10) +
    '拡張後'.padStart(8) +
    '発見'.padStart(8) +
    '順位'.padStart(6)
  );
  console.log('━'.repeat(120));
  
  for (const m of allMetrics) {
    const name = m.queryName.replace('事例', '').split(':')[0].trim();
    console.log(
      name.padEnd(20) +
      `${m.searchTime}ms`.padStart(10) +
      `${m.kgExpansionTime}ms`.padStart(12) +
      `${m.totalTime}ms`.padStart(10) +
      `${m.initialResults}件`.padStart(10) +
      `${m.expandedResults}件`.padStart(8) +
      (m.expectedFound ? '✅' : '❌').padStart(8) +
      (m.expectedRank ? `${m.expectedRank}位` : '-').padStart(6)
    );
  }
  console.log('━'.repeat(120));
  
  // パフォーマンス評価
  console.log('\n💡 パフォーマンス評価:');
  
  if (avgTotalTime < 100) {
    console.log('   ✅ 優秀 - 平均レスポンス時間が100ms未満');
  } else if (avgTotalTime < 200) {
    console.log('   ✅ 良好 - 平均レスポンス時間が200ms未満');
  } else if (avgTotalTime < 500) {
    console.log('   ⚠️  許容範囲 - 平均レスポンス時間が500ms未満');
  } else {
    console.log('   ❌ 改善必要 - 平均レスポンス時間が500ms以上');
  }
  
  const kgOverhead = (avgKgTime / avgTotalTime) * 100;
  if (kgOverhead < 20) {
    console.log(`   ✅ KGオーバーヘッドが低い (${kgOverhead.toFixed(1)}%)`);
  } else if (kgOverhead < 40) {
    console.log(`   ⚠️  KGオーバーヘッドが中程度 (${kgOverhead.toFixed(1)}%)`);
  } else {
    console.log(`   ❌ KGオーバーヘッドが高い (${kgOverhead.toFixed(1)}%)`);
  }
  
  if (foundCount === allMetrics.length) {
    console.log('   ✅ 完璧な発見率 (100%)');
  } else if (foundCount >= allMetrics.length * 0.8) {
    console.log(`   ⚠️  発見率が良好 (${((foundCount / allMetrics.length) * 100).toFixed(0)}%)`);
  } else {
    console.log(`   ❌ 発見率が低い (${((foundCount / allMetrics.length) * 100).toFixed(0)}%)`);
  }
  
  console.log('\n✅ パフォーマンステスト完了\n');
  
  // LanceDB接続をクリーンアップ
  const client = OptimizedLanceDBClient.getInstance();
  await client.disconnect();
}

main().catch(console.error);

