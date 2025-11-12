/**
 * タイトルからpageIdを検索するスクリプト
 */

// 環境変数を読み込み
import * as dotenv from 'dotenv';
dotenv.config();

import { searchLanceDB } from '../src/lib/lancedb-search-client';
import { getPageIdFromRecord } from '../src/lib/pageid-migration-helper';

const titles = [
  '168_【FIX】教室コピー機能',
  '515_【作成中】教室管理-教室コピー機能',
  '014_【FIX】求人応募機能',
  '721_【作成中】学年自動更新バッチ',
  '505_【FIX】教室削除 機能',
  '164__【FIX】教室削除機能',
  '045_【FIX】パスワード再設定機能'
];

async function findPageIds() {
  console.log('🔍 タイトルからpageIdを検索中...\n');
  
  for (const title of titles) {
    try {
      const results = await searchLanceDB({
        query: title,
        topK: 5,
        useLunrIndex: true,
        labelFilters: {
          includeMeetingNotes: false
        }
      });
      
      console.log(`\n📋 タイトル: "${title}"`);
      for (let i = 0; i < Math.min(3, results.length); i++) {
        const result = results[i];
        const pageId = String(getPageIdFromRecord(result) || '');
        const score = (result as any).score ?? (result as any)._compositeScore ?? (result as any)._score;
        
        if (result.title === title || result.title.includes(title.split('_')[0])) {
          console.log(`   ✅ 一致: pageId=${pageId}, title="${result.title}", score=${score !== undefined ? (typeof score === 'number' ? score.toFixed(4) : String(score)) : 'N/A'}`);
        } else {
          console.log(`   ⚠️  類似: pageId=${pageId}, title="${result.title}", score=${score !== undefined ? (typeof score === 'number' ? score.toFixed(4) : String(score)) : 'N/A'}`);
        }
      }
    } catch (error: any) {
      console.error(`   ❌ エラー: ${error.message}`);
    }
  }
  
  process.exit(0);
}

findPageIds();

