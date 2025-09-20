import 'dotenv/config';
import { extractKeywordsHybrid } from '../src/lib/keyword-extractor';

async function main() {
  const queries = [
    'ログイン機能の詳細を教えて',
    '教室管理の仕様は',
    '急募の設定箇所は'
  ];
  console.log('USE_LLM_EXPANSION =', process.env.USE_LLM_EXPANSION);
  for (const q of queries) {
    console.log('\n=== QUERY ===');
    console.log(q);
    const { keywords, highPriority, lowPriority } = await extractKeywordsHybrid(q);
    console.log('[Extract] keywords:', keywords);
    console.log('[Extract] highPriority:', Array.from(highPriority));
    console.log('[Extract] lowPriority:', Array.from(lowPriority));
  }
}

main().catch(err => { console.error(err); process.exit(1); });


