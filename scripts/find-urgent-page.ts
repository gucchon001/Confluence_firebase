/**
 * 急募機能ページを検索
 */
import { searchLanceDB } from '../src/lib/lancedb-search-client';
import { config } from 'dotenv';

config();

async function main() {
  console.log('急募機能を検索中...\n');
  
  const results = await searchLanceDB({
    query: '急募機能の詳細を教えて',
    topK: 15,
    labelFilters: { includeMeetingNotes: false }
  });
  
  console.log(`検索結果: ${results.length}件\n`);
  console.log('Top 15 結果:\n');
  
  results.slice(0, 15).forEach((r, i) => {
    console.log(`${i + 1}. ${r.title}`);
    if (r.pageId) {
      console.log(`   PageID: ${r.pageId}`);
    }
  });
}

main().catch(console.error);

