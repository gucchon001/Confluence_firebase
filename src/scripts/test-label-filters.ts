import { searchLanceDB } from '../lib/lancedb-search-client';
import { labelManager } from '../lib/label-manager';

async function main() {
  const query = 'Seed content';

  // 1) includeLabels OR フィルタ: '機能要件' を含む
  const r1 = await searchLanceDB({ query, topK: 20, includeLabels: ['機能要件'] });
  console.log('[Test] includeLabels=機能要件 count=', r1.length);

  // 2) 条件付き除外: 議事録を除外 (デフォルト: includeMeetingNotes=false)
  const filterOptions1 = { includeArchived: false, includeMeetingNotes: false };
  const r2 = await searchLanceDB({ query, topK: 50, labelFilters: filterOptions1 });
  const excludeLabels1 = labelManager.buildExcludeLabels(filterOptions1);
  const hasMeetingNotes = r2.some(x => labelManager.isExcluded(x.labels, ['議事録', 'meeting-notes']));
  console.log('[Test] exclude meeting-notes? ->', !hasMeetingNotes);
  console.log('[Test] excludeLabels generated:', excludeLabels1);

  // 3) 条件付き許可: 議事録を含める
  const filterOptions2 = { includeArchived: false, includeMeetingNotes: true };
  const r3 = await searchLanceDB({ query, topK: 50, labelFilters: filterOptions2 });
  const excludeLabels2 = labelManager.buildExcludeLabels(filterOptions2);
  const hasMeetingNotes3 = r3.some(x => labelManager.isExcluded(x.labels, ['議事録', 'meeting-notes']));
  console.log('[Test] include meeting-notes? ->', !hasMeetingNotes3);
  console.log('[Test] excludeLabels generated:', excludeLabels2);

  // 4) 完全除外: 'フォルダ' と 'スコープ外' は常に除外
  const r4 = await searchLanceDB({ query, topK: 50 });
  
  // ラベル形式のデバッグ
  console.log('\n=== ラベル形式デバッグ ===');
  if (r4.length > 0) {
    const firstResult = r4[0];
    console.log('First result title:', firstResult.title);
    console.log('Labels type:', typeof firstResult.labels);
    console.log('Labels constructor:', firstResult.labels?.constructor?.name);
    console.log('Labels value:', firstResult.labels);
    console.log('Labels length:', firstResult.labels?.length);
    
    if (firstResult.labels && firstResult.labels.length > 0) {
      console.log('First label:', firstResult.labels[0]);
      console.log('First label type:', typeof firstResult.labels[0]);
    }
  }
  
  // フォルダラベルを持つ項目を詳細にチェック
  const folderItems = r4.filter(x => (x.labels||[]).includes('フォルダ'));
  const scopeItems = r4.filter(x => (x.labels||[]).includes('スコープ外'));
  
  console.log(`\nフォルダラベルを持つ項目数: ${folderItems.length}`);
  if (folderItems.length > 0) {
    console.log('フォルダラベルを持つ項目:');
    folderItems.forEach(item => {
      console.log(`  - ${item.title} (labels: ${JSON.stringify(item.labels)})`);
    });
  }
  
  console.log(`スコープ外ラベルを持つ項目数: ${scopeItems.length}`);
  if (scopeItems.length > 0) {
    console.log('スコープ外ラベルを持つ項目:');
    scopeItems.forEach(item => {
      console.log(`  - ${item.title} (labels: ${JSON.stringify(item.labels)})`);
    });
  }
  
  const hasExcluded = r4.some(x => (x.labels||[]).some(l => l === 'フォルダ' || l === 'スコープ外'));
  console.log('\n[Test] exclude always labels present? ->', !hasExcluded);
}

main().catch(e => { console.error(e); process.exit(1); });
