/**
 * 検索精度テストスクリプト
 * 
 * このスクリプトは、検索アルゴリズムの改善後の精度をテストするためのものです。
 * 様々なクエリでテストを実行し、結果の精度を評価します。
 */

require('dotenv').config();
// 直接モジュールをインポート
const path = require('path');
const lancedb = require('@lancedb/lancedb');
const fs = require('fs');

// テストデータを読み込む
let testData = [];
try {
  const testDataPath = path.resolve(process.cwd(), 'data', 'test-sample-data.json');
  if (fs.existsSync(testDataPath)) {
    testData = JSON.parse(fs.readFileSync(testDataPath, 'utf8'));
    console.log(`テストデータを読み込みました: ${testData.length}件`);
  } else {
    console.log('テストデータファイルが見つかりません。');
  }
} catch (error) {
  console.error('テストデータの読み込みに失敗しました:', error);
}

// テストケース
const TEST_CASES = [
  {
    name: '単純なキーワード検索',
    query: 'Confluence',
    topK: 5,
    expectedTitles: ['Confluence ガイド'] // 期待される結果のタイトル（部分一致）
  },
  {
    name: '日本語検索',
    query: 'スペース',
    topK: 5,
    expectedTitles: ['スペースの作成方法']
  },
  {
    name: 'ラベル検索',
    query: 'マニュアル',
    topK: 5,
    expectedTitles: ['Confluence ガイド', 'スペースの作成方法', 'ページの編集方法']
  },
  {
    name: '複合検索',
    query: 'Confluence ガイド',
    topK: 5,
    expectedTitles: ['Confluence ガイド']
  }
];

/**
 * 検索結果を評価する
 * @param {Object} testCase テストケース
 * @param {Array} results 検索結果
 */
function evaluateResults(testCase, results) {
  console.log(`\n[${testCase.name}] の結果評価:`);
  
  // 結果の表示
  console.log('\n検索結果:');
  results.forEach((result, idx) => {
    console.log(`${idx + 1}. ${result.title} (スコア: ${result.distance.toFixed(4)}, ソース: ${result.source})`);
    console.log(`   マッチ詳細: タイトル=${result.matchDetails.titleMatches || 0}, ラベル=${result.matchDetails.labelMatches || 0}, 内容=${result.matchDetails.contentMatches || 0}`);
    console.log(`   URL: ${result.url}`);
  });
  
  // 期待される結果との比較（設定されている場合）
  if (testCase.expectedTitles && testCase.expectedTitles.length > 0) {
    const foundExpected = results.filter(r => 
      testCase.expectedTitles.some(expected => 
        r.title.toLowerCase().includes(expected.toLowerCase())
      )
    );
    
    console.log(`\n期待される結果の一致率: ${foundExpected.length}/${testCase.expectedTitles.length} (${Math.round(foundExpected.length / testCase.expectedTitles.length * 100)}%)`);
  }
}

/**
 * LanceDBで検索を実行する
 */
