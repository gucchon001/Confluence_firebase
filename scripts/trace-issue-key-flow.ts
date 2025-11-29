/**
 * Issue Key完全一致検索結果の追跡スクリプト
 * 
 * 目的: Issue Key完全一致の結果がどの時点で失われるかをステップバイステップで追跡
 */

import 'dotenv/config';
import { searchLanceDB } from '../src/lib/lancedb-search-client';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Issue Key完全一致検索結果の追跡');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const query = 'CTJ-5439';
  console.log(`🔍 Query: ${query}\n`);

  try {
    // 環境変数を設定してデバッグログを有効化
    process.env.NODE_ENV = 'development';
    process.env.DEBUG_SEARCH = 'true';

    console.log('【ステップ1】検索実行開始...\n');
    
    const startTime = Date.now();
    const results = await searchLanceDB({
      query,
      topK: 5,
      tableName: 'jira_issues',
      labelFilters: { includeMeetingNotes: false }
    });
    const searchTime = Date.now() - startTime;

    console.log(`\n【ステップ2】検索完了: ${results.length}件（検索時間: ${searchTime}ms）\n`);

    if (results.length === 0) {
      console.log('⚠️  検索結果が0件です\n');
      return;
    }

    console.log('【ステップ3】最終検索結果の確認\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    let foundExactMatch = false;
    let exactMatchPosition = -1;

    for (let i = 0; i < Math.min(10, results.length); i++) {
      const result = results[i];
      const issueKey = result.issue_key || result.id;
      const title = result.title || 'タイトル不明';
      
      console.log(`${i + 1}. ${issueKey} - ${title.substring(0, 60)}...`);
      console.log(`   ソース: ${result.source || 'unknown'}`);
      console.log(`   RRFスコア: ${(result as any)._rrfScore?.toFixed(4) || 'N/A'}`);
      console.log(`   Composite Score: ${(result as any)._compositeScore?.toFixed(4) || 'N/A'}`);
      console.log(`   距離: ${result.distance?.toFixed(4) || 'N/A'}`);
      
      // Issue Key完全一致検索の結果かどうかを確認
      if ((result as any)._issueKeyExact === true) {
        console.log(`   ✅ Issue Key完全一致検索の結果（マーカー付き）`);
        foundExactMatch = true;
        exactMatchPosition = i + 1;
      }
      
      // Issue Keyが期待値と一致しているか確認
      if (issueKey === query) {
        console.log(`   ✅ Issue Key完全一致: ${issueKey} === ${query}`);
        if (exactMatchPosition === -1) {
          exactMatchPosition = i + 1;
        }
      }
      
      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('【ステップ4】サマリー');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const issueKeyExactCount = results.filter(r => (r as any)._issueKeyExact === true).length;
    const issueKeyMatchCount = results.filter(r => (r.issue_key || r.id) === query).length;
    const firstResultIsExact = results.length > 0 && ((results[0].issue_key || results[0].id) === query);
    
    console.log(`総検索結果: ${results.length}件`);
    console.log(`Issue Key完全一致検索の結果（マーカー付き）: ${issueKeyExactCount}件`);
    console.log(`Issue Key一致の結果: ${issueKeyMatchCount}件`);
    console.log(`最初の結果が期待値と一致: ${firstResultIsExact ? 'はい' : 'いいえ'}`);
    console.log(`検索時間: ${searchTime}ms`);
    
    if (firstResultIsExact && issueKeyExactCount > 0) {
      console.log(`\n✅ 成功: Issue Key ${query} が最優先で返されました（位置: 1位）`);
    } else if (issueKeyMatchCount > 0) {
      console.log(`\n⚠️  注意: Issue Key ${query} は見つかりましたが、最優先ではありません（位置: ${exactMatchPosition}位）`);
      if (issueKeyExactCount === 0) {
        console.log(`   問題: Issue Key完全一致のマーカー（_issueKeyExact）が失われています`);
      }
    } else {
      console.log(`\n❌ 問題: Issue Key ${query} が検索結果に含まれていません`);
    }
    
    console.log('');

  } catch (error) {
    console.error(`❌ エラー:`, error);
    if (error instanceof Error) {
      console.error('   エラー詳細:', error.message);
      console.error('   スタックトレース:', error.stack);
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 追跡完了');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((error) => {
  console.error('❌ 予期しないエラー:', error);
  process.exit(1);
});

