/**
 * Phase 0A-4 vs 現在の検索距離比較
 * 同じクエリで、同じページの検索距離が変わっているのか確認
 */

import * as lancedb from '@lancedb/lancedb';
import { getEmbeddings } from '../src/lib/embeddings';
import { OptimizedLanceDBClient } from '../src/lib/optimized-lancedb-client';
import { config } from 'dotenv';

config();

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║       検索距離比較: Phase 0A-4 vs 現在                                 ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

  const testCases = [
    {
      query: '塾講師プロフィールの学年・職業を更新する方法を教えてください',
      expectedPage: '721_【作成中】学年自動更新バッチ'
    },
    {
      query: '教室をコピーする方法を教えてください',
      expectedPage: '168_【FIX】教室コピー機能'
    },
    {
      query: '会員の退会手続きを教えて',
      expectedPage: '046_【FIX】会員退会機能'
    }
  ];

  try {
    // 現在のLanceDB
    console.log('📊 現在のLanceDB接続...');
    const dbCurrent = await lancedb.connect('.lancedb');
    const tableCurrent = await dbCurrent.openTable('confluence');
    
    // Phase 0A-4のLanceDB
    console.log('📊 Phase 0A-4のLanceDB接続...\n');
    const dbBefore = await lancedb.connect('.lancedb.backup.label-sync.1760528975460');
    const tableBefore = await dbBefore.openTable('confluence');
    
    for (const testCase of testCases) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📝 クエリ: "${testCase.query}"`);
      console.log(`🎯 期待ページ: ${testCase.expectedPage}\n`);
      
      // クエリをベクトル化
      console.log('🔧 クエリをベクトル化中...');
      const vector = await getEmbeddings(testCase.query);
      console.log(`✅ ベクトル取得完了（次元数: ${vector.length}）\n`);
      
      // 現在のLanceDBで検索
      console.log('🔍 現在のLanceDBで検索...');
      const currentResults = await tableCurrent
        .search(vector)
        .limit(100)
        .toArray();
      
      const currentMatch = currentResults.find((r: any) => r.title === testCase.expectedPage);
      const currentRank = currentResults.findIndex((r: any) => r.title === testCase.expectedPage) + 1;
      
      if (currentMatch) {
        console.log(`✅ 発見: #${currentRank}`);
        console.log(`   距離: ${currentMatch._distance.toFixed(6)}`);
      } else {
        console.log(`❌ Top 100に見つかりませんでした`);
      }
      
      // Phase 0A-4のLanceDBで検索
      console.log('\n🔍 Phase 0A-4のLanceDBで検索...');
      const beforeResults = await tableBefore
        .search(vector)
        .limit(100)
        .toArray();
      
      const beforeMatch = beforeResults.find((r: any) => r.title === testCase.expectedPage);
      const beforeRank = beforeResults.findIndex((r: any) => r.title === testCase.expectedPage) + 1;
      
      if (beforeMatch) {
        console.log(`✅ 発見: #${beforeRank}`);
        console.log(`   距離: ${beforeMatch._distance.toFixed(6)}`);
      } else {
        console.log(`❌ Top 100に見つかりませんでした`);
      }
      
      // 比較
      console.log('\n📊 比較:');
      if (currentMatch && beforeMatch) {
        const distanceDiff = currentMatch._distance - beforeMatch._distance;
        const rankDiff = currentRank - beforeRank;
        
        console.log(`   距離の差分: ${distanceDiff >= 0 ? '+' : ''}${distanceDiff.toFixed(6)}`);
        console.log(`   順位の差分: ${rankDiff >= 0 ? '+' : ''}${rankDiff}`);
        
        if (Math.abs(distanceDiff) < 0.000001) {
          console.log(`   → ✅ 距離は完全一致（ベクトル検索結果は同じ）`);
        } else if (Math.abs(distanceDiff) < 0.01) {
          console.log(`   → ⚠️  距離がわずかに異なる（誤差範囲）`);
        } else {
          console.log(`   → ❌ 距離が大きく異なる`);
        }
      } else if (!currentMatch && !beforeMatch) {
        console.log(`   → ❌ 両方でTop 100外`);
      } else {
        console.log(`   → ❌ 片方でのみ発見`);
      }
      
      console.log('');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 結論:\n');
    console.log('もしベクトル検索の距離と順位が同じ場合:');
    console.log('  → ベクトル検索結果は変わっていない');
    console.log('  → 順位劣化の原因は、BM25・RRF・CompositeScoringなど後段の処理');
    console.log('  → 今後のページ増減は、ベクトル検索順位に影響しない ✅');
    console.log('\nもしベクトル検索の距離や順位が異なる場合:');
    console.log('  → LanceDBのインデックスやアルゴリズムが変わった');
    console.log('  → 今後のページ増減で、ベクトル検索順位が変動する可能性 ⚠️');

  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error);
  } finally {
    const client = OptimizedLanceDBClient.getInstance();
    client.resetConnection();
    await client.disconnect();
  }
}

main();



