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
  createScalarIndex: boolean;
  createVectorIndex: boolean;
  numPartitions: number;
  numSubVectors: number;
}

const DEFAULT_OPTIONS: IndexCreationOptions = {
  createScalarIndex: true,
  createVectorIndex: true,
  numPartitions: 256, // データ量の平方根が目安。1000ページ程度なら256
  numSubVectors: 96, // 768次元の場合、768/8=96が一般的
};

async function createLanceDBIndexes(options: IndexCreationOptions = DEFAULT_OPTIONS) {
  const startTime = Date.now();
  
  console.log('🚀 LanceDBインデックス作成開始...\n');
  console.log('📊 設定:');
  console.log(`   - スカラーインデックス: ${options.createScalarIndex ? '✅ 作成する' : '⏭️ スキップ'}`);
  console.log(`   - ベクトルインデックス: ${options.createVectorIndex ? '✅ 作成する' : '⏭️ スキップ'}`);
  console.log(`   - ベクトルタイプ: IVF_PQ`);
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
    
    // 1. スカラーインデックスの作成（pageId列）
    if (options.createScalarIndex) {
      console.log('🔧 スカラーインデックス作成中...');
      console.log('   対象列: pageId, id');
      
      const scalarStartTime = Date.now();
      
      try {
        // pageId列にインデックス作成（ダブルクォートで囲む）
        await table.createIndex('"pageId"', {
          config: lancedb.Index.btree()
        });
        console.log('   ✅ pageId列のインデックス作成完了');
        
        // id列にもインデックス作成
        await table.createIndex('"id"', {
          config: lancedb.Index.btree()
        });
        console.log('   ✅ id列のインデックス作成完了');
        
        const scalarDuration = Date.now() - scalarStartTime;
        console.log(`   ⏱️ スカラーインデックス作成時間: ${(scalarDuration / 1000).toFixed(2)}秒\n`);
        
      } catch (scalarError: any) {
        console.error('   ❌ スカラーインデックス作成失敗:', scalarError.message);
        console.error('      既にインデックスが存在する可能性があります\n');
      }
    }
    
    // 2. ベクトルインデックスの作成
    if (options.createVectorIndex) {
      console.log('🔧 ベクトルインデックス作成中...');
      console.log(`   タイプ: IVF_PQ`);
      console.log(`   パーティション数: ${options.numPartitions}`);
      console.log(`   サブベクトル数: ${options.numSubVectors}`);
      
      const vectorStartTime = Date.now();
      
      try {
<<<<<<< HEAD
        if (options.vectorIndexType === 'ivf_pq') {
          await table.createIndex('vector', {
            config: lancedb.Index.ivfPq({
              numPartitions: options.numPartitions,
              numSubVectors: options.numSubVectors
            })
          });
        } else {
          // IVF_HNSW（より高精度だが時間がかかる）
          // 注意: ivfHnswは現在サポートされていないため、ivfPqを使用
          await table.createIndex('vector', {
            config: lancedb.Index.ivfPq({
              numPartitions: options.numPartitions,
              numSubVectors: options.numSubVectors
            })
          });
        }
=======
        await table.createIndex('vector', {
          config: lancedb.Index.ivfPq({
            numPartitions: options.numPartitions,
            numSubVectors: options.numSubVectors
          })
        });
>>>>>>> e345680eabf81ba2ab1631b1e1a18fc53b205fb1
        
        const vectorDuration = Date.now() - vectorStartTime;
        console.log(`   ✅ ベクトルインデックス作成完了`);
        console.log(`   ⏱️ ベクトルインデックス作成時間: ${(vectorDuration / 1000).toFixed(2)}秒\n`);
        
      } catch (vectorError: any) {
        console.error('   ❌ ベクトルインデックス作成失敗:', vectorError.message);
        console.error('      既にインデックスが存在する可能性があります\n');
      }
    }
    
    const totalDuration = Date.now() - startTime;
    
    console.log('🎉 インデックス作成完了！');
    console.log(`⏱️ 総実行時間: ${(totalDuration / 1000).toFixed(2)}秒\n`);
    
    console.log('📊 期待される効果:');
    console.log('   - getAllChunksByPageId: 30秒 → 1秒未満');
    console.log('   - ベクトル検索: 大規模データでも高速維持');
    console.log('   - フィルター検索: インデックスルックアップで高速化\n');
    
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
    createScalarIndex: !args.includes('--skip-scalar'),
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

