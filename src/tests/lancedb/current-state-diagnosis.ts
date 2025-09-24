/**
 * 現在の状況の診断
 * 
 * 実際の状況を正確に把握し、必要な修正を特定する
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../../lib/embeddings';
import * as fs from 'fs';

/**
 * 現在の状況を診断する
 */
async function diagnoseCurrentState(): Promise<void> {
  console.log('🔍 現在の状況の診断');
  console.log('='.repeat(80));
  console.log(`開始時刻: ${new Date().toISOString()}`);
  
  // 1. 埋め込みモデルの確認
  console.log('\n=== 1. 埋め込みモデルの確認 ===');
  try {
    const testText = 'テスト用のサンプルテキストです';
    const embedding = await getEmbeddings(testText);
    
    console.log(`✅ 埋め込み生成成功`);
    console.log(`   次元数: ${embedding.length}`);
    console.log(`   値の範囲: ${Math.min(...embedding).toFixed(4)} ～ ${Math.max(...embedding).toFixed(4)}`);
    
    if (embedding.length === 768) {
      console.log(`✅ 期待通りの768次元モデルが動作中`);
    } else {
      console.log(`❌ 期待される768次元ではありません (実際: ${embedding.length})`);
    }
  } catch (error) {
    console.error('❌ 埋め込みモデルエラー:', error);
  }
  
  // 2. LanceDBディレクトリの確認
  console.log('\n=== 2. LanceDBディレクトリの確認 ===');
  const lancedbPath = path.resolve('.lancedb');
  const lancedbExists = fs.existsSync(lancedbPath);
  
  console.log(`LanceDBパス: ${lancedbPath}`);
  console.log(`ディレクトリ存在: ${lancedbExists ? '✅' : '❌'}`);
  
  if (lancedbExists) {
    const files = fs.readdirSync(lancedbPath);
    console.log(`ファイル数: ${files.length}`);
    if (files.length > 0) {
      console.log(`ファイル一覧: ${files.join(', ')}`);
    } else {
      console.log(`⚠️ ディレクトリは空です`);
    }
  }
  
  // 3. LanceDBテーブルの確認
  console.log('\n=== 3. LanceDBテーブルの確認 ===');
  try {
    const db = await lancedb.connect(lancedbPath);
    const tableNames = await db.tableNames();
    
    console.log(`✅ LanceDB接続成功`);
    console.log(`利用可能なテーブル: ${tableNames.length > 0 ? tableNames.join(', ') : 'なし'}`);
    
    if (tableNames.length === 0) {
      console.log(`❌ テーブルが存在しません`);
    } else {
      for (const tableName of tableNames) {
        const tbl = await db.openTable(tableName);
        const count = await tbl.countRows();
        console.log(`   テーブル '${tableName}': ${count}件のレコード`);
        
        if (count > 0) {
          const sample = await tbl.query().limit(1).toArray();
          if (sample.length > 0) {
            const vector = sample[0].vector?.toArray ? sample[0].vector.toArray() : sample[0].vector;
            const vectorDimensions = vector?.length || 0;
            console.log(`     ベクトル次元数: ${vectorDimensions}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ LanceDBテーブル確認エラー:', error);
  }
  
  // 4. 検索テスト（テーブルが存在する場合）
  console.log('\n=== 4. 検索テスト ===');
  try {
    const db = await lancedb.connect(lancedbPath);
    const tableNames = await db.tableNames();
    
    if (tableNames.includes('confluence')) {
      const tbl = await db.openTable('confluence');
      const count = await tbl.countRows();
      
      if (count > 0) {
        const testQuery = '教室管理の詳細は';
        const embedding = await getEmbeddings(testQuery);
        const results = await tbl.search(embedding).limit(5).toArray();
        
        console.log(`✅ 検索テスト成功`);
        console.log(`   クエリ: "${testQuery}"`);
        console.log(`   結果数: ${results.length}件`);
        
        if (results.length > 0) {
          const distances = results.map(r => r._distance || 0);
          console.log(`   距離範囲: ${Math.min(...distances).toFixed(4)} ～ ${Math.max(...distances).toFixed(4)}`);
        }
      } else {
        console.log(`❌ confluenceテーブルは空です`);
      }
    } else {
      console.log(`❌ confluenceテーブルが存在しません`);
    }
  } catch (error) {
    console.error('❌ 検索テストエラー:', error);
  }
  
  // 5. 診断結果と推奨アクション
  console.log('\n=== 5. 診断結果と推奨アクション ===');
  
  try {
    const db = await lancedb.connect(lancedbPath);
    const tableNames = await db.tableNames();
    
    if (tableNames.length === 0) {
      console.log('🔧 推奨アクション:');
      console.log('   1. LanceDBテーブルを作成');
      console.log('   2. Confluenceデータを再インポート');
      console.log('   3. 新しいモデル（768次元）でデータを処理');
    } else if (!tableNames.includes('confluence')) {
      console.log('🔧 推奨アクション:');
      console.log('   1. confluenceテーブルを作成');
      console.log('   2. Confluenceデータをインポート');
    } else {
      const tbl = await db.openTable('confluence');
      const count = await tbl.countRows();
      
      if (count === 0) {
        console.log('🔧 推奨アクション:');
        console.log('   1. Confluenceデータをインポート');
      } else {
        const sample = await tbl.query().limit(1).toArray();
        if (sample.length > 0) {
          const vector = sample[0].vector?.toArray ? sample[0].vector.toArray() : sample[0].vector;
          const vectorDimensions = vector?.length || 0;
          
          if (vectorDimensions !== 768) {
            console.log('🔧 推奨アクション:');
            console.log('   1. テーブルを再構築（次元数の不一致）');
            console.log(`   2. 現在の次元数: ${vectorDimensions}, 期待: 768`);
          } else {
            console.log('✅ システムは正常に動作しています');
            console.log('📋 推奨: 検索品質テストを実行');
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ 診断エラー:', error);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ 診断完了');
}

// 診断実行
if (require.main === module) {
  diagnoseCurrentState();
}

export { diagnoseCurrentState };
