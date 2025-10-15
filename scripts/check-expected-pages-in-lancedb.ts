import { OptimizedLanceDBClient } from '../src/lib/optimized-lancedb-client';

// 期待ページのリスト
const expectedPages = [
  { id: 1, query: "退会後の再登録", pageNumber: "046", title: "046_【FIX】会員退会機能" },
  { id: 2, query: "教室削除条件", pageNumber: "164", title: "164_【FIX】教室削除機能" },
  { id: 3, query: "教室コピー項目", pageNumber: "168", title: "168_【FIX】教室コピー機能" },
  { id: 4, query: "応募制限有無", pageNumber: "014", title: "014_【FIX】求人応募機能" },
  { id: 5, query: "重複応募期間", pageNumber: "014", title: "014_【FIX】求人応募機能" },
  { id: 6, query: "学年・職業更新条件", pageNumber: "721", title: "721_【FIX】塾講師-学年・職業更新機能" }
];

async function main() {
  const client = OptimizedLanceDBClient.getInstance();
  const conn = await client.getConnection();
  const table = conn.table;
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 期待ページのLanceDB存在確認');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // 全レコード取得
  const allRecords = await table.query().limit(10000).toArrow();
  const titleCol = allRecords.getChildAt(allRecords.schema.fields.findIndex((f: any) => f.name === 'title'));
  const idCol = allRecords.getChildAt(allRecords.schema.fields.findIndex((f: any) => f.name === 'id'));
  const pageIdCol = allRecords.getChildAt(allRecords.schema.fields.findIndex((f: any) => f.name === 'pageId'));
  const isChunkedCol = allRecords.getChildAt(allRecords.schema.fields.findIndex((f: any) => f.name === 'isChunked'));
  
  let foundCount = 0;
  let notFoundCount = 0;
  
  for (const expectedPage of expectedPages) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`事例${expectedPage.id}: ${expectedPage.query}`);
    console.log(`期待ページ: ${expectedPage.pageNumber}_...`);
    console.log(`期待タイトル: ${expectedPage.title}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // タイトルで検索
    const matches: any[] = [];
    for (let i = 0; i < allRecords.numRows; i++) {
      const title = String(titleCol?.get(i));
      
      // ページ番号でマッチング（タイトルの先頭がページ番号）
      if (title.startsWith(`${expectedPage.pageNumber}_`)) {
        matches.push({
          index: i,
          title: title,
          id: String(idCol?.get(i)),
          pageId: String(pageIdCol?.get(i)),
          isChunked: isChunkedCol?.get(i)
        });
      }
    }
    
    if (matches.length > 0) {
      foundCount++;
      console.log(`✅ 発見: ${matches.length}件のレコード\n`);
      
      matches.forEach((match, idx) => {
        console.log(`  ${idx + 1}. タイトル: ${match.title}`);
        console.log(`     id: ${match.id}`);
        console.log(`     pageId: ${match.pageId}`);
        console.log(`     isChunked: ${match.isChunked}`);
      });
    } else {
      notFoundCount++;
      console.log(`❌ 未発見: LanceDBに存在しません\n`);
      
      // 類似タイトルを検索
      console.log(`  類似タイトルを検索中...`);
      const similarTitles: string[] = [];
      for (let i = 0; i < allRecords.numRows; i++) {
        const title = String(titleCol?.get(i));
        if (title.includes(expectedPage.pageNumber)) {
          similarTitles.push(title);
        }
      }
      
      if (similarTitles.length > 0) {
        console.log(`  類似タイトル (${similarTitles.length}件):`);
        similarTitles.slice(0, 5).forEach(title => {
          console.log(`    - ${title}`);
        });
      } else {
        console.log(`  類似タイトルも見つかりませんでした`);
      }
    }
    
    console.log('');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 サマリー');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`期待ページ総数: ${expectedPages.length}ページ`);
  console.log(`  ✅ LanceDBに存在: ${foundCount}ページ (${(foundCount / expectedPages.length * 100).toFixed(1)}%)`);
  console.log(`  ❌ LanceDBに不在: ${notFoundCount}ページ (${(notFoundCount / expectedPages.length * 100).toFixed(1)}%)\n`);
  
  if (notFoundCount > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚨 重大な問題');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`${notFoundCount}ページが完全にLanceDBから消失しています。`);
    console.log('これらのページは以下のいずれかの理由で削除された可能性があります:\n');
    console.log('  1. rebuild-lancedb-smart-chunking.tsでConfluenceから取得できなかった');
    console.log('  2. エラーが発生してスキップされた');
    console.log('  3. validRecordsフィルタリングで除外された\n');
    console.log('推奨アクション:');
    console.log('  → rebuild-lancedb-smart-chunking.tsのログを確認');
    console.log('  → Confluenceから直接ページを確認');
    console.log('  → Phase 0A-2のLanceDBデータを復元\n');
  }
  
  await client.disconnect();
}

main().catch(console.error);

