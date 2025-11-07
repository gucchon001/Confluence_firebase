import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';

/**
 * 基本的な方法でデータのラベルをチェック
 */
async function checkDataBasic(): Promise<void> {
  try {
    console.log('🔍 基本的なデータラベルチェック');
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
    
    // テーブルのスキーマを確認
    console.log('\n📋 テーブルスキーマ:');
    console.log('-'.repeat(60));
    try {
      const schema = tbl.schema;
      console.log('Schema:', JSON.stringify(schema, null, 2));
    } catch (error) {
      console.log('⚠️ スキーマ取得エラー:', error);
    }
    
    // 特定の条件でレコードを検索
    console.log('\n🔍 特定条件でのレコード検索:');
    console.log('-'.repeat(60));
    
    try {
      // ページIDで検索
      const pageSearch = await tbl.search(new Array(768).fill(0.1))
        .where('pageId = 705232936')
        .limit(1)
        .toArray();
      
      console.log(`ページID 705232936 の検索結果: ${pageSearch?.length || 0}件`);
      
      if (pageSearch && pageSearch.length > 0) {
        const record = pageSearch[0];
        const labels = record.labels?.toArray ? record.labels.toArray() : record.labels || [];
        console.log(`📄 タイトル: ${record.title}`);
        console.log(`   ラベル: [${Array.isArray(labels) ? labels.join(', ') : 'なし'}]`);
        console.log(`   ラベル有無: ${Array.isArray(labels) && labels.length > 0 ? '✅ あり' : '❌ なし'}`);
      }
    } catch (error) {
      console.log('⚠️ ページ検索エラー:', error);
    }
    
    // ラベルが存在するレコードを検索
    console.log('\n🏷️ ラベルが存在するレコードを検索:');
    console.log('-'.repeat(60));
    
    try {
      // 空でないラベルを持つレコードを検索
      const labelSearch = await tbl.search(new Array(768).fill(0.1))
        .where('labels IS NOT NULL')
        .limit(10)
        .toArray();
      
      console.log(`ラベル有りレコード検索結果: ${labelSearch?.length || 0}件`);
      
      if (labelSearch && labelSearch.length > 0) {
        let recordsWithLabels = 0;
        const labelCounts: { [key: string]: number } = {};
        
        for (const record of labelSearch) {
          const labels = record.labels?.toArray ? record.labels.toArray() : record.labels || [];
          const hasLabels = Array.isArray(labels) && labels.length > 0;
          
          if (hasLabels) {
            recordsWithLabels++;
            
            // ラベルカウント
            if (Array.isArray(labels)) {
              for (const label of labels) {
                labelCounts[label] = (labelCounts[label] || 0) + 1;
              }
            }
            
            console.log(`📄 ${record.title}`);
            console.log(`   ラベル: [${labels.join(', ')}]`);
            console.log('');
          }
        }
        
        console.log(`✅ ラベル有りレコード: ${recordsWithLabels}件`);
        
        if (Object.keys(labelCounts).length > 0) {
          console.log('\n📊 ラベル種類別統計:');
          const sortedLabels = Object.entries(labelCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);
          
          for (const [label, count] of sortedLabels) {
            console.log(`   ${label}: ${count}件`);
          }
        }
      } else {
        console.log('⚠️ ラベルが存在するレコードが見つかりませんでした');
      }
    } catch (error) {
      console.log('⚠️ ラベル検索エラー:', error);
    }
    
    // ランダムなレコードをいくつか取得
    console.log('\n🎲 ランダムなレコードのサンプル:');
    console.log('-'.repeat(60));
    
    try {
      const randomSearch = await tbl.search(new Array(768).fill(Math.random()))
        .limit(5)
        .toArray();
      
      console.log(`ランダム検索結果: ${randomSearch?.length || 0}件`);
      
      if (randomSearch && randomSearch.length > 0) {
        for (const record of randomSearch) {
          const labels = record.labels?.toArray ? record.labels.toArray() : record.labels || [];
          console.log(`📄 ${record.title}`);
          console.log(`   ラベル: [${Array.isArray(labels) ? labels.join(', ') : 'なし'}]`);
          console.log(`   ラベル有無: ${Array.isArray(labels) && labels.length > 0 ? '✅ あり' : '❌ なし'}`);
          console.log('');
        }
      }
    } catch (error) {
      console.log('⚠️ ランダム検索エラー:', error);
    }
    
  } catch (error: any) {
    console.error('❌ エラー:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

checkDataBasic();

