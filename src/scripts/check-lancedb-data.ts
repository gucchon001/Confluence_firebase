/**
 * LanceDBデータの検証スクリプト
 */
import * as lancedb from '@lancedb/lancedb';
import path from 'path';

async function checkLanceDBData() {
  try {
    console.log('🔍 LanceDBデータの検証を開始...');
    
    const db = await lancedb.connect(path.join(process.cwd(), '.lancedb'));
    const tbl = await db.openTable('confluence');
    
    // テーブルの基本情報
    const count = await tbl.countRows();
    console.log('📊 LanceDBテーブル情報:');
    console.log(`総レコード数: ${count}`);
    
    if (count === 0) {
      console.log('⚠️  テーブルにデータがありません');
      return;
    }
    
    // 最新の10件のデータを確認
    const recentData = await tbl.query().limit(10).toArray();
    console.log('\n📋 最新の10件のデータ:');
    recentData.forEach((record, index) => {
      console.log(`${index + 1}. ID: ${record.id}, タイトル: ${record.title}, pageId: ${record.pageId}`);
    });
    
    // pageIdの分布を確認
    const pageIds = await tbl.query().select(['pageId']).toArray();
    const uniquePageIds = new Set(pageIds.map(r => r.pageId));
    console.log(`\n📈 ユニークなpageId数: ${uniquePageIds.size}`);
    
    // ラベルの分布を確認
    const labelsData = await tbl.query().select(['labels']).toArray();
    const allLabels = new Set<string>();
    labelsData.forEach(record => {
      if (Array.isArray(record.labels)) {
        record.labels.forEach(label => allLabels.add(label));
      }
    });
    console.log(`\n🏷️  ユニークなラベル数: ${allLabels.size}`);
    console.log(`ラベル一覧: ${Array.from(allLabels).slice(0, 10).join(', ')}${allLabels.size > 10 ? '...' : ''}`);
    
    // スペースキーの分布を確認
    const spaceKeys = await tbl.query().select(['space_key']).toArray();
    const uniqueSpaceKeys = new Set(spaceKeys.map(r => r.space_key));
    console.log(`\n📁 ユニークなスペースキー数: ${uniqueSpaceKeys.size}`);
    console.log(`スペースキー一覧: ${Array.from(uniqueSpaceKeys).join(', ')}`);
    
    console.log('\n✅ データ検証完了');
    
  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

// スクリプト実行
if (require.main === module) {
  checkLanceDBData();
}

export { checkLanceDBData };
