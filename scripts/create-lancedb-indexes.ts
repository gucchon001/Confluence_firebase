/**
 * LanceDBインデックス作成スクリプト
 * 
 * **目的**: 
 * - pageId列へのスカラーインデックス作成（getAllChunksByPageId高速化）
 * - vector列へのベクトルインデックス作成（RAG検索高速化）
 * 
 * **効果**:
 * - getAllChunksByPageId: 30秒 → 1秒未満
 * - ベクトル検索: 大規模データでも高速維持
 * 
 * **使用方法**:
 * ```bash
 * npm run lancedb:create-indexes
 * ```
 */

import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

interface IndexCreationOptions {
  createVectorIndex: boolean;
  numPartitions: number;
  numSubVectors: number;
}

const DEFAULT_OPTIONS: IndexCreationOptions = {
  createVectorIndex: true,
  numPartitions: 256, // データ量の平方根が目安。1000ページ程度なら256
  numSubVectors: 96, // 768次元の場合、768/8=96が一般的
};

async function createLanceDBIndexes(options: IndexCreationOptions = DEFAULT_OPTIONS) {
  const startTime = Date.now();
  
  console.log('🚀 LanceDBインデックス作成開始...\n');
  console.log('📊 設定:');
  console.log(`   - ベクトルインデックス: ${options.createVectorIndex ? '✅ 作成する' : '⏭️ スキップ'}`);
  console.log(`   - タイプ: IVF_PQ`);
  console.log(`   - パーティション数: ${options.numPartitions}`);
  console.log(`   - サブベクトル数: ${options.numSubVectors}\n`);
  
  try {
    // LanceDBに接続
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    console.log(`📂 LanceDB接続中: ${dbPath}`);
    const db = await lancedb.connect(dbPath);
    console.log('✅ LanceDB接続成功\n');
    
    // テーブルを開く
    const tableName = 'confluence';
    console.log(`📋 テーブルを開く: ${tableName}`);
    const table = await db.openTable(tableName);
    console.log('✅ テーブルオープン成功\n');
    
    // テーブル統計情報を取得
    const rowCount = await table.countRows();
    console.log(`📊 テーブル統計:`);
    console.log(`   - 総行数: ${rowCount.toLocaleString()}行\n`);
    
    if (options.createVectorIndex) {
      console.log('🔧 ベクトルインデックス作成中...');
      console.log(`   タイプ: IVF_PQ`);
      console.log(`   パーティション数: ${options.numPartitions}`);
      console.log(`   サブベクトル数: ${options.numSubVectors}`);
      
      const vectorStartTime = Date.now();
      
      try {
        await table.createIndex('vector', {
          config: lancedb.Index.ivfPq({
            numPartitions: options.numPartitions,
            numSubVectors: options.numSubVectors
          })
        });
        
        const vectorDuration = Date.now() - vectorStartTime;
        console.log(`   ✅ ベクトルインデックス作成完了`);
        console.log(`   ⏱️ ベクトルインデックス作成時間: ${(vectorDuration / 1000).toFixed(2)}秒\n`);
        
      } catch (vectorError: any) {
        console.error('   ❌ ベクトルインデックス作成失敗:', vectorError.message);
        console.error('      既にインデックスが存在する可能性があります\n');
      }
    }
    
    // スカラーインデックス（pageId, id）作成
    try {
      console.log('🔧 スカラーインデックス作成中...');
      const scalarStart = Date.now();
      // フィールド名は引用符なしで指定
      await table.createIndex('pageId');
      await table.createIndex('id');
      console.log(`   ✅ スカラーインデックス作成完了 (pageId, id)`);
      console.log(`   ⏱️ スカラーインデックス作成時間: ${((Date.now()-scalarStart)/1000).toFixed(2)}秒\n`);
    } catch (scalarError: any) {
      console.warn('   ⚠️ スカラーインデックス作成スキップ/失敗:', scalarError?.message || scalarError);
    }

    const totalDuration = Date.now() - startTime;
    
    console.log('🎉 インデックス作成完了！');
    console.log(`⏱️ 総実行時間: ${(totalDuration / 1000).toFixed(2)}秒\n`);
    
    console.log('📊 期待される効果:');
    console.log('   - ベクトル検索: 大規模データでも高速維持\n');
    
    console.log('✅ 次のステップ:');
    console.log('   1. データを本番環境にアップロード');
    console.log('   2. npm run upload:production-data');
    console.log('   3. 本番環境でパフォーマンステスト実施\n');
    
  } catch (error: any) {
    console.error('❌ インデックス作成エラー:', error);
    console.error('   詳細:', error.stack);
    process.exit(1);
  }
}

// メイン処理
async function main() {
  const args = process.argv.slice(2);
  
  // コマンドライン引数でオプションを制御
  const options: IndexCreationOptions = {
    createVectorIndex: !args.includes('--skip-vector'),
    numPartitions: parseInt(args.find(arg => arg.startsWith('--partitions='))?.split('=')[1] || '256'),
    numSubVectors: parseInt(args.find(arg => arg.startsWith('--subvectors='))?.split('=')[1] || '96'),
  };
  
  await createLanceDBIndexes(options);
}

// スクリプト実行
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ スクリプト実行エラー:', error);
    process.exit(1);
  });
}

export { createLanceDBIndexes };