/**
 * 参照元フィルタリングのテスト
 * LLMが実際に使用した参照元のみが最終的に表示されるか検証
 */

import { loadTestEnv } from './test-helpers/env-loader';

// 環境変数の読み込み
loadTestEnv();

async function testReferenceFiltering() {
  console.log('🔍 参照元フィルタリングテスト開始\n');
  console.log('='.repeat(70));
  
  // テストクエリ（参照元が明示的に使われるような質問）
  const testQueries = [
    {
      query: '教室管理の詳細について教えてください',
      description: '具体的な機能に関する質問'
    },
    {
      query: 'ログイン認証の仕組み',
      description: '認証機能に関する質問'
    },
    {
      query: '会員登録機能について',
      description: '機能に関する質問'
    }
  ];

  for (let i = 0; i < testQueries.length; i++) {
    const { query, description } = testQueries[i];
    console.log(`\n📝 テスト ${i + 1}/${testQueries.length}: ${query}`);
    console.log(`   説明: ${description}`);
    console.log('─'.repeat(60));
    
    try {
      // 動的インポートを使用（loadTestEnv()実行後にインポート）
      const { retrieveRelevantDocs } = await import('../ai/flows/retrieve-relevant-docs-lancedb.js');
      const { streamingSummarizeConfluenceDocs } = await import('../ai/flows/streaming-summarize-confluence-docs.js');
      
      // 1. 検索を実行（全ての検索結果を取得）
      console.log('  🔍 検索中...');
      const relevantDocs = await retrieveRelevantDocs({
        question: query,
        labels: [],
        labelFilters: { includeMeetingNotes: false },
        source: 'confluence'
      });
      
      console.log(`  ✅ 検索完了: ${relevantDocs.length}件`);
      
      // 2. ストリーミング要約を実行
      console.log('  🤖 AI生成中...');
      let fullAnswer = '';
      let finalReferences: any[] = [];
      
      for await (const result of streamingSummarizeConfluenceDocs({
        question: query,
        context: relevantDocs,
        chatHistory: []
      })) {
        if (result.chunk) {
          fullAnswer += result.chunk;
        }
        
        if (result.isComplete) {
          finalReferences = result.references || [];
          break;
        }
      }
      
      console.log(`  ✅ AI生成完了: ${fullAnswer.length}文字`);
      console.log(`  📊 参照元数:`);
      console.log(`     - 検索結果（全件）: ${relevantDocs.length}件`);
      console.log(`     - 最終表示（使用された件数）: ${finalReferences.length}件`);
      
      // 3. フィルタリングが機能しているか確認
      const isFiltered = finalReferences.length < relevantDocs.length;
      const filterRate = relevantDocs.length > 0 
        ? ((relevantDocs.length - finalReferences.length) / relevantDocs.length * 100).toFixed(1)
        : '0.0';
      
      console.log(`  ${isFiltered ? '✅' : '⚠️'} フィルタリング: ${isFiltered ? '機能中' : '機能していない（全件表示）'}`);
      if (isFiltered) {
        console.log(`     - フィルタリング率: ${filterRate}%（${relevantDocs.length - finalReferences.length}件が除外されました）`);
      }
      
      // 4. 最終参照元が検索結果の一部であることを確認
      const finalIds = new Set(finalReferences.map(ref => ref.id || ref.title));
      const allIds = new Set(relevantDocs.map((doc: any) => doc.id || doc.pageId || doc.page_id || doc.title));
      
      let allInSearchResults = true;
      for (const finalId of finalIds) {
        if (!allIds.has(finalId)) {
          allInSearchResults = false;
          console.log(`     ⚠️  警告: 最終参照元に検索結果にないIDが見つかりました: ${finalId}`);
          break;
        }
      }
      
      if (allInSearchResults) {
        console.log(`  ✅ 最終参照元は全て検索結果に含まれています`);
      }
      
      // 5. 回答内に参照元が言及されているか確認（参考情報として表示）
      console.log(`\n  📄 回答の先頭100文字: ${fullAnswer.substring(0, 100)}...`);
      
      // 回答内に参照元のタイトルが含まれているかチェック
      const mentionedReferences: string[] = [];
      for (const ref of finalReferences) {
        const refTitle = ref.title || '';
        // タイトル全体または主要部分が回答に含まれているか
        if (refTitle && fullAnswer.includes(refTitle)) {
          mentionedReferences.push(refTitle);
        } else {
          // 番号部分を除いたタイトルでチェック
          const titleWithoutNumber = refTitle.replace(/^\d+_/, '');
          if (titleWithoutNumber && fullAnswer.includes(titleWithoutNumber)) {
            mentionedReferences.push(refTitle);
          }
        }
      }
      
      console.log(`  📌 回答内に言及されている参照元: ${mentionedReferences.length}/${finalReferences.length}件`);
      if (mentionedReferences.length > 0) {
        console.log(`     言及された参照元:`);
        mentionedReferences.slice(0, 3).forEach((title, idx) => {
          console.log(`       ${idx + 1}. ${title}`);
        });
        if (mentionedReferences.length > 3) {
          console.log(`       ... 他${mentionedReferences.length - 3}件`);
        }
      }
      
      // テスト間隔
      if (i < testQueries.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.error(`❌ エラー: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // 総合分析
  console.log('\n' + '='.repeat(70));
  console.log('📊 総合分析');
  console.log('='.repeat(70));
  console.log('\n✅ 参照元フィルタリングテスト完了');
  console.log('\n📝 確認項目:');
  console.log('   1. 最終表示される参照元数が検索結果数より少ないこと（フィルタリングが機能）');
  console.log('   2. 最終参照元が全て検索結果に含まれていること（データ整合性）');
  console.log('   3. 回答内に参照元が言及されていること（実際に使用されている）');
}

// 実行
testReferenceFiltering().catch((error) => {
  console.error('❌ テスト実行中に予期しないエラーが発生しました:');
  console.error(error);
  process.exit(1);
});

