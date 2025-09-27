/**
 * 特定の教室管理ページを同期するスクリプト
 */
import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../lib/embeddings';

async function syncSpecificClassroomPages() {
  try {
    // LanceDBに接続
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    const db = await lancedb.connect(dbPath);
    const tbl = await db.openTable('confluence');
    
    // 特定のページID
    const specificPageIds = ['511', '512'];
    
    console.log('=== 特定の教室管理ページを同期 ===');
    
    for (const pageId of specificPageIds) {
      console.log(`\n--- ページID ${pageId} の処理 ---`);
      
      // 既存のページを検索
      const existingPages = await tbl.query()
        .where(`"pageId" = ${parseInt(pageId)}`)
        .toArray();
      
      console.log(`既存のページ数: ${existingPages.length}`);
      
      if (existingPages.length > 0) {
        console.log('既存のページ:');
        existingPages.forEach((page, index) => {
          console.log(`  ${index + 1}. ${page.title} (ベクトル: ${page.vector ? 'あり' : 'なし'})`);
        });
        
        // ベクトルが存在しないページを再処理
        const pagesWithoutVector = existingPages.filter(page => !page.vector);
        
        if (pagesWithoutVector.length > 0) {
          console.log(`\nベクトルが存在しないページ数: ${pagesWithoutVector.length}`);
          
          for (const page of pagesWithoutVector) {
            try {
              console.log(`ページ "${page.title}" のベクトルを生成中...`);
              
              // 埋め込みベクトルを生成
              const content = `${page.title}\n\n${page.content}`;
              const vector = await getEmbeddings(content);
              
              console.log(`ベクトル生成完了 (${vector.length} 次元)`);
              
              // ページを更新
              const updatedPage = {
                ...page,
                vector: vector
              };
              
              // 既存のページを削除
              await tbl.delete(`id = '${page.id}'`);
              
              // 更新されたページを追加
              await tbl.add([updatedPage]);
              
              console.log(`ページ "${page.title}" の更新が完了しました`);
              
            } catch (error) {
              console.error(`ページ "${page.title}" の処理でエラー:`, error);
            }
          }
        } else {
          console.log('すべてのページにベクトルが存在します');
        }
      } else {
        console.log(`ページID ${pageId} のページが見つかりませんでした`);
      }
    }
    
    // 最終確認
    console.log('\n=== 最終確認 ===');
    for (const pageId of specificPageIds) {
      const pages = await tbl.query()
        .where(`"pageId" = ${parseInt(pageId)}`)
        .toArray();
      
      console.log(`\nページID ${pageId}:`);
      pages.forEach((page, index) => {
        console.log(`  ${index + 1}. ${page.title} (ベクトル: ${page.vector ? 'あり' : 'なし'})`);
      });
    }
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

syncSpecificClassroomPages().catch(console.error);
