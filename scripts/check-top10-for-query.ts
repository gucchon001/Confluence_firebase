/**
 * クエリに対する上位10件のスコアを確認
 * 045_【FIX】パスワード再設定機能が上位10件に入る可能性を評価
 */

// 環境変数を読み込み
import * as dotenv from 'dotenv';
dotenv.config();

import { searchLanceDB } from '../src/lib/lancedb-search-client';
import { getPageIdFromRecord } from '../src/lib/pageid-migration-helper';

async function checkTop10() {
  console.log('🔍 上位10件のスコア確認\n');
  console.log('='.repeat(80));
  
  const testQuery = '退会した会員が同じアドレス使ったらどんな表示がでますか';
  const targetPageId = '703594590'; // 045_【FIX】パスワード再設定機能
  const MAX_CONTEXT_DOCS = 10; // 参照元として使用される件数
  
  console.log(`📋 テストクエリ: "${testQuery}"\n`);
  console.log(`🎯 対象ページID: ${targetPageId} (045_【FIX】パスワード再設定機能)\n`);
  console.log(`📊 参照元として使用される件数: ${MAX_CONTEXT_DOCS}件\n`);
  
  try {
    // 検索を実行
    console.log('🔍 検索実行中...\n');
    const results = await searchLanceDB({
      query: testQuery,
      topK: 60,
      useLunrIndex: true,
      labelFilters: {
        includeMeetingNotes: false
      }
    });
    
    console.log(`✅ 検索完了: ${results.length}件の結果\n`);
    console.log('='.repeat(80));
    
    // 上位10件を表示
    console.log(`\n📋 上位${MAX_CONTEXT_DOCS}件（参照元として使用される）:\n`);
    const top10 = results.slice(0, MAX_CONTEXT_DOCS);
    
    for (let i = 0; i < top10.length; i++) {
      const result = top10[i];
      const pageId = String(getPageIdFromRecord(result) || '');
      const score = (result as any).score ?? (result as any)._compositeScore ?? (result as any)._score;
      const compositeScore = (result as any)._compositeScore;
      const rrfScore = (result as any)._rrfScore ?? (result as any).rrfScore;
      
      console.log(`[RANK ${i + 1}]`);
      console.log(`   タイトル: ${result.title}`);
      console.log(`   pageId: ${pageId}`);
      console.log(`   score: ${score !== undefined && score !== null ? (typeof score === 'number' ? score.toFixed(4) : String(score)) : 'N/A'}`);
      if (compositeScore !== undefined) {
        console.log(`   _compositeScore: ${compositeScore.toFixed(6)}`);
      }
      if (rrfScore !== undefined) {
        console.log(`   _rrfScore: ${rrfScore.toFixed(6)}`);
      }
      if (result.structured_category) {
        console.log(`   category: ${result.structured_category}`);
      }
      if (result.structured_tags && Array.isArray(result.structured_tags) && result.structured_tags.length > 0) {
        console.log(`   tags: ${result.structured_tags.join(', ')}`);
      }
      console.log('');
    }
    
    // 対象ページの位置を確認
    const targetIndex = results.findIndex(r => String(getPageIdFromRecord(r) || '') === targetPageId);
    const targetRank = targetIndex >= 0 ? targetIndex + 1 : -1;
    
    console.log('='.repeat(80));
    console.log(`\n🎯 対象ページの位置:\n`);
    
    if (targetRank > 0) {
      const targetResult = results[targetIndex];
      const score = (targetResult as any).score ?? (targetResult as any)._compositeScore ?? (targetResult as any)._score;
      const compositeScore = (targetResult as any)._compositeScore;
      const rrfScore = (targetResult as any)._rrfScore ?? (targetResult as any).rrfScore;
      
      console.log(`   順位: ${targetRank}位`);
      console.log(`   タイトル: ${targetResult.title}`);
      console.log(`   score: ${score !== undefined && score !== null ? (typeof score === 'number' ? score.toFixed(4) : String(score)) : 'N/A'}`);
      if (compositeScore !== undefined) {
        console.log(`   _compositeScore: ${compositeScore.toFixed(6)}`);
      }
      if (rrfScore !== undefined) {
        console.log(`   _rrfScore: ${rrfScore.toFixed(6)}`);
      }
      
      // 上位10件との比較
      if (targetRank <= MAX_CONTEXT_DOCS) {
        console.log(`\n✅ 対象ページは上位${MAX_CONTEXT_DOCS}件に含まれています！`);
        console.log(`   参照元として使用されます。`);
      } else {
        const top10MinScore = top10.length > 0 ? 
          Math.min(...top10.map(r => {
            const s = (r as any).score ?? (r as any)._compositeScore ?? (r as any)._score;
            return typeof s === 'number' ? s : 0;
          })) : 0;
        const targetScoreNum = typeof score === 'number' ? score : 0;
        const scoreGap = top10MinScore - targetScoreNum;
        
        console.log(`\n❌ 対象ページは上位${MAX_CONTEXT_DOCS}件に含まれていません。`);
        console.log(`   参照元として使用されません。`);
        console.log(`\n📊 スコア比較:`);
        console.log(`   - 上位${MAX_CONTEXT_DOCS}件の最低スコア: ${top10MinScore.toFixed(4)}`);
        console.log(`   - 対象ページのスコア: ${targetScoreNum.toFixed(4)}`);
        console.log(`   - スコア差: ${scoreGap.toFixed(4)}`);
        console.log(`   - 必要なスコア向上: ${(scoreGap + 0.01).toFixed(4)}以上`);
        
        // 上位10件の平均スコアと比較
        const top10AvgScore = top10.length > 0 ?
          top10.reduce((sum, r) => {
            const s = (r as any).score ?? (r as any)._compositeScore ?? (r as any)._score;
            return sum + (typeof s === 'number' ? s : 0);
          }, 0) / top10.length : 0;
        
        console.log(`\n📈 上位${MAX_CONTEXT_DOCS}件の平均スコア: ${top10AvgScore.toFixed(4)}`);
        console.log(`   対象ページが上位${MAX_CONTEXT_DOCS}件に入るには、`);
        console.log(`   スコアを約${((top10AvgScore / targetScoreNum) * 100 - 100).toFixed(1)}%向上させる必要があります。`);
      }
    } else {
      console.log(`❌ 対象ページが検索結果に見つかりませんでした。`);
    }
    
    console.log('\n' + '='.repeat(80));
    
  } catch (error: any) {
    console.error('\n❌ エラー:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

// 実行
checkTop10();

