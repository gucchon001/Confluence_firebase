import * as path from 'path';
import * as lancedb from '@lancedb/lancedb';

async function main() {
  const dbPath = path.resolve(process.cwd(), '.lancedb');
  const tableName = 'confluence';
  const db = await lancedb.connect(dbPath);

  const tables = await db.tableNames();
  if (!tables.includes(tableName)) {
    console.error(`Table '${tableName}' not found at ${dbPath}`);
    process.exit(1);
  }
  const tbl = await db.openTable(tableName);

  // ログイン機能のページIDを検索
  const pageIds = ['703889475'];
  
  console.log('=== 指定されたページIDの検索 ===');
  for (const pageId of pageIds) {
    console.log(`\nページID ${pageId} を検索中...`);
    try {
      const results = await tbl.query().where(`pageId = '${pageId}'`).toArray();
      console.log(`結果: ${results.length}件`);
      if (results.length > 0) {
        results.forEach((r, i) => {
          console.log(`  ${i+1}. タイトル: ${r.title}`);
          console.log(`     ラベル: ${JSON.stringify(r.labels)}`);
          console.log(`     URL: ${r.url}`);
        });
      } else {
        console.log('  見つかりませんでした');
      }
    } catch (error) {
      console.log(`  エラー: ${error.message}`);
    }
  }
  
  // ログイン関連のタイトル検索
  console.log('\n=== ログイン関連のタイトル検索 ===');
  const allResults = await tbl.query().select(['pageId', 'title', 'labels']).toArray();
  const loginResults = allResults.filter(r => 
    r.title && (r.title.includes('ログイン') || r.title.includes('ログアウト'))
  );
  
  console.log(`ログイン関連: ${loginResults.length}件`);
  loginResults.forEach(r => {
    console.log(`  - ${r.title} (pageId: ${r.pageId})`);
  });
  
  // 全レコード数の確認
  console.log(`\n=== 全体統計 ===`);
  console.log(`総レコード数: ${allResults.length}`);

  const unique = new Set<string>();
  const batchSize = 5000;
  let offset = 0;

  while (true) {
    // LanceDB Node API はオフセット指定の公式サポートが弱いため、limit で逐次走査
    const rows = await tbl.query().select(['labels']).limit(batchSize).toArray();
    if (!rows.length) break;
    for (const r of rows) {
      const raw = (r as any).labels;
      const labels: string[] = Array.isArray(raw)
        ? raw
        : (raw && typeof raw.toArray === 'function')
          ? raw.toArray().map((x: any) => String(x))
          : [];
      for (const l of labels) unique.add(l);
    }
    // 取得件数が batchSize 未満であれば終了
    if (rows.length < batchSize) break;
    // 連続呼び出しでも内部でカーソル進行することがあるため、単純ループ継続
    offset += rows.length;
  }

  console.log(JSON.stringify({ uniqueLabels: unique.size, labels: Array.from(unique).sort() }, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });


