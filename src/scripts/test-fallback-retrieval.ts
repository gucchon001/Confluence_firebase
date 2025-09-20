import 'dotenv/config';
import { defaultLanceDBSearchClient } from '../lib/lancedb-search-client';
import { LanceDBSearchParams } from '../lib/lancedb-search-client';

async function testFallbackRetrieval() {
  console.log('=== フォールバック取得機能のテスト ===');
  
  const testPageId = 703889475;
  console.log(`テスト対象ページID: ${testPageId}`);
  
  // 1. 通常のベクトル検索でpageIdフィルタを試行
  console.log('\n1. 通常のベクトル検索（pageIdフィルタ付き）:');
  try {
    const vectorSearchParams: LanceDBSearchParams = {
      query: 'ログイン機能',
      topK: 5,
      tableName: 'confluence',
      filter: `"pageId" = ${testPageId}`,
      labelFilters: {
        includeMeetingNotes: false,
        includeArchived: false
      }
    };
    
    const vectorResults = await defaultLanceDBSearchClient.search(vectorSearchParams);
    console.log(`ベクトル検索結果: ${vectorResults.length}件`);
    vectorResults.forEach((r, i) => {
      console.log(`  ${i+1}. ${r.title} (pageId: ${r.pageId}, source: ${r.source})`);
    });
    
  } catch (error: any) {
    console.error(`ベクトル検索エラー: ${error.message}`);
  }
  
  // 2. フォールバック取得の直接テスト
  console.log('\n2. フォールバック取得の直接テスト:');
  try {
    const fallbackParams: LanceDBSearchParams = {
      query: 'dummy', // ダミークエリ
      topK: 5,
      tableName: 'confluence',
      filter: `"pageId" = ${testPageId}`,
      labelFilters: {
        includeMeetingNotes: false,
        includeArchived: false
      }
    };
    
    const fallbackResults = await defaultLanceDBSearchClient.search(fallbackParams);
    console.log(`フォールバック検索結果: ${fallbackResults.length}件`);
    fallbackResults.forEach((r, i) => {
      console.log(`  ${i+1}. ${r.title} (pageId: ${r.pageId}, source: ${r.source})`);
    });
    
  } catch (error: any) {
    console.error(`フォールバック検索エラー: ${error.message}`);
  }
  
  // 3. ログイン機能の一般的な検索
  console.log('\n3. ログイン機能の一般的な検索:');
  try {
    const generalSearchParams: LanceDBSearchParams = {
      query: 'ログイン機能の詳細は',
      topK: 10,
      tableName: 'confluence',
      labelFilters: {
        includeMeetingNotes: false,
        includeArchived: false
      }
    };
    
    const generalResults = await defaultLanceDBSearchClient.search(generalSearchParams);
    console.log(`一般検索結果: ${generalResults.length}件`);
    generalResults.forEach((r, i) => {
      const isTargetPage = r.pageId === testPageId;
      console.log(`  ${i+1}. ${isTargetPage ? '🎯' : '  '} ${r.title} (pageId: ${r.pageId}, source: ${r.source})`);
    });
    
    // ターゲットページが含まれているかチェック
    const hasTargetPage = generalResults.some(r => r.pageId === testPageId);
    console.log(`\nターゲットページID ${testPageId} が含まれている: ${hasTargetPage ? '✅' : '❌'}`);
    
  } catch (error: any) {
    console.error(`一般検索エラー: ${error.message}`);
  }
}

testFallbackRetrieval().catch(console.error);
