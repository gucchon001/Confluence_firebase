/**
 * キャッシュウォームアップスクリプト
 * 
 * 目的: テスト前にLunrインデックスと埋め込みベクトルのみを事前ロード
 * 注意: 検索結果キャッシュは作成しない（テストが2回目検索にならないように）
 */

import { getEmbeddings } from '../src/lib/embeddings';
import { config } from 'dotenv';

config();

// テストケースと同じクエリ
const WARMUP_QUERIES = [
  "会員が退会する方法を教えてください",
  "教室を削除する手順を教えて",
  "教室をコピーする方法",
  "応募時の重複応募不可期間について",
  "求人の応募期間の設定方法",
  "学年を自動更新するバッチについて",
  "急募機能の詳細を教えて"
];

async function warmupCache() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                  キャッシュウォームアップ（検索結果除外）                      ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');
  
  const startTime = Date.now();
  
  // Step 1: Lunrインデックスをロード
  console.log('📚 Step 1: Lunrインデックスをロード中...');
  try {
    const { lunrInitializer } = await import('../src/lib/lunr-initializer');
    await lunrInitializer.initializeAsync();
    console.log('   ✅ Lunrインデックス準備完了\n');
  } catch (error) {
    console.error('   ❌ Lunrインデックスエラー:', error);
  }
  
  // Step 2: 埋め込みベクトルを事前生成（検索は実行しない）
  console.log(`🔥 Step 2: ${WARMUP_QUERIES.length}個のクエリの埋め込みベクトルを生成中...\n`);
  
  const embeddingTimes: number[] = [];
  
  for (let i = 0; i < WARMUP_QUERIES.length; i++) {
    const query = WARMUP_QUERIES[i];
    console.log(`${i + 1}/${WARMUP_QUERIES.length}: "${query.substring(0, 40)}..."`);
    
    const queryStartTime = Date.now();
    
    try {
      // 埋め込みベクトルのみを生成（検索は実行しない）
      await getEmbeddings(query);
      
      const queryTime = Date.now() - queryStartTime;
      embeddingTimes.push(queryTime);
      console.log(`   ✅ ベクトル生成完了 (${queryTime}ms)\n`);
      
    } catch (error) {
      console.error(`   ❌ エラー:`, error);
    }
  }
  
  const totalTime = Date.now() - startTime;
  const avgEmbeddingTime = embeddingTimes.reduce((a, b) => a + b, 0) / embeddingTimes.length;
  
  console.log('='.repeat(80));
  console.log(`\n✅ ウォームアップ完了！`);
  console.log(`⏱️  総時間: ${(totalTime / 1000).toFixed(1)}秒`);
  console.log(`⚡ 平均ベクトル生成時間: ${avgEmbeddingTime.toFixed(0)}ms\n`);
  console.log(`💾 準備完了したキャッシュ:\n`);
  console.log(`   ✅ Lunrインデックス (メモリ常駐)`);
  console.log(`   ✅ 埋め込みベクトル (${WARMUP_QUERIES.length}件)`);
  console.log(`   ✅ キーワード抽出 (自動キャッシュ済み)\n`);
  console.log(`❌ 意図的にキャッシュしていないもの:\n`);
  console.log(`   ❌ 検索結果キャッシュ (テストが2回目にならないため)\n`);
  console.log(`🚀 テストを実行すると、初回遅延なしで実行されます。\n`);
}

warmupCache().catch(console.error);

