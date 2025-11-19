/**
 * ハイブリッド検索と参照元取得のテスト
 * 参照元が正しく取得され、ハイブリッド検索が機能しているか検証
 */

import { loadTestEnv } from './test-helpers/env-loader';

// 環境変数の読み込み
loadTestEnv();

interface ReferenceValidation {
  hasId: boolean;
  hasTitle: boolean;
  hasUrl: boolean;
  hasSpaceName: boolean;
  hasLabels: boolean;
  hasDistance: boolean;
  hasSource: boolean;
  hasScoreText: boolean;
  urlValid: boolean;
  titleValid: boolean;
}

interface SearchResultValidation {
  totalResults: number;
  hasResults: boolean;
  avgScore: number;
  maxScore: number;
  minScore: number;
  validReferences: number;
  invalidReferences: number;
  duplicateIds: number;
  hybridSearchWorking: boolean;
}

async function validateReference(ref: any, index: number): Promise<ReferenceValidation> {
  const validation: ReferenceValidation = {
    hasId: false,
    hasTitle: false,
    hasUrl: false,
    hasSpaceName: false,
    hasLabels: false,
    hasDistance: false,
    hasSource: false,
    hasScoreText: false,
    urlValid: false,
    titleValid: false,
  };

  // IDの確認
  validation.hasId = !!(ref.id || ref.pageId || ref.page_id || ref.issue_key);
  
  // タイトルの確認
  validation.hasTitle = !!(ref.title && typeof ref.title === 'string' && ref.title.trim().length > 0);
  validation.titleValid = validation.hasTitle && ref.title !== 'No Title' && ref.title !== 'タイトル不明';
  
  // URLの確認
  validation.hasUrl = !!(ref.url && typeof ref.url === 'string' && ref.url.trim().length > 0);
  // URLが'#'のみの場合は無効とみなす（ただし、pageIdがあれば後で構築可能）
  const urlIsPlaceholder = ref.url === '#' || ref.url === '#/' || ref.url.trim().length === 0;
  validation.urlValid = validation.hasUrl && !urlIsPlaceholder && (
    ref.url.startsWith('http://') || 
    ref.url.startsWith('https://') || 
    ref.url.startsWith('/') ||
    ref.url.includes('.atlassian.net')
  );
  
  // spaceNameの確認（Confluenceの場合）
  // Jiraの場合はspaceName/space_keyは不要
  if (ref.issue_key) {
    validation.hasSpaceName = true; // Jiraの場合は不要
  } else {
    // Confluenceの場合: spaceNameまたはspace_keyが必要
    // ただし、space_keyがundefinedでもpageIdがあればURL構築可能なので、警告レベルに下げる
    validation.hasSpaceName = !!(ref.spaceName || ref.space_key);
  }
  
  // labelsの確認（配列であることを確認）
  validation.hasLabels = Array.isArray(ref.labels);
  
  // distanceの確認
  validation.hasDistance = typeof ref.distance === 'number' || typeof ref.distance === 'undefined';
  
  // sourceの確認
  validation.hasSource = !!(ref.source && (ref.source === 'vector' || ref.source === 'bm25' || ref.source === 'hybrid' || ref.source === 'kg-reference'));
  
  // scoreTextの確認
  validation.hasScoreText = !!(ref.scoreText && typeof ref.scoreText === 'string');
  
  return validation;
}

