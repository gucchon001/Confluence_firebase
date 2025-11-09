/**
 * 指定タイトルのStructuredLabel状況を確認する簡易スクリプト
 */

import * as lancedb from '@lancedb/lancedb';

const TARGET_TITLES = [
  '【作成中】会員登録完了通知メール（会員宛）',
  '【作成中】会員登録用URL通知メール（会員宛）',
  '【作成中】会員登録兼応募完了メール（会員宛）',
  '【作成中】応募兼会員登録完了通知メール（会員宛）',
  '保留待機メール（会員宛）',
];

async function main() {
  const db = await lancedb.connect('.lancedb');
  const table = await db.openTable('confluence');

  for (const title of TARGET_TITLES) {
    const rows = await table
      .query()
      .where(`title = '${title.replace(/'/g, "''")}'`)
      .limit(5)
      .toArray();

    console.log(`\n=== ${title} ===`);
    if (rows.length === 0) {
      console.log('  レコードが見つかりませんでした');
      continue;
    }

    rows.forEach((row, idx) => {
      console.log(`  [${idx + 1}] page_id=${row.page_id ?? row.pageId ?? 'N/A'}`);
      console.log(`      structured_category: ${row.structured_category ?? 'undefined'}`);
      console.log(`      structured_feature : ${row.structured_feature ?? 'undefined'}`);
      console.log(`      structured_domain  : ${row.structured_domain ?? 'undefined'}`);
      console.log(`      structured_tags    : ${Array.isArray(row.structured_tags) ? row.structured_tags.join(', ') : '[]'}`);
      console.log(`      labels             : ${Array.isArray(row.labels) ? row.labels.join(', ') : '[]'}`);
    });
  }
}

main().catch(error => {
  console.error('❌ エラーが発生しました:', error);
  process.exit(1);
});