async function searchLanceDB(params) {
  try {
    console.log(`[searchLanceDB] Starting search with query: "${params.query}"`);
    
    // デフォルト値の設定
    const topK = params.topK || 5;
    const tableName = params.tableName || 'test_table';
    const useTestData = params.useTestData || true; // デフォルトでテストデータを使用
    
    // テキストから埋め込みベクトルを生成する関数
    async function generateEmbedding(text) {
      try {
        // Xenovaのtransformersを使用して埋め込みを生成
        // 実際のプロジェクトでは、この部分を適切な埋め込み生成ロジックに置き換える
        console.log(`[Embedding] Generating embedding for query: "${text}"`);
        
        // ダミーの埋め込みベクトルを返す（実際の実装では本物の埋め込みを生成）
        return new Array(10).fill(0.1); // テストデータのベクトルは10次元
      } catch (error) {
        console.error(`[Embedding] Error generating embedding: ${error.message}`);
        // エラー時はダミーベクトルを返す
        return new Array(10).fill(0.1);
      }
    }
    
    // クエリから埋め込みベクトルを生成
    const vector = await generateEmbedding(params.query);
    
    // テストデータを使用する場合
    if (useTestData && testData.length > 0) {
      console.log(`[searchLanceDB] Using test data with ${testData.length} items`);
      
      // ベクトル検索のシミュレーション
      // 実際のベクトル検索では距離計算を行うが、ここではダミーの距離を設定
      const vectorResults = testData.map(item => ({
        ...item,
        _distance: 0.5 // ダミーの距離
      }));
      console.log(`[searchLanceDB] Vector search found ${vectorResults.length} results`);
      
      return processSearchResults(vectorResults, params.query, topK);
    }
    
    // 実際のLanceDBを使用する場合
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    console.log(`[searchLanceDB] Connecting to LanceDB at ${dbPath}`);
    
    const db = await lancedb.connect(dbPath);
    
    // テーブル存在確認
    const tableNames = await db.tableNames();
    if (!tableNames.includes(tableName)) {
      console.error(`[searchLanceDB] Table '${tableName}' not found`);
      return [];
    }
    
    // テーブルを開く
    const tbl = await db.openTable(tableName);
    console.log(`[searchLanceDB] Opened table '${tableName}'`);
    
    // ベクトル検索の実行
    let vectorResults = [];
    try {
      let vectorQuery = tbl.search(vector);
      if (params.filter) {
        vectorQuery = vectorQuery.where(params.filter);
      }
      vectorResults = await vectorQuery.limit(topK * 2).toArray(); // より多くの結果を取得してハイブリッド検索で絞り込む
      console.log(`[searchLanceDB] Vector search found ${vectorResults.length} results`);
    } catch (err) {
      console.error(`[searchLanceDB] Vector search error: ${err}`);
      vectorResults = [];
    }
    
    return processSearchResults(vectorResults, params.query, topK);
  } catch (error) {
    console.error(`[searchLanceDB] Error: ${error.message}`);
    throw new Error(`LanceDB search failed: ${error.message}`);
  }
}

/**
 * 検索結果を処理する
 */
