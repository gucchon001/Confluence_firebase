/**
 * パフォーマンス分析ツール
 * 各処理の詳細な時間測定
 */

import { unifiedKeywordExtractionService } from '../lib/unified-keyword-extraction-service';
import { getEmbeddings } from '../lib/embeddings';
import { lancedbClient } from '../lib/lancedb-client';
import { lunrSearchClient } from '../lib/lunr-search-client';

async function analyzePerformance() {
  console.log('🔍 パフォーマンス分析開始');
  console.log('=' .repeat(60));

  const testQuery = '教室管理の詳細は';

  // 1. キーワード抽出の時間測定
  console.log('1. キーワード抽出の時間測定');
  const keywordStart = Date.now();
  const keywords = await unifiedKeywordExtractionService.extractKeywordsConfigured(testQuery);
  const keywordTime = Date.now() - keywordStart;
  console.log(`   時間: ${keywordTime}ms`);
  console.log(`   キーワード数: ${keywords.length}`);
  console.log('');

  // 2. 埋め込み生成の時間測定
  console.log('2. 埋め込み生成の時間測定');
  const embeddingStart = Date.now();
  const embedding = await getEmbeddings(testQuery);
  const embeddingTime = Date.now() - embeddingStart;
  console.log(`   時間: ${embeddingTime}ms`);
  console.log(`   ベクトル次元: ${embedding.length}`);
  console.log('');

  // 3. LanceDB接続の時間測定
  console.log('3. LanceDB接続の時間測定');
  const lancedbStart = Date.now();
  await lancedbClient.connect();
  const table = await lancedbClient.getTable();
  const lancedbTime = Date.now() - lancedbStart;
  console.log(`   接続時間: ${lancedbTime}ms`);
  console.log('');

  // 4. LanceDB検索の時間測定
  console.log('4. LanceDB検索の時間測定');
  const searchStart = Date.now();
  const dummyVector = new Array(768).fill(0);
  const searchResults = await table.search(dummyVector).limit(10).toArray();
  const searchTime = Date.now() - searchStart;
  console.log(`   検索時間: ${searchTime}ms`);
  console.log(`   結果数: ${searchResults.length}`);
  console.log('');

  // 5. Lunr検索の時間測定
  console.log('5. Lunr検索の時間測定');
  const lunrStart = Date.now();
  const lunrResults = await lunrSearchClient.search(testQuery, 10);
  const lunrTime = Date.now() - lunrStart;
  console.log(`   検索時間: ${lunrTime}ms`);
  console.log(`   結果数: ${lunrResults.length}`);
  console.log('');

  // 6. 総合時間の計算
  const totalTime = keywordTime + embeddingTime + lancedbTime + searchTime + lunrTime;
  console.log('📊 パフォーマンス分析結果');
  console.log('=' .repeat(60));
  console.log(`キーワード抽出: ${keywordTime}ms (${Math.round(keywordTime/totalTime*100)}%)`);
  console.log(`埋め込み生成: ${embeddingTime}ms (${Math.round(embeddingTime/totalTime*100)}%)`);
  console.log(`LanceDB接続: ${lancedbTime}ms (${Math.round(lancedbTime/totalTime*100)}%)`);
  console.log(`LanceDB検索: ${searchTime}ms (${Math.round(searchTime/totalTime*100)}%)`);
  console.log(`Lunr検索: ${lunrTime}ms (${Math.round(lunrTime/totalTime*100)}%)`);
  console.log(`総合時間: ${totalTime}ms`);
  console.log('');

  // 7. ボトルネックの特定
  const bottlenecks = [];
  if (keywordTime > 100) bottlenecks.push(`キーワード抽出 (${keywordTime}ms)`);
  if (embeddingTime > 1000) bottlenecks.push(`埋め込み生成 (${embeddingTime}ms)`);
  if (lancedbTime > 500) bottlenecks.push(`LanceDB接続 (${lancedbTime}ms)`);
  if (searchTime > 1000) bottlenecks.push(`LanceDB検索 (${searchTime}ms)`);
  if (lunrTime > 500) bottlenecks.push(`Lunr検索 (${lunrTime}ms)`);

  if (bottlenecks.length > 0) {
    console.log('⚠️  ボトルネック:');
    bottlenecks.forEach(bottleneck => console.log(`   - ${bottleneck}`));
  } else {
    console.log('✅ ボトルネックなし');
  }

  console.log('\n✅ パフォーマンス分析完了');
}

// テスト実行
analyzePerformance().catch(error => {
  console.error('❌ 分析エラー:', error);
  process.exit(1);
});
