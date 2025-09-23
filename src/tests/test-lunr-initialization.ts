/*
 * Lunr Index初期化テスト
 */

import { lunrInitializer } from '../lib/lunr-initializer';
import { lunrSearchClient } from '../lib/lunr-search-client';

async function testLunrInitialization() {
  console.log('=== Lunr Index初期化テスト ===');
  
  // 初期状態の確認
  console.log('\n--- 初期状態の確認 ---');
  const initialStatus = lunrInitializer.getStatus();
  console.log('初期状態:', initialStatus);
  
  // Lunr初期化の実行
  console.log('\n--- Lunr初期化の実行 ---');
  try {
    await lunrInitializer.initializeAsync();
    console.log('✅ Lunr初期化が完了しました');
  } catch (error) {
    console.error('❌ Lunr初期化に失敗しました:', error);
    return;
  }
  
  // 初期化後の状態確認
  console.log('\n--- 初期化後の状態確認 ---');
  const finalStatus = lunrInitializer.getStatus();
  console.log('最終状態:', finalStatus);
  
  // Lunr検索クライアントの状態確認
  console.log('\n--- Lunr検索クライアントの状態確認 ---');
  const isReady = lunrSearchClient.isReady();
  const documentCount = await lunrSearchClient.getDocumentCount();
  const avgTitleLength = await lunrSearchClient.getAverageTitleLength();
  
  console.log(`Lunr検索クライアント準備完了: ${isReady}`);
  console.log(`ドキュメント数: ${documentCount}`);
  console.log(`平均タイトル長: ${Number(avgTitleLength).toFixed(1)}文字`);
  
  // 簡単な検索テスト
  console.log('\n--- 簡単な検索テスト ---');
  try {
    const searchResults = await lunrSearchClient.searchCandidates('教室削除', 5);
    console.log(`検索結果数: ${searchResults.length}`);
    console.log('検索結果:');
    searchResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title} (スコア: ${result.score})`);
    });
  } catch (error) {
    console.error('❌ 検索テストに失敗しました:', error);
  }
  
  // 初期化完了の確認
  console.log('\n--- 初期化完了の確認 ---');
  const isInitialized = lunrInitializer.isReady();
  console.log(`Lunr初期化完了: ${isInitialized ? '✅' : '❌'}`);
}

// テスト実行
testLunrInitialization().catch(console.error);
