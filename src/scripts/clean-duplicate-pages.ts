import 'dotenv/config';
import { LanceDBClient } from '../lib/lancedb-client';

async function cleanDuplicatePages() {
  console.log('🧹 重複ページをクリーンアップ中...');
  
  const client = LanceDBClient.getInstance();
  await client.connect();
  const table = await client.getTable();
  
  // 全データを取得
  const allData = await table.search(new Array(768).fill(0)).limit(10000).toArray();
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
  
  // 重複ページを特定
  const duplicates = [];
  pageGroups.forEach((chunks, pageId) => {
    if (chunks.length > 1) {
      // 最新のチャンクを保持（lastUpdatedが最新のもの）
      const sortedChunks = chunks.sort((a: any, b: any) => 
        new Date(b.lastUpdated || 0).getTime() - new Date(a.lastUpdated || 0).getTime()
      );
      
      duplicates.push({
        pageId,
        title: chunks[0].title,
        totalChunks: chunks.length,
        keepChunks: sortedChunks.length,
        removeChunks: chunks.length - sortedChunks.length
      });
    }
  });
  
  console.log(`\n⚠️ 重複ページ: ${duplicates.length}件`);
  
  if (duplicates.length > 0) {
    console.log('\n📋 重複ページ一覧（最初の10件）:');
    duplicates.slice(0, 10).forEach(dup => {
      console.log(`  PageID: ${dup.pageId} - ${dup.title}`);
      console.log(`    総チャンク数: ${dup.totalChunks}件`);
      console.log(`    保持チャンク数: ${dup.keepChunks}件`);
      console.log(`    削除チャンク数: ${dup.removeChunks}件`);
    });
    
    if (duplicates.length > 10) {
      console.log(`  ... 他 ${duplicates.length - 10}件`);
    }
    
    console.log('\n🔄 重複データをクリーンアップしますか？ (y/N)');
    // 自動的にクリーンアップを実行
    console.log('✅ 自動クリーンアップを実行します...');
    
    let cleanedCount = 0;
    for (const dup of duplicates) {
      const chunks = pageGroups.get(dup.pageId);
      if (chunks && chunks.length > 1) {
        // 最新のチャンクを保持
        const sortedChunks = chunks.sort((a: any, b: any) => 
          new Date(b.lastUpdated || 0).getTime() - new Date(a.lastUpdated || 0).getTime()
        );
        
        // 古いチャンクを削除
        const toRemove = sortedChunks.slice(1); // 最新以外を削除
        for (const chunk of toRemove) {
          try {
            await table.delete(`id = '${chunk.id}'`);
            cleanedCount++;
          } catch (error) {
            console.error(`❌ 削除エラー (${chunk.id}):`, error);
          }
        }
      }
    }
    
    console.log(`\n✅ クリーンアップ完了: ${cleanedCount}件の重複チャンクを削除しました`);
  } else {
    console.log('✅ 重複ページはありません');
  }
  
  // クリーンアップ後の状況を確認
  const finalData = await table.search(new Array(768).fill(0)).limit(10000).toArray();
  console.log(`\n📊 クリーンアップ後のデータ数: ${finalData.length}件`);
  
  // 教室管理関連ページの確認
  const classroomPages = finalData.filter((r: any) => 
    r.title && r.title.includes('教室管理')
  );
  
  console.log(`\n🏫 教室管理関連ページ: ${classroomPages.length}件`);
  const uniqueClassroomPages = new Set(classroomPages.map((p: any) => p.pageId));
  console.log(`📊 ユニーク教室管理ページ数: ${uniqueClassroomPages.size}件`);
}

cleanDuplicatePages().catch(console.error);
