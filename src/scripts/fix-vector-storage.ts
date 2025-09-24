/**
 * ベクトル保存の修正
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../lib/embeddings';

async function fixVectorStorage(): Promise<void> {
  console.log('🔧 ベクトル保存の修正');
  console.log('='.repeat(80));
  
  try {
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tbl = await db.openTable('confluence');
    
    // 1. 現在のデータ状況の確認
    console.log(`\n=== 1. 現在のデータ状況 ===`);
    const count = await tbl.countRows();
    console.log(`総レコード数: ${count}`);
    
    // 2. サンプルレコードの確認
    console.log(`\n=== 2. サンプルレコードの確認 ===`);
    const sampleRecords = await tbl.query().limit(3).toArray();
    for (const record of sampleRecords) {
      console.log(`\n--- レコード: ${record.id} ---`);
      console.log(`タイトル: ${record.title}`);
      console.log(`ベクトルフィールド: ${record.vector ? '存在' : '不存在'}`);
      if (record.vector) {
        console.log(`ベクトル型: ${typeof record.vector}`);
        console.log(`ベクトル配列か: ${Array.isArray(record.vector)}`);
        if (record.vector.toArray) {
          const vectorArray = record.vector.toArray();
          console.log(`ベクトル次元数: ${vectorArray.length}`);
        }
      }
    }
    
    // 3. ベクトルの再生成と更新
    console.log(`\n=== 3. ベクトルの再生成と更新 ===`);
    
    const allRecords = await tbl.query().toArray();
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    
    for (const record of allRecords) {
      try {
        processedCount++;
        console.log(`\n--- レコード ${processedCount}/${allRecords.length}: ${record.title} ---`);
        
        // 埋め込み生成
        const content = record.content || record.title || 'No content';
        const embedding = await getEmbeddings(content);
        
        console.log(`✅ 埋め込み生成成功: ${embedding.length}次元`);
        
        // ベクトルの更新（Float32Arrayとして保存）
        await tbl.update({
          id: record.id,
          vector: new Float32Array(embedding)
        });
        
        console.log(`✅ ベクトル更新成功`);
        successCount++;
        
        // 進捗表示
        if (processedCount % 10 === 0) {
          console.log(`\n📊 進捗: ${processedCount}/${allRecords.length} (${(processedCount / allRecords.length * 100).toFixed(1)}%)`);
        }
        
      } catch (error) {
        console.error(`❌ レコード ${record.id} の処理エラー:`, error);
        errorCount++;
      }
    }
    
    // 4. 最終確認
    console.log(`\n=== 4. 最終確認 ===`);
    console.log(`処理済み: ${processedCount}件`);
    console.log(`成功: ${successCount}件`);
    console.log(`エラー: ${errorCount}件`);
    
    // 5. 更新後のサンプル確認
    console.log(`\n=== 5. 更新後のサンプル確認 ===`);
    const updatedRecords = await tbl.query().limit(3).toArray();
    for (const record of updatedRecords) {
      console.log(`\n--- レコード: ${record.id} ---`);
      console.log(`タイトル: ${record.title}`);
      
      const vector = record.vector?.toArray ? record.vector.toArray() : record.vector;
      if (vector && Array.isArray(vector)) {
        console.log(`✅ ベクトル次元数: ${vector.length}`);
        console.log(`ベクトル範囲: ${Math.min(...vector).toFixed(4)} ～ ${Math.max(...vector).toFixed(4)}`);
      } else {
        console.log('❌ ベクトルが存在しません');
      }
    }
    
  } catch (error) {
    console.error('❌ ベクトル保存修正エラー:', error);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ ベクトル保存の修正完了');
}

if (require.main === module) {
  fixVectorStorage();
}

export { fixVectorStorage };