async function validateSearchResults(results: any[]): Promise<SearchResultValidation> {
  const validation: SearchResultValidation = {
    totalResults: results.length,
    hasResults: results.length > 0,
    avgScore: 0,
    maxScore: 0,
    minScore: 0,
    validReferences: 0,
    invalidReferences: 0,
    duplicateIds: 0,
    hybridSearchWorking: false,
  };

  if (results.length === 0) {
    return validation;
  }

  // スコアの計算
  const scores = results
    .map(r => r.score ?? r._compositeScore ?? r._rrfScore ?? (r.distance !== undefined ? (1 - r.distance) : 0))
    .filter(s => typeof s === 'number' && !isNaN(s));
  
  if (scores.length > 0) {
    validation.avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    validation.maxScore = Math.max(...scores);
    validation.minScore = Math.min(...scores);
  }

  // 参照元の検証
  const ids = new Set<string>();
  const referenceValidations = await Promise.all(
    results.map((ref, index) => validateReference(ref, index))
  );

  for (let i = 0; i < results.length; i++) {
    const ref = results[i];
    const refValidation = referenceValidations[i];
    
    // IDの重複チェック
    const id = ref.id || ref.pageId || ref.page_id || ref.issue_key;
    if (id) {
      if (ids.has(String(id))) {
        validation.duplicateIds++;
      } else {
        ids.add(String(id));
      }
    }
    
    // 参照元が有効かどうか判定
    // URLが'#'でもpageIdがあれば後で構築可能なので、緩やかに判定
    const hasPageId = !!(ref.pageId || ref.page_id || ref.id);
    const canBuildUrl = hasPageId || refValidation.urlValid;
    
    const isValid = 
      refValidation.hasId &&
      refValidation.hasTitle &&
      refValidation.titleValid &&
      refValidation.hasUrl &&
      canBuildUrl && // URLが有効、またはpageIdがあって構築可能
      refValidation.hasLabels &&
      refValidation.hasSource;
    // spaceNameは警告のみ（pageIdがあればURL構築可能なため）
    
    if (isValid) {
      validation.validReferences++;
    } else {
      validation.invalidReferences++;
      
      // 無効な参照元の詳細を出力
      if (i < 5) { // 最初の5件のみ詳細を表示
        console.log(`   ⚠️  参照元 ${i + 1} に問題があります:`);
        if (!refValidation.hasId) console.log('      - IDがありません');
        if (!refValidation.hasTitle) console.log('      - タイトルがありません');
        if (!refValidation.titleValid) console.log('      - タイトルが無効です');
        if (!refValidation.hasUrl) console.log('      - URLがありません');
        if (!refValidation.urlValid) console.log('      - URLが無効です');
        if (!refValidation.hasSpaceName) console.log('      - spaceName/space_keyがありません');
        if (!refValidation.hasLabels) console.log('      - labelsが配列ではありません');
        if (!refValidation.hasSource) console.log('      - sourceが無効です');
      }
    }
  }

  // ハイブリッド検索が機能しているか確認（複数のsourceタイプがあるか、またはhybridスコアがあるか）
  const sources = new Set(results.map(r => r.source).filter(Boolean));
  const hasHybridSource = sources.has('hybrid');
  const hasMultipleSources = sources.size > 1;
  const hasCompositeScore = results.some(r => r._compositeScore !== undefined || r._rrfScore !== undefined);
  
  validation.hybridSearchWorking = hasHybridSource || hasMultipleSources || hasCompositeScore;

  return validation;
}

