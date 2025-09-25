import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

async function analyzeLanceDB() {
  try {
    console.log('🔍 LanceDBデータベース分析開始');
    console.log('=====================================');
    
    const db = await lancedb.connect(path.resolve(process.cwd(), '.lancedb'));
    const tables = await db.tableNames();
    console.log('📊 利用可能なテーブル:', tables);
    
    if (tables.includes('confluence')) {
      const tbl = await db.openTable('confluence');
      const count = await tbl.countRows();
      console.log('📈 confluenceテーブルのレコード数:', count);
      
      // スキーマ情報を取得
      const schema = tbl.schema;
      console.log('\n📋 スキーマ情報:');
      console.log(JSON.stringify(schema, null, 2));
      
      // サンプルデータを取得
      const sample = await tbl.head(3);
      console.log('\n📄 サンプルデータ（最初の3件）:');
      sample.forEach((record: any, index: number) => {
        console.log(`\n--- レコード ${index + 1} ---`);
        console.log('ID:', record.id);
        console.log('ページID:', record.pageId);
        console.log('タイトル:', record.title);
        console.log('スペースキー:', record.space_key);
        console.log('ラベル:', record.labels);
        console.log('URL:', record.url);
        console.log('ベクトル次元数:', record.vector ? record.vector.length : 'なし');
        console.log('コンテンツ長:', record.content ? record.content.length : 'なし');
      });
      
      // 統計情報を取得
      console.log('\n📊 統計情報:');
      
      // ラベルの分布を確認
      const allData = await tbl.head(1000); // 最初の1000件を取得
      const labelCounts: { [key: string]: number } = {};
      const spaceKeyCounts: { [key: string]: number } = {};
      let totalVectorDimensions = 0;
      let totalContentLength = 0;
      
      allData.forEach((record: any) => {
        // ラベル統計
        if (record.labels && Array.isArray(record.labels)) {
          record.labels.forEach((label: string) => {
            labelCounts[label] = (labelCounts[label] || 0) + 1;
          });
        }
        
        // スペースキー統計
        if (record.space_key) {
          spaceKeyCounts[record.space_key] = (spaceKeyCounts[record.space_key] || 0) + 1;
        }
        
        // ベクトル次元数
        if (record.vector && Array.isArray(record.vector)) {
          totalVectorDimensions += record.vector.length;
        }
        
        // コンテンツ長
        if (record.content) {
          totalContentLength += record.content.length;
        }
      });
      
      console.log('🏷️ ラベル分布（上位10件）:');
      const sortedLabels = Object.entries(labelCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);
      sortedLabels.forEach(([label, count]) => {
        console.log(`  ${label}: ${count}件`);
      });
      
      console.log('\n🌐 スペースキー分布:');
      Object.entries(spaceKeyCounts).forEach(([spaceKey, count]) => {
        console.log(`  ${spaceKey}: ${count}件`);
      });
      
      console.log('\n📏 データ品質:');
      console.log(`  平均ベクトル次元数: ${totalVectorDimensions / allData.length}`);
      console.log(`  平均コンテンツ長: ${Math.round(totalContentLength / allData.length)}文字`);
      
      // データの範囲を確認
      const pageIds = allData.map((r: any) => r.pageId).filter((id: any) => id != null);
      if (pageIds.length > 0) {
        console.log(`  ページID範囲: ${Math.min(...pageIds)} - ${Math.max(...pageIds)}`);
      }
      
    } else {
      console.log('❌ confluenceテーブルが見つかりません');
    }
    
    console.log('\n✅ 分析完了');
    
  } catch (error: any) {
    console.error('❌ エラー:', error.message);
    console.error('スタックトレース:', error.stack);
  }
}

analyzeLanceDB();
