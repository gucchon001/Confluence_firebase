/**
 * 簡単なLanceDBデータベースチェック
 */

import { LanceDBClient } from './src/lib/lancedb-client';

async function checkDatabase() {
  console.log('🔍 LanceDBデータベースチェック開始...');
  
  try {
    const lancedbClient = LanceDBClient.getInstance();
    await lancedbClient.connect();
    const table = await lancedbClient.getTable();
    
    // 全データを取得
    const dummyVector = new Array(768).fill(0);
    const allData = await table.search(dummyVector).limit(10000).toArray();
    
    console.log(`📊 総チャンク数: ${allData.length}`);
    
    // ユニークページ数
    const uniquePageIds = new Set<number>();
    allData.forEach((row: any) => {
      uniquePageIds.add(row.pageId);
    });
    
    console.log(`📄 ユニークページ数: ${uniquePageIds.size}`);
    console.log(`📊 平均チャンク数/ページ: ${(allData.length / uniquePageIds.size).toFixed(2)}`);
    
    // ラベル分布
    const labelCounts: Record<string, number> = {};
    allData.forEach((row: any) => {
      if (row.labels && Array.isArray(row.labels)) {
        row.labels.forEach((label: string) => {
          labelCounts[label] = (labelCounts[label] || 0) + 1;
        });
      }
    });
    
    console.log('\n🏷️ ラベル分布（上位10件）:');
    const sortedLabels = Object.entries(labelCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
    
    sortedLabels.forEach(([label, count], index) => {
      console.log(`  ${index + 1}. ${label}: ${count}件`);
    });
    
    // 教室管理関連ページの検索
    const classroomKeywords = ['教室管理', '教室一覧', '教室登録', '教室編集', '教室削除', '教室コピー'];
    
    const classroomPages = allData
      .filter((row: any) => 
        classroomKeywords.some(keyword => 
          row.title && row.title.includes(keyword)
        )
      )
      .map((row: any) => ({
        pageId: row.pageId,
        title: row.title,
        labels: row.labels || []
      }));
    
    // ページIDごとにグループ化
    const pageGroups: Record<number, any[]> = {};
    classroomPages.forEach(page => {
      if (!pageGroups[page.pageId]) {
        pageGroups[page.pageId] = [];
      }
      pageGroups[page.pageId].push(page);
    });
    
    console.log('\n🏫 教室管理関連ページ:');
    Object.keys(pageGroups).forEach(pageId => {
      const pages = pageGroups[parseInt(pageId)];
      const firstPage = pages[0];
      console.log(`  ページID: ${pageId}, タイトル: ${firstPage.title}, チャンク数: ${pages.length}`);
    });
    
    console.log('\n✅ データベースチェック完了');
    
  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

checkDatabase();