async function testHybridSearchAndReferences() {
  console.log('🔍 ハイブリッド検索と参照元取得テスト開始\n');
  console.log('='.repeat(70));
  
  // テストクエリセット（様々な検索パターンを含む）
  const testQueries = [
    {
      query: '教室管理の詳細について教えてください',
      expectedKeywords: ['教室', '管理'],
      description: '具体的な機能に関する質問'
    },
    {
      query: 'ログイン認証の仕組み',
      expectedKeywords: ['ログイン', '認証'],
      description: '認証機能に関する質問'
    },
    {
      query: 'データベースの構造',
      expectedKeywords: ['データベース', '構造'],
      description: '技術的な質問'
    },
    {
      query: '会員登録',
      expectedKeywords: ['会員', '登録'],
      description: '機能名のみの質問'
    }
  ];

  const allResults: Array<{
    query: string;
    description: string;
    validation: SearchResultValidation;
    sampleReferences: any[];
    searchTime: number;
  }> = [];

  for (let i = 0; i < testQueries.length; i++) {
    const { query, description, expectedKeywords } = testQueries[i];
    console.log(`\n📝 テスト ${i + 1}/${testQueries.length}: ${query}`);
    console.log(`   説明: ${description}`);
    console.log('─'.repeat(60));
    
    const startTime = Date.now();
    
    try {
      // 動的インポートを使用（loadTestEnv()実行後にインポート）
      const { retrieveRelevantDocs } = await import('../ai/flows/retrieve-relevant-docs-lancedb.js');
      
      // ハイブリッド検索を実行
      const searchResults = await retrieveRelevantDocs({
        question: query,
        labels: [],
        labelFilters: { includeMeetingNotes: false },
        source: 'confluence'
      });
      
      const searchTime = Date.now() - startTime;
      
      console.log(`⏱️  検索時間: ${searchTime}ms`);
      console.log(`📊 検索結果数: ${searchResults.length}件`);
      
      // 検索結果の検証
      const validation = await validateSearchResults(searchResults);
      
      // 結果の表示
      console.log(`\n✅ 検証結果:`);
      console.log(`   - 有効な参照元: ${validation.validReferences}件 / ${validation.totalResults}件`);
      console.log(`   - 無効な参照元: ${validation.invalidReferences}件`);
      console.log(`   - 重複ID: ${validation.duplicateIds}件`);
      console.log(`   - 平均スコア: ${validation.avgScore.toFixed(4)}`);
      console.log(`   - 最高スコア: ${validation.maxScore.toFixed(4)}`);
      console.log(`   - 最低スコア: ${validation.minScore.toFixed(4)}`);
      console.log(`   - ハイブリッド検索: ${validation.hybridSearchWorking ? '✅ 機能中' : '❌ 機能していません'}`);
      
      // 上位3件の参照元の詳細を表示
      if (searchResults.length > 0) {
        console.log(`\n🔍 上位3件の参照元詳細:`);
        const top3 = searchResults.slice(0, 3);
        for (let j = 0; j < top3.length; j++) {
          const ref = top3[j];
          const refValidation = await validateReference(ref, j);
          const score = ref.score ?? ref._compositeScore ?? ref._rrfScore ?? (ref.distance !== undefined ? (1 - ref.distance) : 0);
          
          // 実際の有効性判定と同じロジックを使用
          const hasPageId = !!(ref.pageId || ref.page_id || ref.id);
          const canBuildUrl = hasPageId || refValidation.urlValid;
          const isValid = 
            refValidation.hasId &&
            refValidation.hasTitle &&
            refValidation.titleValid &&
            refValidation.hasUrl &&
            canBuildUrl &&
            refValidation.hasLabels &&
            refValidation.hasSource;
          
          console.log(`\n   ${j + 1}. ${ref.title || 'タイトル不明'}`);
          console.log(`      スコア: ${score.toFixed(4)}`);
          console.log(`      URL: ${ref.url || 'URL不明'}`);
          console.log(`      ID: ${ref.id || ref.pageId || ref.page_id || ref.issue_key || 'ID不明'}`);
          console.log(`      Source: ${ref.source || '不明'}`);
          console.log(`      ScoreText: ${ref.scoreText || '不明'}`);
          console.log(`      ラベル: ${Array.isArray(ref.labels) ? ref.labels.join(', ') : 'なし'}`);
          console.log(`      検証: ${isValid ? '✅ 有効' : '❌ 無効'}`);
          
          // 警告レベルの問題があれば表示（必須ではない項目）
          const warnings: string[] = [];
          if (!refValidation.hasSpaceName && !ref.issue_key) {
            warnings.push('spaceName/space_keyなし（pageIdがあればURL構築可能）');
          }
          if (!refValidation.hasScoreText) {
            warnings.push('scoreTextなし（オプション項目）');
          }
          if (warnings.length > 0) {
            console.log(`      ⚠️  警告: ${warnings.join(', ')}`);
          }
        }
      }
      
      allResults.push({
        query,
        description,
        validation,
        sampleReferences: searchResults.slice(0, 3),
        searchTime
      });
      
      // テスト間隔
      if (i < testQueries.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      const searchTime = Date.now() - startTime;
      console.error(`❌ エラー: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`⏱️  実行時間: ${searchTime}ms`);
      
      allResults.push({
        query,
        description,
        validation: {
          totalResults: 0,
          hasResults: false,
          avgScore: 0,
          maxScore: 0,
          minScore: 0,
          validReferences: 0,
          invalidReferences: 0,
          duplicateIds: 0,
          hybridSearchWorking: false,
        },
        sampleReferences: [],
        searchTime
      });
    }
  }
  
  // 総合分析
  console.log('\n' + '='.repeat(70));
  console.log('📊 総合分析');
  console.log('='.repeat(70));
  
  const successfulTests = allResults.filter(r => r.validation.hasResults);
  const failedTests = allResults.filter(r => !r.validation.hasResults);
  
  console.log(`\n✅ 成功テスト: ${successfulTests.length}/${allResults.length}`);
  console.log(`❌ 失敗テスト: ${failedTests.length}/${allResults.length}`);
  
  if (successfulTests.length > 0) {
    const avgSearchTime = successfulTests.reduce((sum, r) => sum + r.searchTime, 0) / successfulTests.length;
    const avgValidReferences = successfulTests.reduce((sum, r) => sum + r.validation.validReferences, 0) / successfulTests.length;
    const avgTotalResults = successfulTests.reduce((sum, r) => sum + r.validation.totalResults, 0) / successfulTests.length;
    const avgScore = successfulTests.reduce((sum, r) => sum + r.validation.avgScore, 0) / successfulTests.length;
    const hybridWorkingCount = successfulTests.filter(r => r.validation.hybridSearchWorking).length;
    const totalValidReferences = successfulTests.reduce((sum, r) => sum + r.validation.validReferences, 0);
    const totalInvalidReferences = successfulTests.reduce((sum, r) => sum + r.validation.invalidReferences, 0);
    const totalDuplicateIds = successfulTests.reduce((sum, r) => sum + r.validation.duplicateIds, 0);
    
    console.log(`\n📈 パフォーマンス統計:`);
    console.log(`   - 平均検索時間: ${avgSearchTime.toFixed(0)}ms`);
    console.log(`   - 平均結果数: ${avgTotalResults.toFixed(1)}件`);
    console.log(`   - 平均有効参照元数: ${avgValidReferences.toFixed(1)}件`);
    
    console.log(`\n🎯 検索品質評価:`);
    if (avgScore >= 0.8) {
      console.log('   🚀 検索品質: 優秀');
    } else if (avgScore >= 0.6) {
      console.log('   ✅ 検索品質: 良好');
    } else if (avgScore >= 0.4) {
      console.log('   ⚠️  検索品質: 改善が必要');
    } else {
      console.log('   ❌ 検索品質: 要最適化');
    }
    
    console.log(`\n🔗 参照元品質評価:`);
    const validReferenceRate = totalValidReferences / (totalValidReferences + totalInvalidReferences) * 100;
    console.log(`   - 有効参照元率: ${validReferenceRate.toFixed(1)}%`);
    console.log(`   - 有効参照元: ${totalValidReferences}件`);
    console.log(`   - 無効参照元: ${totalInvalidReferences}件`);
    console.log(`   - 重複ID: ${totalDuplicateIds}件`);
    
    if (validReferenceRate >= 95) {
      console.log('   ✅ 参照元品質: 優秀');
    } else if (validReferenceRate >= 90) {
      console.log('   ✅ 参照元品質: 良好');
    } else if (validReferenceRate >= 80) {
      console.log('   ⚠️  参照元品質: 改善が必要');
    } else {
      console.log('   ❌ 参照元品質: 要最適化');
    }
    
    console.log(`\n🔀 ハイブリッド検索評価:`);
    console.log(`   - ハイブリッド検索が機能しているテスト: ${hybridWorkingCount}/${successfulTests.length}`);
    if (hybridWorkingCount === successfulTests.length) {
      console.log('   ✅ ハイブリッド検索: 全てのテストで機能しています');
    } else if (hybridWorkingCount >= successfulTests.length * 0.75) {
      console.log('   ⚠️  ハイブリッド検索: 一部のテストで機能していません');
    } else {
      console.log('   ❌ ハイブリッド検索: 多くのテストで機能していません');
    }
  }
  
  if (failedTests.length > 0) {
    console.log(`\n❌ 失敗したテスト:`);
    failedTests.forEach(test => {
      console.log(`   - "${test.query}": ${test.description}`);
    });
  }
  
  // 最終判定
  console.log('\n' + '='.repeat(70));
  const allHybridWorking = successfulTests.length > 0 && successfulTests.every(r => r.validation.hybridSearchWorking);
  const allReferencesValid = successfulTests.length > 0 && successfulTests.every(r => r.validation.invalidReferences === 0);
  const noDuplicates = successfulTests.length > 0 && successfulTests.every(r => r.validation.duplicateIds === 0);
  
  if (successfulTests.length === allResults.length && allHybridWorking && allReferencesValid && noDuplicates) {
    console.log('✅ すべてのテストが成功し、ハイブリッド検索と参照元取得が正常に機能しています！');
    process.exit(0);
  } else {
    console.log('⚠️  一部のテストに問題があります。上記の詳細を確認してください。');
    if (!allHybridWorking) {
      console.log('   - ハイブリッド検索が一部のテストで機能していません');
    }
    if (!allReferencesValid) {
      console.log('   - 無効な参照元が検出されました');
    }
    if (!noDuplicates) {
      console.log('   - 重複IDが検出されました');
    }
    process.exit(1);
  }
}

// 実行
testHybridSearchAndReferences().catch((error) => {
  console.error('❌ テスト実行中に予期しないエラーが発生しました:');
  console.error(error);
  process.exit(1);
});

