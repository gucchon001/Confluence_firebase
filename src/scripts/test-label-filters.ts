import { searchLanceDB } from '../lib/lancedb-search-client';

async function main() {
  const query = 'Seed content';

  // 1) includeLabels OR フィルタ: '機能要件' を含む
  const r1 = await searchLanceDB({ query, topK: 20, includeLabels: ['機能要件'] });
  console.log('[Test] includeLabels=機能要件 count=', r1.length);

  // 2) 条件付き除外: 議事録を除外 (デフォルト: includeMeetingNotes=false)
  const r2 = await searchLanceDB({ query, topK: 50, labelFilters: { includeArchived: false, includeMeetingNotes: false } });
  const hasMeetingNotes = r2.some(x => (x.labels||[]).includes('議事録') || (x.labels||[]).includes('meeting-notes'));
  console.log('[Test] exclude meeting-notes? ->', !hasMeetingNotes);

  // 3) 条件付き許可: 議事録を含める
  const r3 = await searchLanceDB({ query, topK: 50, labelFilters: { includeArchived: false, includeMeetingNotes: true } });
  const hasMeetingNotes3 = r3.some(x => (x.labels||[]).includes('議事録') || (x.labels||[]).includes('meeting-notes'));
  console.log('[Test] include meeting-notes? ->', hasMeetingNotes3);

  // 4) 完全除外: 'フォルダ' と 'スコープ外' は常に除外
  const r4 = await searchLanceDB({ query, topK: 50 });
  const hasExcluded = r4.some(x => (x.labels||[]).some(l => l === 'フォルダ' || l === 'スコープ外'));
  console.log('[Test] exclude always labels present? ->', !hasExcluded);
}

main().catch(e => { console.error(e); process.exit(1); });
