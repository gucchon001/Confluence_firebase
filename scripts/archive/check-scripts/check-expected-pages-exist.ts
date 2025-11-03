/**
 * テストケースで期待されるページが実際にLanceDBに存在するか確認
 */

import { optimizedLanceDBClient } from '../src/lib/optimized-lancedb-client';

async function checkPages() {
  console.log('\n🔍 期待されるページの存在確認\n');
  
  const conn = await optimizedLanceDBClient.getConnection();
  const tbl = conn.table;
  
  const expectedPages = [
    { id: '168', description: 'Case 1: 教室コピー' },
    { id: '164', description: 'Case 2: 教室削除' },
    { id: '177', description: 'Case 2: 教室削除（参照先）' },
    { id: '046', description: 'Case 3: 会員退会' },
  ];
  
  for (const page of expectedPages) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📄 ページ番号: ${page.id} (${page.description})`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    // タイトルで検索（"168_" で始まる）
    try {
      const byTitle = await tbl.query()
        .where(`title LIKE '${page.id}_%'`)
        .limit(5)
        .toArray();
      
      if (byTitle.length > 0) {
        console.log(`✅ タイトル検索でヒット: ${byTitle.length}件`);
        byTitle.forEach((r, idx) => {
          console.log(`   ${idx + 1}. pageId=${r.pageId}, title=${r.title}`);
        });
      } else {
        console.log(`❌ タイトル検索でヒットなし（"${page.id}_"で始まるタイトル）`);
        
        // 部分一致で検索
        const partial = await tbl.query()
          .where(`title LIKE '%${page.id}%'`)
          .limit(5)
          .toArray();
        
        if (partial.length > 0) {
          console.log(`🔍 部分一致でヒット: ${partial.length}件`);
          partial.forEach((r, idx) => {
            console.log(`   ${idx + 1}. pageId=${r.pageId}, title=${r.title}`);
          });
        } else {
          console.log(`❌ 部分一致でもヒットなし`);
        }
      }
    } catch (error) {
      console.error(`❌ エラー:`, error);
    }
  }
  
  // 全ページタイトルのサンプルを表示
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 LanceDB内の全ページタイトルサンプル（20件）`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  const sample = await tbl.query().limit(20).toArray();
  sample.forEach((r, idx) => {
    console.log(`${idx + 1}. pageId=${r.pageId}, title=${r.title}`);
  });
  
  process.exit(0);
}

checkPages().catch(error => {
  console.error('\n❌ エラー:', error);
  process.exit(1);
});

