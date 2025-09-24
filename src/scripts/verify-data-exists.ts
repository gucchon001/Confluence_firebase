import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';

/**
 * データの存在を基本的な方法で確認
 */
async function verifyDataExists(): Promise<void> {
  try {
    console.log('🔍 データ存在確認');
    console.log('='.repeat(60));
    
    const db = await lancedb.connect('.lancedb');
    const tbl = await db.openTable('confluence');
    
    // 全レコード数を取得
    const count = await tbl.countRows();
    console.log(`📊 総レコード数: ${count}`);
    
    if (count === 0) {
      console.log('❌ データが存在しません');
      return;
    }
    
    // テーブルの基本情報を確認
    console.log('\n📋 テーブル基本情報:');
    console.log('-'.repeat(60));
    
    try {
      // スキーマ情報を取得
      const schema = tbl.schema;
      if (schema) {
        console.log('✅ スキーマ取得成功');
        console.log('Schema fields:', Object.keys(schema));
      } else {
        console.log('⚠️ スキーマ情報が取得できません');
      }
    } catch (error) {
      console.log('⚠️ スキーマ取得エラー:', error);
    }
    
    // ベクトル検索のテスト（異なるベクトルで）
    console.log('\n🔍 ベクトル検索テスト:');
    console.log('-'.repeat(60));
    
    const testVectors = [
      new Array(768).fill(0.0),      // ゼロベクトル
      new Array(768).fill(0.1),      // 小さな値
      new Array(768).fill(1.0),      // 大きな値
      Array.from({length: 768}, () => Math.random()) // ランダムベクトル
    ];
    
    for (let i = 0; i < testVectors.length; i++) {
      try {
        console.log(`\nテストベクトル ${i + 1}:`);
        const results = await tbl.search(testVectors[i])
          .limit(5)
          .execute();
        
        console.log(`   検索結果: ${results?.length || 0}件`);
        
        if (results && results.length > 0) {
          console.log(`   ✅ 検索成功！最初の結果:`);
          const first = results[0];
          console.log(`      タイトル: ${first.title}`);
          console.log(`      ID: ${first.id}`);
          console.log(`      距離: ${first._distance?.toFixed(4) || 'N/A'}`);
          
          // ラベル確認
          let labels = [];
          try {
            if (first.labels && typeof first.labels.toArray === 'function') {
              labels = first.labels.toArray();
            } else if (Array.isArray(first.labels)) {
              labels = first.labels;
            }
          } catch (error) {
            console.log(`      ラベル取得エラー: ${error}`);
          }
          
          console.log(`      ラベル: [${labels.join(', ')}]`);
          console.log(`      ラベル有無: ${Array.isArray(labels) && labels.length > 0 ? '✅ あり' : '❌ なし'}`);
          
          // 最初の成功で詳細を表示
          if (i === 0) { // ゼロベクトルの場合
            console.log(`\n📋 検索結果の詳細（最初の5件）:`);
            for (let j = 0; j < Math.min(5, results.length); j++) {
              const record = results[j];
              let recordLabels = [];
              try {
                if (record.labels && typeof record.labels.toArray === 'function') {
                  recordLabels = record.labels.toArray();
                } else if (Array.isArray(record.labels)) {
                  recordLabels = record.labels;
                }
              } catch (error) {
                // ラベル取得エラーは無視
              }
              
              console.log(`\n   📄 ${j + 1}. ${record.title}`);
              console.log(`      ラベル: [${recordLabels.join(', ')}]`);
              console.log(`      ラベル有無: ${Array.isArray(recordLabels) && recordLabels.length > 0 ? '✅ あり' : '❌ なし'}`);
              console.log(`      距離: ${record._distance?.toFixed(4) || 'N/A'}`);
            }
          }
          
          break; // 成功したら他のテストはスキップ
        } else {
          console.log(`   ❌ 検索結果なし`);
        }
      } catch (error) {
        console.log(`   ❌ 検索エラー: ${error.message}`);
      }
    }
    
    // ラベル統計
    console.log('\n📊 ラベル統計:');
    console.log('-'.repeat(60));
    
    try {
      const results = await tbl.search(new Array(768).fill(0.0))
        .limit(100) // より多くのサンプルを取得
        .execute();
      
      if (results && results.length > 0) {
        let recordsWithLabels = 0;
        const labelCounts: { [key: string]: number } = {};
        
        for (const record of results) {
          let labels = [];
          try {
            if (record.labels && typeof record.labels.toArray === 'function') {
              labels = record.labels.toArray();
            } else if (Array.isArray(record.labels)) {
              labels = record.labels;
            }
          } catch (error) {
            continue;
          }
          
          if (Array.isArray(labels) && labels.length > 0) {
            recordsWithLabels++;
            
            for (const label of labels) {
              labelCounts[label] = (labelCounts[label] || 0) + 1;
            }
          }
        }
        
        console.log(`サンプル数: ${results.length}`);
        console.log(`ラベル有り: ${recordsWithLabels}`);
        console.log(`ラベル無し: ${results.length - recordsWithLabels}`);
        console.log(`ラベル保有率: ${((recordsWithLabels / results.length) * 100).toFixed(1)}%`);
        
        if (Object.keys(labelCounts).length > 0) {
          console.log('\nラベル種類別統計（上位10種類）:');
          const sortedLabels = Object.entries(labelCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);
          
          for (const [label, count] of sortedLabels) {
            console.log(`   ${label}: ${count}件`);
          }
        }
      }
    } catch (error) {
      console.log(`ラベル統計エラー: ${error.message}`);
    }
    
  } catch (error: any) {
    console.error('❌ エラー:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

verifyDataExists();

