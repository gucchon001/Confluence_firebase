/**
 * LanceDBインデックス作成スクリプト
 * 検索性能を大幅に向上させるためのインデックスを作成
 */

import { LanceDBClient } from './src/lib/lancedb-client';

async function createLanceDBIndex(): Promise<void> {
  console.log('🚀 LanceDBインデックス作成を開始...');
  
  try {
    const lancedbClient = LanceDBClient.getInstance();
    await lancedbClient.connect();
    const table = await lancedbClient.getTable();
    
    console.log('📊 現在のデータベース状態を確認中...');
    
    // 現在のデータ数を確認
    const dummyVector = new Array(768).fill(0);
    const allData = await table.search(dummyVector).limit(10000).toArray();
    console.log(`  総チャンク数: ${allData.length}件`);
    
    console.log('\n🔧 インデックス作成中...');
    
    // IVF-PQインデックスを作成
    await table.createIndex(
      'vector', // vector_column_name
      {
        metric: 'cosine',
        num_partitions: 16,
        num_sub_vectors: 64,
        replace: true
      }
    );
    
    console.log('✅ インデックス作成完了！');
    console.log('\n📈 期待される効果:');
    console.log('  - 検索速度の大幅向上（10-100倍）');
    console.log('  - 応答時間の大幅短縮');
    console.log('  - データ量増加に対する耐性向上');
    
    console.log('\n⚠️ 注意事項:');
    console.log('  - インデックス作成には時間がかかる場合があります');
    console.log('  - 作成中は検索性能が一時的に低下する可能性があります');
    
  } catch (error) {
    console.error('❌ インデックス作成エラー:', error);
    
    if (error.message.includes('already exists')) {
      console.log('ℹ️ インデックスは既に存在します');
    }
  }
}

// メイン実行
createLanceDBIndex().catch(console.error);
