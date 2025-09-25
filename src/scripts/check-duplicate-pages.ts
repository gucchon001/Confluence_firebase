import 'dotenv/config';
import { LanceDBClient } from '../lib/lancedb-client';

async function checkDuplicatePages() {
  console.log('🔍 重複ページをチェック中...');
  
  const client = LanceDBClient.getInstance();
  await client.connect();
  const table = await client.getTable();
  
  // 全データを取得
  const allData = await table.search(new Array(768).fill(0)).limit(5000).toArray();
  console.log(`📊 総データ数: ${allData.length}件`);
  
  // ページIDごとにグループ化
  const pageGroups = new Map();
  allData.forEach((row: any) => {
    const pageId = row.pageId;
    if (!pageGroups.has(pageId)) {
      pageGroups.set(pageId, []);
    }
    pageGroups.get(pageId).push(row);
  });
  
  console.log(`📊 ユニークページ数: ${pageGroups.size}件`);
  
  // 重複ページをチェック
  const duplicates = [];
  pageGroups.forEach((chunks, pageId) => {
    if (chunks.length > 1) {
      duplicates.push({
        pageId,
        title: chunks[0].title,
        chunkCount: chunks.length,
        chunks: chunks.map(c => ({ id: c.id, chunkIndex: c.chunkIndex }))
      });
    }
  });
  
  if (duplicates.length > 0) {
    console.log(`\n⚠️ 重複ページが検出されました: ${duplicates.length}件`);
    duplicates.forEach(dup => {
      console.log(`  PageID: ${dup.pageId} - ${dup.title}`);
      console.log(`    チャンク数: ${dup.chunkCount}件`);
      console.log(`    チャンクID: ${dup.chunks.map(c => c.id).join(', ')}`);
    });
  } else {
    console.log('✅ 重複ページは検出されませんでした');
  }
  
  // 教室管理関連ページの詳細確認
  const classroomPages = allData.filter((r: any) => 
    r.title && r.title.includes('教室管理')
  );
  
  console.log(`\n🏫 教室管理関連ページ詳細:`);
  classroomPages.forEach((page: any) => {
    console.log(`  PageID: ${page.pageId}`);
    console.log(`  タイトル: ${page.title}`);
    console.log(`  チャンクID: ${page.id}`);
    console.log(`  ラベル: ${JSON.stringify(page.labels)}`);
    console.log(`  ラベル型: ${typeof page.labels}`);
    console.log(`  ラベル配列か: ${Array.isArray(page.labels)}`);
    console.log('');
  });
}

checkDuplicatePages().catch(console.error);
