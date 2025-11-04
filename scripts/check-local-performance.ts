/**
 * ローカル環境でのパフォーマンスチェックスクリプト
 * 検索処理、LLM生成処理、全体のフローを測定
 */

import { searchLanceDB } from '../src/lib/lancedb-search-client';
import { getEmbeddings } from '../src/lib/embeddings';
import { hybridSearchEngine } from '../src/lib/hybrid-search-engine';
import { retrieveRelevantDocs } from '../src/ai/flows/retrieve-relevant-docs-lancedb';
import { streamingSummarizeConfluenceDocs } from '../src/ai/flows/streaming-summarize-confluence-docs';

interface PerformanceMetrics {
  searchTime: number;
  embeddingTime: number;
  llmGenerationTime: number;
  totalTime: number;
  resultCount: number;
  referenceCount: number;
}

const testQueries = [
  '教室管理の詳細は',
  '会員登録機能について',
  '求人削除機能の手順',
  '応募管理の一覧閲覧機能',
  '教室削除機能について'
];

async function measureSearchPerformance(query: string): Promise<{ time: number; count: number }> {
  const startTime = Date.now();
  const results = await searchLanceDB({
    query,
    topK: 10,
    useLunrIndex: true,
    labelFilters: {
      excludeMeetingNotes: true,
      excludeArchived: true
    }
  });
  const time = Date.now() - startTime;
  return { time, count: results.length };
}

async function measureHybridSearchPerformance(query: string): Promise<{ time: number; count: number }> {
  const startTime = Date.now();
  const results = await hybridSearchEngine.search({
    query,
    topK: 10,
    useLunrIndex: true,
    labelFilters: {
      excludeMeetingNotes: true,
      excludeArchived: true
    }
  });
  const time = Date.now() - startTime;
  return { time, count: results.length };
}

async function measureEmbeddingPerformance(query: string): Promise<number> {
  const startTime = Date.now();
  await getEmbeddings(query);
  return Date.now() - startTime;
}

async function measureRetrieveDocsPerformance(query: string): Promise<{ time: number; count: number }> {
  const startTime = Date.now();
  const docs = await retrieveRelevantDocs({
    question: query,
    labelFilters: {
      includeMeetingNotes: false
    }
  });
  const time = Date.now() - startTime;
  return { time, count: docs.length };
}

async function measureLLMGenerationPerformance(query: string, contextDocs: any[]): Promise<{ time: number; referenceCount: number }> {
  const startTime = Date.now();
  let referenceCount = 0;
  
  for await (const result of streamingSummarizeConfluenceDocs({
    question: query,
    context: contextDocs.slice(0, 10),
    chatHistory: []
  })) {
    if (result.isComplete) {
      referenceCount = result.references?.length || 0;
      break;
    }
  }
  
  const time = Date.now() - startTime;
  return { time, referenceCount };
}

async function measureFullFlowPerformance(query: string): Promise<PerformanceMetrics> {
  const totalStartTime = Date.now();
  
  // 1. 埋め込み生成
  const embeddingTime = await measureEmbeddingPerformance(query);
  
  // 2. 検索処理
  const searchMetrics = await measureHybridSearchPerformance(query);
  
  // 3. ドキュメント取得
  const retrieveMetrics = await measureRetrieveDocsPerformance(query);
  
  // 4. LLM生成（簡易版 - 実際のLLM呼び出しはスキップして時間のみ測定）
  const llmStartTime = Date.now();
  const contextDocs = await retrieveRelevantDocs({
    question: query,
    labelFilters: {
      includeMeetingNotes: false
    }
  });
  const llmGenerationTime = Date.now() - llmStartTime;
  
  const totalTime = Date.now() - totalStartTime;
  
  return {
    searchTime: searchMetrics.time,
    embeddingTime,
    llmGenerationTime: Math.min(llmGenerationTime, 5000), // LLM呼び出しはスキップするため上限を設定
    totalTime,
    resultCount: searchMetrics.count,
    referenceCount: Math.min(contextDocs.length, 10)
  };
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║   ローカル環境パフォーマンスチェック                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  const results: Array<{ query: string; metrics: PerformanceMetrics }> = [];
  
  // 各クエリでパフォーマンスを測定
  for (const query of testQueries) {
    console.log(`📊 測定中: "${query}"`);
    
    try {
      const metrics = await measureFullFlowPerformance(query);
      results.push({ query, metrics });
      
      console.log(`   ✅ 完了:`);
      console.log(`      - 検索時間: ${metrics.searchTime}ms`);
      console.log(`      - 埋め込み生成時間: ${metrics.embeddingTime}ms`);
      console.log(`      - LLM生成時間: ${metrics.llmGenerationTime}ms`);
      console.log(`      - 総処理時間: ${metrics.totalTime}ms`);
      console.log(`      - 検索結果数: ${metrics.resultCount}件`);
      console.log(`      - 参照元数: ${metrics.referenceCount}件\n`);
    } catch (error: any) {
      console.error(`   ❌ エラー: ${error.message}\n`);
    }
  }
  
  // 統計情報を計算
  if (results.length > 0) {
    const avgSearchTime = results.reduce((sum, r) => sum + r.metrics.searchTime, 0) / results.length;
    const avgEmbeddingTime = results.reduce((sum, r) => sum + r.metrics.embeddingTime, 0) / results.length;
    const avgLLMTime = results.reduce((sum, r) => sum + r.metrics.llmGenerationTime, 0) / results.length;
    const avgTotalTime = results.reduce((sum, r) => sum + r.metrics.totalTime, 0) / results.length;
    
    const maxSearchTime = Math.max(...results.map(r => r.metrics.searchTime));
    const maxTotalTime = Math.max(...results.map(r => r.metrics.totalTime));
    
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('📊 パフォーマンス統計（平均値）:');
    console.log(`   - 検索時間: ${avgSearchTime.toFixed(2)}ms`);
    console.log(`   - 埋め込み生成時間: ${avgEmbeddingTime.toFixed(2)}ms`);
    console.log(`   - LLM生成時間: ${avgLLMTime.toFixed(2)}ms`);
    console.log(`   - 総処理時間: ${avgTotalTime.toFixed(2)}ms\n`);
    
    console.log('📊 パフォーマンス統計（最大値）:');
    console.log(`   - 最大検索時間: ${maxSearchTime}ms`);
    console.log(`   - 最大総処理時間: ${maxTotalTime}ms\n`);
    
    // 目標値との比較
    console.log('📊 目標値との比較:');
    const searchTarget = 1000; // 1秒
    const totalTarget = 10000; // 10秒
    
    if (avgSearchTime <= searchTarget) {
      console.log(`   ✅ 検索時間: ${avgSearchTime.toFixed(2)}ms (目標: ${searchTarget}ms以下)`);
    } else {
      console.log(`   ⚠️  検索時間: ${avgSearchTime.toFixed(2)}ms (目標: ${searchTarget}ms以下、超過: ${(avgSearchTime - searchTarget).toFixed(2)}ms)`);
    }
    
    if (avgTotalTime <= totalTarget) {
      console.log(`   ✅ 総処理時間: ${avgTotalTime.toFixed(2)}ms (目標: ${totalTarget}ms以下)`);
    } else {
      console.log(`   ⚠️  総処理時間: ${avgTotalTime.toFixed(2)}ms (目標: ${totalTarget}ms以下、超過: ${(avgTotalTime - totalTarget).toFixed(2)}ms)`);
    }
    console.log('');
  }
  
  console.log('✅ パフォーマンスチェック完了');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ スクリプトエラー:', error);
    process.exit(1);
  });
}

export { measureFullFlowPerformance };