function processSearchResults(vectorResults, query, topK) {
    
    // ハイブリッド検索の実装
    try {
      console.log(`[searchLanceDB] Implementing hybrid search`);
      
      // キーワードを抽出
      const keywords = query.split(/\s+/).filter(k => k.length > 1);
      console.log(`[searchLanceDB] Extracted ${keywords.length} keywords: ${keywords.join(', ')}`);
      
      // 各結果にハイブリッドスコアを追加
      const resultsWithHybridScore = [];
      let keywordMatchCount = 0;
      
      // 各結果を処理
      for (let i = 0; i < vectorResults.length; i++) {
        const originalResult = vectorResults[i];
        
        // 結果のコピーを作成
        const resultWithScore = { ...originalResult };
        
        // キーワードマッチングスコアを計算
        const title = originalResult.title || '';
        const content = originalResult.content || '';
        const labels = Array.isArray(originalResult.labels) ? originalResult.labels : [];
        
        // デバッグ情報を出力
        console.log(`[searchLanceDB] Processing result ${i+1}:`);
        console.log(`  Title: ${title}`);
        console.log(`  Labels: ${JSON.stringify(labels)}`);
        console.log(`  Content snippet: ${content.substring(0, 50)}...`);
        
        // キーワードマッチングスコアを計算
        let keywordScore = 0;
        let titleMatches = 0;
        let labelMatches = 0;
        let contentMatches = 0;
        
        if (keywords.length > 0) {
          // タイトル、ラベル、コンテンツのマッチングをチェック
          for (const keyword of keywords) {
            const lowerKeyword = keyword.toLowerCase();
            const lowerTitle = title.toLowerCase();
            const lowerContent = content.toLowerCase();
            const lowerLabels = labels.map(l => String(l).toLowerCase());
            
            // タイトルに完全一致する場合は高いスコア
            if (lowerTitle === lowerKeyword) {
              keywordScore += 0.8;
              titleMatches++;
            }
            // タイトルに含まれる場合はそれより低いスコア
            else if (lowerTitle.includes(lowerKeyword)) {
              keywordScore += 0.5;
              titleMatches++;
            }
            
            // ラベルに一致する場合もスコアを加算
            if (lowerLabels.some(label => label.includes(lowerKeyword))) {
              keywordScore += 0.4;
              labelMatches++;
            }
            
            // コンテンツに含まれる場合はより低いスコア
            if (lowerContent.includes(lowerKeyword)) {
              keywordScore += 0.3;
              contentMatches++;
            }
          }
        }
        
        console.log(`  Score details: keyword=${keywordScore}, title=${titleMatches}, label=${labelMatches}, content=${contentMatches}`);
        
        // キーワードマッチがある場合はカウント
        if (keywordScore > 0) {
          keywordMatchCount++;
        }
        
        // ベクトル距離とキーワードスコアを組み合わせた複合スコア
        // 距離が小さいほど類似度が高いため、キーワードスコアは引き算
        const hybridScore = resultWithScore._distance - (keywordScore * 0.7);
        console.log(`  Hybrid score: ${hybridScore} (vector: ${resultWithScore._distance}, keyword: ${keywordScore})`);
        
        // スコア情報を追加
        resultWithScore._keywordScore = keywordScore;
        resultWithScore._hybridScore = hybridScore;
        resultWithScore._sourceType = keywordScore > 0 ? 'hybrid' : 'vector';
        resultWithScore._matchDetails = {
          titleMatches,
          labelMatches,
          contentMatches
        };
        
        // 配列に追加
        resultsWithHybridScore.push(resultWithScore);
      }
      
      // ハイブリッドスコアでソート
      vectorResults = resultsWithHybridScore.sort((a, b) => a._hybridScore - b._hybridScore);
      
      console.log(`[searchLanceDB] Found ${keywordMatchCount} keyword/hybrid matches in results`);
      console.log(`[searchLanceDB] Applied hybrid scoring to ${vectorResults.length} results`);
      console.log(`[searchLanceDB] Top 3 results after sorting:`);
      for (let i = 0; i < Math.min(3, vectorResults.length); i++) {
        console.log(`  ${i+1}. ${vectorResults[i].title} (score: ${vectorResults[i]._hybridScore.toFixed(4)})`);
      }
    } catch (err) {
      console.error(`[searchLanceDB] Error applying hybrid search: ${err}`);
      console.error(`[searchLanceDB] Error stack: ${err.stack}`);
      // エラー時は何もしない（元のベクトル検索結果をそのまま使用）
    }
    
    // 上位の結果を取得
    const finalResults = vectorResults.slice(0, topK);
    
    // 結果を整形
    return finalResults.map(result => ({
      id: result.id,
      title: result.title || 'No Title',
      content: result.content || '',
      distance: result._distance,
      space_key: result.space_key,
      labels: result.labels || [],
      url: result.url || '',
      lastUpdated: result.lastUpdated || '',
      source: result._sourceType || 'vector',
      matchDetails: {
        titleMatches: result._matchDetails?.titleMatches || 0,
        labelMatches: result._matchDetails?.labelMatches || 0,
        contentMatches: result._matchDetails?.contentMatches || 0
      }
    }));
}

/**
 * 検索テストを実行する
 */
async function runSearchTests() {
  console.log('検索精度テストを開始します...\n');
  
  for (const testCase of TEST_CASES) {
    console.log(`[${testCase.name}] テスト実行中...`);
    console.log(`クエリ: "${testCase.query}", 上位${testCase.topK}件`);
    
    try {
      const startTime = Date.now();
      const results = await searchLanceDB({
        query: testCase.query,
        topK: testCase.topK,
        useKeywordSearch: true
      });
      const endTime = Date.now();
      
      console.log(`検索時間: ${endTime - startTime}ms`);
      console.log(`結果件数: ${results.length}`);
      
      evaluateResults(testCase, results);
    } catch (error) {
      console.error(`[${testCase.name}] テスト失敗:`, error);
    }
  }
  
  console.log('\n全てのテストが完了しました。');
}

// テスト実行
runSearchTests().catch(console.error);
