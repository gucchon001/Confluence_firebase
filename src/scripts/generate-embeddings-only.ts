/**
 * 埋め込み生成のみを実行するスクリプト
 * 
 * 既存のレコードに対して埋め込みを生成し、更新する
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../lib/embeddings';

/**
 * 埋め込み生成のみを実行する
 */
async function generateEmbeddingsOnly(): Promise<void> {
  console.log('🔧 埋め込み生成のみを実行');
  console.log('='.repeat(80));
  console.log(`開始時刻: ${new Date().toISOString()}`);
  
  try {
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tbl = await db.openTable('confluence');
    
    // 1. 既存レコードの確認
    const count = await tbl.countRows();
    console.log(`\n=== 1. 既存レコードの確認 ===`);
    console.log(`総レコード数: ${count}`);
    
    if (count === 0) {
      console.log('❌ レコードが存在しません');
      return;
    }
    
    // 2. ベクトルなしレコードの特定
    console.log(`\n=== 2. ベクトルなしレコードの特定 ===`);
    const allRecords = await tbl.query().toArray();
    const recordsWithoutVectors = allRecords.filter(r => {
      const vector = r.vector?.toArray ? r.vector.toArray() : r.vector;
      return !vector || !Array.isArray(vector) || vector.length === 0;
    });
    
    console.log(`ベクトルなしレコード数: ${recordsWithoutVectors.length}/${allRecords.length}`);
    
    if (recordsWithoutVectors.length === 0) {
      console.log('✅ すべてのレコードにベクトルが存在します');
      return;
    }
    
    // 3. 埋め込み生成の実行
    console.log(`\n=== 3. 埋め込み生成の実行 ===`);
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    
    for (const record of recordsWithoutVectors) {
      try {
        processedCount++;
        console.log(`\n--- レコード ${processedCount}/${recordsWithoutVectors.length} ---`);
        console.log(`ID: ${record.id}`);
        console.log(`タイトル: ${record.title}`);
        console.log(`コンテンツ長: ${record.content?.length || 0}文字`);
        
        // 埋め込み生成
        const content = record.content || record.title || 'No content';
        const embedding = await getEmbeddings(content);
        
        console.log(`✅ 埋め込み生成成功: ${embedding.length}次元`);
        
        // レコード更新（ベクトルデータを正しい形式で保存）
        await tbl.update({
          values: {
            id: record.id,
            vector: Array.from(embedding)
          }
        });
        
        console.log(`✅ レコード更新成功`);
        successCount++;
        
        // 進捗表示
        if (processedCount % 10 === 0) {
          console.log(`\n📊 進捗: ${processedCount}/${recordsWithoutVectors.length} (${(processedCount / recordsWithoutVectors.length * 100).toFixed(1)}%)`);
        }
        
      } catch (error) {
        console.error(`❌ レコード ${record.id} の処理エラー:`, error);
        errorCount++;
      }
    }
    
    // 4. 結果の確認
    console.log(`\n=== 4. 結果の確認 ===`);
    console.log(`処理済み: ${processedCount}件`);
    console.log(`成功: ${successCount}件`);
    console.log(`エラー: ${errorCount}件`);
    
    // 5. 最終確認
    console.log(`\n=== 5. 最終確認 ===`);
    const finalRecords = await tbl.query().toArray();
    const finalWithVectors = finalRecords.filter(r => {
      const vector = r.vector?.toArray ? r.vector.toArray() : r.vector;
      return vector && Array.isArray(vector) && vector.length > 0;
    });
    
    console.log(`ベクトル付きレコード数: ${finalWithVectors.length}/${finalRecords.length} (${(finalWithVectors.length / finalRecords.length * 100).toFixed(1)}%)`);
    
    if (finalWithVectors.length === finalRecords.length) {
      console.log('🎉 すべてのレコードにベクトルが生成されました！');
    } else {
      console.log('⚠️ 一部のレコードにベクトルが生成されていません');
    }
    
  } catch (error) {
    console.error('❌ 埋め込み生成エラー:', error);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ 埋め込み生成完了');
}

/**
 * メイン実行関数
 */
async function main(): Promise<void> {
  try {
    await generateEmbeddingsOnly();
  } catch (error) {
    console.error('❌ 実行エラー:', error);
    process.exit(1);
  }
}

// スクリプト実行
if (require.main === module) {
  main();
}

export { generateEmbeddingsOnly };
