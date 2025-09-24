/**
 * データインポートの検証
 * 
 * LanceDBテーブルにデータが正しくインポートされているかを確認する
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../../lib/embeddings';

/**
 * データインポートの検証を実行する
 */
async function verifyDataImport(): Promise<void> {
  console.log('🔍 データインポートの検証');
  console.log('='.repeat(80));
  console.log(`開始時刻: ${new Date().toISOString()}`);
  
  try {
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tbl = await db.openTable('confluence');
    
    // 1. レコード数の確認
    const count = await tbl.countRows();
    console.log(`\n=== 1. レコード数の確認 ===`);
    console.log(`総レコード数: ${count}`);
    
    if (count === 0) {
      console.log('❌ レコードが存在しません');
      return;
    }
    
    // 2. サンプルレコードの確認
    console.log(`\n=== 2. サンプルレコードの確認 ===`);
    const sample = await tbl.query().limit(5).toArray();
    
    for (let i = 0; i < sample.length; i++) {
      const record = sample[i];
      console.log(`\n--- レコード ${i + 1} ---`);
      console.log(`ID: ${record.id}`);
      console.log(`ページID: ${record.pageId}`);
      console.log(`タイトル: ${record.title}`);
      console.log(`スペース: ${record.spaceKey}`);
      console.log(`最終更新: ${record.lastUpdated}`);
      console.log(`チャンクインデックス: ${record.chunkIndex}`);
      console.log(`コンテンツ長: ${record.content?.length || 0}文字`);
      const labels = record.labels?.toArray ? record.labels.toArray() : record.labels || [];
      console.log(`ラベル: [${Array.isArray(labels) ? labels.join(', ') : 'なし'}]`);
      
      // ベクトルの確認
      const vector = record.vector?.toArray ? record.vector.toArray() : record.vector;
      if (vector && Array.isArray(vector)) {
        console.log(`ベクトル次元数: ${vector.length}`);
        console.log(`ベクトル範囲: ${Math.min(...vector).toFixed(4)} ～ ${Math.max(...vector).toFixed(4)}`);
      } else {
        console.log(`❌ ベクトルが存在しません`);
      }
    }
    
    // 3. 埋め込みモデルのテスト
    console.log(`\n=== 3. 埋め込みモデルのテスト ===`);
    const testQuery = '教室管理の詳細は';
    const embedding = await getEmbeddings(testQuery);
    console.log(`テストクエリ: "${testQuery}"`);
    console.log(`埋め込み次元数: ${embedding.length}`);
    console.log(`埋め込み範囲: ${Math.min(...embedding).toFixed(4)} ～ ${Math.max(...embedding).toFixed(4)}`);
    
    // 4. 検索テスト
    console.log(`\n=== 4. 検索テスト ===`);
    const searchResults = await tbl.search(embedding).limit(10).toArray();
    console.log(`検索結果数: ${searchResults.length}件`);
    
    if (searchResults.length > 0) {
      const distances = searchResults.map(r => r._distance || 0);
      console.log(`距離範囲: ${Math.min(...distances).toFixed(4)} ～ ${Math.max(...distances).toFixed(4)}`);
      console.log(`平均距離: ${(distances.reduce((sum, d) => sum + d, 0) / distances.length).toFixed(4)}`);
      
      console.log(`\n--- 検索結果上位5件 ---`);
      for (let i = 0; i < Math.min(5, searchResults.length); i++) {
        const result = searchResults[i];
        console.log(`${i + 1}. ${result.title} (距離: ${(result._distance || 0).toFixed(4)})`);
      }
    }
    
    // 5. 統計情報
    console.log(`\n=== 5. 統計情報 ===`);
    const allRecords = await tbl.query().toArray();
    const withLabels = allRecords.filter(r => {
      const labels = r.labels?.toArray ? r.labels.toArray() : r.labels || [];
      return Array.isArray(labels) && labels.length > 0;
    });
    const withVectors = allRecords.filter(r => {
      const vector = r.vector?.toArray ? r.vector.toArray() : r.vector;
      return vector && Array.isArray(vector) && vector.length > 0;
    });
    
    console.log(`ラベル付きレコード数: ${withLabels.length}/${allRecords.length} (${(withLabels.length / allRecords.length * 100).toFixed(1)}%)`);
    console.log(`ベクトル付きレコード数: ${withVectors.length}/${allRecords.length} (${(withVectors.length / allRecords.length * 100).toFixed(1)}%)`);
    
    // 6. 期待値との比較
    console.log(`\n=== 6. 期待値との比較 ===`);
    const expectedMinRecords = 100; // 最低100レコード
    const expectedVectorDimensions = 768; // 768次元
    
    console.log(`レコード数: ${count} (期待: ${expectedMinRecords}以上) ${count >= expectedMinRecords ? '✅' : '❌'}`);
    
    if (withVectors.length > 0) {
      const sampleVector = withVectors[0].vector?.toArray ? withVectors[0].vector.toArray() : withVectors[0].vector;
      const actualDimensions = sampleVector?.length || 0;
      console.log(`ベクトル次元数: ${actualDimensions} (期待: ${expectedVectorDimensions}) ${actualDimensions === expectedVectorDimensions ? '✅' : '❌'}`);
    }
    
    // 7. 総合評価
    console.log(`\n=== 7. 総合評価 ===`);
    const allChecksPassed = count >= expectedMinRecords && withVectors.length > 0;
    
    if (allChecksPassed) {
      console.log('✅ データインポートは成功しています');
      console.log('📋 推奨: 検索品質テストを実行');
    } else {
      console.log('⚠️ データインポートに問題があります');
      console.log('📋 推奨: 問題を修正してから次のステップに進む');
    }
    
  } catch (error) {
    console.error('❌ 検証エラー:', error);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ データインポートの検証完了');
}

// 検証実行
if (require.main === module) {
  verifyDataImport();
}

export { verifyDataImport };
