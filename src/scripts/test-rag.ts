import 'dotenv/config';
import { answerWithRag } from '../lib/rag-engine';
import { LabelFilterOptions } from '../lib/search-weights';

async function main() {
  const queries = [
    '教室管理の仕様',
    '急募機能の詳細',
    'ログイン機能の仕様'
  ];

  for (const q of queries) {
    console.log(`\n=== RAG: ${q} ===`);
    const labelFilters: LabelFilterOptions = { includeMeetingNotes: false, includeArchived: false };
    const ans = await answerWithRag(q, { labelFilters });
    console.log('\n--- 要約 ---');
    console.log(ans.summary);
    console.log('\n--- 要点 ---');
    ans.bullets.forEach(b => console.log(`- ${b}`));
    console.log('\n--- 引用 ---');
    ans.citations.forEach((c, i) => console.log(`[${i+1}] ${c.title} ${c.scoreText ? `(${c.scoreText})` : ''}`));
  }
}

main().catch(console.error);


