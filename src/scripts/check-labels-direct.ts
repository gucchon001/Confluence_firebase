import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';

/**
 * 直接的な方法でラベルをチェック
 */
async function checkLabelsDirect(): Promise<void> {
  try {
    console.log('🔍 直接的なラベルチェック');
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
    
    // ベクトル検索でサンプルを取得（フィルタなし）
    console.log('\n🔍 ベクトル検索でサンプル取得:');
    console.log('-'.repeat(60));
    
    const searchResults = await tbl.search(new Array(768).fill(0.1))
      .limit(10)
      .execute();
    
    console.log(`検索結果件数: ${searchResults?.length || 0}`);
    
    if (searchResults && searchResults.length > 0) {
      let recordsWithLabels = 0;
      const labelCounts: { [key: string]: number } = {};
      
      for (let i = 0; i < searchResults.length; i++) {
        const record = searchResults[i];
        console.log(`\n📄 レコード ${i + 1}:`);
        console.log(`   タイトル: ${record.title}`);
        console.log(`   ID: ${record.id}`);
        console.log(`   PageID: ${record.pageId}`);
        console.log(`   Space: ${record.space_key}`);
        
        // ラベルの処理
        let labels = [];
        try {
          if (record.labels && typeof record.labels.toArray === 'function') {
            labels = record.labels.toArray();
          } else if (Array.isArray(record.labels)) {
            labels = record.labels;
          }
        } catch (error) {
          console.log(`   ラベル取得エラー: ${error}`);
        }
        
        const hasLabels = Array.isArray(labels) && labels.length > 0;
        console.log(`   ラベル: [${labels.join(', ')}]`);
        console.log(`   ラベル有無: ${hasLabels ? '✅ あり' : '❌ なし'}`);
        
        if (hasLabels) {
          recordsWithLabels++;
          
          // ラベルカウント
          for (const label of labels) {
            labelCounts[label] = (labelCounts[label] || 0) + 1;
          }
        }
      }
      
      console.log('\n📊 統計情報:');
      console.log(`   総レコード数: ${searchResults.length}`);
      console.log(`   ラベル有り: ${recordsWithLabels}`);
      console.log(`   ラベル無し: ${searchResults.length - recordsWithLabels}`);
      console.log(`   ラベル保有率: ${((recordsWithLabels / searchResults.length) * 100).toFixed(1)}%`);
      
      // ラベルの種類を集計
      if (Object.keys(labelCounts).length > 0) {
        console.log('\n📊 ラベル種類別統計:');
        const sortedLabels = Object.entries(labelCounts)
          .sort(([,a], [,b]) => b - a);
        
        for (const [label, count] of sortedLabels) {
          console.log(`   ${label}: ${count}件`);
        }
      } else {
        console.log('\n⚠️ ラベルが存在するレコードが見つかりませんでした');
      }
      
      // ラベル有りのレコードの詳細表示
      if (recordsWithLabels > 0) {
        console.log('\n🏷️ ラベル有りレコード詳細:');
        console.log('-'.repeat(60));
        
        for (let i = 0; i < searchResults.length; i++) {
          const record = searchResults[i];
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
            console.log(`📄 ${record.title}`);
            console.log(`   ラベル: [${labels.join(', ')}]`);
            console.log(`   URL: ${record.url}`);
            console.log('');
          }
        }
      }
      
    } else {
      console.log('❌ 検索結果が取得できませんでした');
    }
    
  } catch (error: any) {
    console.error('❌ エラー:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

checkLabelsDirect();

