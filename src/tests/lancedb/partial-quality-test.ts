/**
 * 部分データでの品質テスト
 * 
 * 全件ではなく、現在利用可能なデータでベクトル検索の品質をテストする
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../../lib/embeddings';
import { searchLanceDB } from '../../lib/lancedb-search-client';

/**
 * 部分データでの品質テスト
 */
async function runPartialQualityTest(): Promise<void> {
  console.log('🧪 部分データでの品質テスト');
  console.log('='.repeat(80));
  console.log(`開始時刻: ${new Date().toISOString()}`);
  
  try {
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tbl = await db.openTable('confluence');
    
    // 1. 現在のデータ状況の確認
    console.log(`\n=== 1. データ状況の確認 ===`);
    const totalCount = await tbl.countRows();
    console.log(`総レコード数: ${totalCount}`);
    
    // ベクトル付きレコードの確認
    const allRecords = await tbl.query().toArray();
    const recordsWithVectors = allRecords.filter(r => {
      const vector = r.vector?.toArray ? r.vector.toArray() : r.vector;
      return vector && Array.isArray(vector) && vector.length > 0;
    });
    
    console.log(`ベクトル付きレコード数: ${recordsWithVectors.length}/${totalCount}`);
    
    if (recordsWithVectors.length === 0) {
      console.log('❌ ベクトル付きレコードが存在しません');
      return;
    }
    
    // 2. テストクエリの定義
    console.log(`\n=== 2. テストクエリの実行 ===`);
    const testQueries = [
      '教室管理',
      'ユーザー登録',
      '契約管理',
      '採用フロー',
      'メール通知'
    ];
    
    for (const query of testQueries) {
      console.log(`\n--- クエリ: "${query}" ---`);
      
      try {
        // ベクトル検索の実行
        const results = await searchLanceDB({
          query: query,
          topK: 5,
          maxDistance: 1.0, // 修正: 実際の距離分布に基づく閾値
          qualityThreshold: 0.8 // 修正: 高品質結果のフィルタリング
        });
        
        console.log(`検索結果数: ${results.length}`);
        
        if (results.length > 0) {
          console.log('上位結果:');
          results.slice(0, 3).forEach((result, index) => {
            console.log(`  ${index + 1}. ${result.title} (距離: ${result._distance?.toFixed(4) || 'N/A'})`);
          });
        } else {
          console.log('❌ 検索結果がありません');
        }
        
      } catch (error) {
        console.error(`❌ クエリ "${query}" の実行エラー:`, error);
      }
    }
    
    // 3. 埋め込み生成のテスト
    console.log(`\n=== 3. 埋め込み生成のテスト ===`);
    const testText = '教室管理の詳細について';
    
    try {
      const embedding = await getEmbeddings(testText);
      console.log(`✅ 埋め込み生成成功: ${embedding.length}次元`);
      console.log(`埋め込み範囲: ${Math.min(...embedding).toFixed(4)} ～ ${Math.max(...embedding).toFixed(4)}`);
    } catch (error) {
      console.error('❌ 埋め込み生成エラー:', error);
    }
    
    // 4. データ品質の分析
    console.log(`\n=== 4. データ品質の分析 ===`);
    
    // タイトル長の分析
    const titleLengths = allRecords.map(r => r.title?.length || 0);
    const avgTitleLength = titleLengths.reduce((a, b) => a + b, 0) / titleLengths.length;
    console.log(`平均タイトル長: ${avgTitleLength.toFixed(1)}文字`);
    
    // コンテンツ長の分析
    const contentLengths = allRecords.map(r => r.content?.length || 0);
    const avgContentLength = contentLengths.reduce((a, b) => a + b, 0) / contentLengths.length;
    console.log(`平均コンテンツ長: ${avgContentLength.toFixed(1)}文字`);
    
    // ラベル付きレコードの分析
    const recordsWithLabels = allRecords.filter(r => {
      const labels = r.labels?.toArray ? r.labels.toArray() : r.labels || [];
      return Array.isArray(labels) && labels.length > 0;
    });
    console.log(`ラベル付きレコード数: ${recordsWithLabels.length}/${totalCount} (${(recordsWithLabels.length / totalCount * 100).toFixed(1)}%)`);
    
    // 5. 推奨事項
    console.log(`\n=== 5. 推奨事項 ===`);
    
    if (recordsWithVectors.length < totalCount) {
      console.log(`⚠️ 埋め込み生成の完了を待つ必要があります (${recordsWithVectors.length}/${totalCount})`);
    }
    
    if (recordsWithVectors.length >= 10) {
      console.log('✅ 基本的な品質テストは実行可能です');
    } else {
      console.log('⚠️ データが少なすぎるため、より多くのデータが必要です');
    }
    
  } catch (error) {
    console.error('❌ 品質テストエラー:', error);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ 部分データでの品質テスト完了');
}

/**
 * メイン実行関数
 */
async function main(): Promise<void> {
  try {
    await runPartialQualityTest();
  } catch (error) {
    console.error('❌ 実行エラー:', error);
    process.exit(1);
  }
}

// スクリプト実行
if (require.main === module) {
  main();
}

export { runPartialQualityTest };
