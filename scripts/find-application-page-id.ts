/**
 * 求人応募機能のpageIdを検索するスクリプト
 */

// 環境変数を読み込み
import * as dotenv from 'dotenv';
dotenv.config();

import { searchLanceDB } from '../src/lib/lancedb-search-client';
import { getPageIdFromRecord } from '../src/lib/pageid-migration-helper';

async function findPageId() {
  const results = await searchLanceDB({
    query: '014_【FIX】求人応募機能',
    topK: 10,
    useLunrIndex: true,
    labelFilters: {
      includeMeetingNotes: false
    }
  });
  
  console.log('📋 検索結果:\n');
  for (let i = 0; i < Math.min(10, results.length); i++) {
    const result = results[i];
    const pageId = String(getPageIdFromRecord(result) || '');
    const score = (result as any).score ?? (result as any)._compositeScore ?? (result as any)._score;
    
    if (result.title.includes('求人応募機能') || result.title.includes('014_')) {
      console.log(`✅ ${i + 1}. ${result.title}`);
      console.log(`   pageId: ${pageId}, score: ${score !== undefined ? (typeof score === 'number' ? score.toFixed(4) : String(score)) : 'N/A'}`);
    } else {
      console.log(`   ${i + 1}. ${result.title} (pageId: ${pageId})`);
    }
  }
  
  process.exit(0);
}

findPageId();

