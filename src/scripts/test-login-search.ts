import 'dotenv/config';
import * as path from 'path';
import * as lancedb from '@lancedb/lancedb';
import { defaultLanceDBSearchClient } from '../lib/lancedb-search-client';

async function testLoginSearch() {
  try {
    console.log('=== ログイン機能の検索テスト ===');
    
    // LanceDBに直接接続してページID 703889475の詳細を確認
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    const tableName = 'confluence';
    const db = await lancedb.connect(dbPath);
    const tbl = await db.openTable(tableName);
    
    console.log('\n1. ページID 703889475の詳細確認:');
    const pageResults = await tbl.query()
      .where(`"pageId" = '703889475'`)
      .toArray();
    
    console.log(`見つかったレコード数: ${pageResults.length}`);
    pageResults.forEach((r, i) => {
      console.log(`  ${i+1}. タイトル: ${r.title}`);
      console.log(`     ラベル: ${JSON.stringify(r.labels)}`);
      console.log(`     コンテンツ長: ${r.content?.length || 0} 文字`);
      console.log(`     埋め込みベクトル長: ${r.vector?.length || 0}`);
      console.log(`     URL: ${r.url}`);
    });
    
    // 検索クエリをテスト
    const testQueries = [
      'ログイン機能の詳細は',
      'ログイン',
      '会員ログイン',
      'ログアウト機能',
      '認証',
      'authentication'
    ];
    
    console.log('\n2. 検索クエリのテスト:');
    for (const query of testQueries) {
      console.log(`\n--- クエリ: "${query}" ---`);
      
      try {
        const searchResults = await defaultLanceDBSearchClient.search({
          query: query,
          topK: 5,
          tableName: 'confluence',
          labelFilters: {
            includeMeetingNotes: false,
            includeArchived: false
          }
        });
        
        console.log(`結果数: ${searchResults.length}`);
        searchResults.forEach((r, i) => {
          const isTargetPage = r.pageId === '703889475';
          console.log(`  ${i+1}. ${isTargetPage ? '🎯' : '  '} ${r.title} (pageId: ${r.pageId}, distance: ${r.distance?.toFixed(3)})`);
        });
        
        // ページID 703889475が含まれているかチェック
        const hasTargetPage = searchResults.some(r => r.pageId === '703889475');
        console.log(`ページID 703889475が含まれている: ${hasTargetPage ? '✅' : '❌'}`);
        
      } catch (searchError) {
        console.log(`検索エラー: ${searchError.message}`);
      }
    }
    
    // 埋め込みベクトルの品質をチェック
    console.log('\n3. 埋め込みベクトルの品質チェック:');
    const targetRecord = pageResults[0];
    if (targetRecord && targetRecord.vector) {
      const vector = targetRecord.vector;
      console.log(`ベクトル次元数: ${vector.length}`);
      console.log(`ベクトルの値の範囲: ${Math.min(...vector)} ～ ${Math.max(...vector)}`);
      console.log(`ベクトルのノルム: ${Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0)).toFixed(3)}`);
      
      // ゼロベクトルかチェック
      const isZeroVector = vector.every(val => val === 0);
      console.log(`ゼロベクトル: ${isZeroVector ? '⚠️ YES' : '✅ NO'}`);
    }
    
  } catch (error) {
    console.error('エラー:', error.message);
  }
}

testLoginSearch().catch(console.error);
