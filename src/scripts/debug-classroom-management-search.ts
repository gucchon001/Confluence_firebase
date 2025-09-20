/**
 * 教室管理の検索結果をデバッグするスクリプト
 */
import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { searchLanceDB } from '../lib/lancedb-search-client';

async function debugClassroomManagementSearch() {
  try {
    console.log('=== 教室管理の検索デバッグ ===');
    
    // 複数のクエリでテスト
    const queries = [
      '教室管理',
      '教室管理の詳細',
      '教室管理の仕様',
      '教室管理機能',
      '教室管理システム'
    ];
    
    for (const query of queries) {
      console.log(`\n--- クエリ: "${query}" ---`);
      
      try {
        const results = await searchLanceDB({
          query,
          topK: 10,
          useLunrIndex: false
        });
        
        console.log(`検索結果数: ${results.length}`);
        
        // 教室管理を含む結果をチェック
        const classroomManagementResults = results.filter(r => 
          r.title.includes('教室管理') || 
          r.title.includes('classroom management')
        );
        
        console.log(`教室管理を含む結果数: ${classroomManagementResults.length}`);
        
        if (classroomManagementResults.length > 0) {
          console.log('教室管理を含む結果:');
          classroomManagementResults.forEach((result, index) => {
            console.log(`  ${index + 1}. ${result.title} (距離: ${result.distance}%)`);
          });
        }
        
        // 上位5件を表示
        console.log('上位5件:');
        results.slice(0, 5).forEach((result, index) => {
          console.log(`  ${index + 1}. ${result.title} (距離: ${result.distance}%)`);
        });
        
      } catch (error) {
        console.error(`クエリ "${query}" でエラー:`, error);
      }
    }
    
    // 特定の教室管理ページを直接検索
    console.log('\n--- 特定の教室管理ページの検索 ---');
    
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    const db = await lancedb.connect(dbPath);
    const tbl = await db.openTable('confluence');
    
    const specificPages = [
      '500_■教室管理機能',
      '160_【FIX】教室管理機能',
      '教室管理機能'
    ];
    
    for (const pageTitle of specificPages) {
      console.log(`\n--- "${pageTitle}" の検索 ---`);
      
      const pages = await tbl.query()
        .where(`title LIKE '%${pageTitle.replace(/'/g, "''")}%'`)
        .limit(5)
        .toArray();
      
      console.log(`見つかったページ数: ${pages.length}`);
      
      pages.forEach((page, index) => {
        console.log(`  ${index + 1}. ${page.title} (ベクトル: ${page.vector ? 'あり' : 'なし'})`);
      });
    }
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

debugClassroomManagementSearch().catch(console.error);
