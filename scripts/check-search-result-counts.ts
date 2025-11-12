/**
 * 検索システムの各段階での取得件数を確認するスクリプト
 */

// 環境変数を読み込み
import * as dotenv from 'dotenv';
dotenv.config();

import { searchLanceDB } from '../src/lib/lancedb-search-client';

const testQueries = [
  '教室削除ができる条件は？',
  '退会した会員が同じアドレス使ったらどんな表示がでますか',
  '教室コピー機能でコピー可能な項目は？'
];

async function checkResultCounts() {
  console.log('🔍 検索システムの取得件数確認\n');
  console.log('='.repeat(80));
  
  for (const query of testQueries) {
    console.log(`\n📋 クエリ: "${query}"`);
    console.log('-'.repeat(80));
    
    // ログをキャプチャするために、console.logを一時的にオーバーライド
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: any[]) => {
      const message = args.join(' ');
      logs.push(message);
      originalLog(...args);
    };
    
    try {
      const results = await searchLanceDB({
        query: query,
        topK: 20,
        useLunrIndex: true,
        labelFilters: {
          includeMeetingNotes: false
        }
      });
      
      // ログから件数を抽出
      const vectorCount = extractCount(logs, /Vector.*Found (\d+) results/);
      const bm25Count = extractCount(logs, /BM25.*Found (\d+) results/);
      const bm25Total = extractCount(logs, /BM25 Search.*Total unique results: (\d+)/);
      const titleCandidates = extractCount(logs, /Exact title candidates \((\d+)/);
      const vectorAfterKG = extractCount(logs, /Vector search results after KG: (\d+)/);
      const mergedBM25 = extractCount(logs, /Merging (\d+) BM25 results/);
      const rrfCount = extractCount(logs, /Applied RRF fusion to (\d+) results/);
      const compositeScored = extractCount(logs, /Detailed scoring: (\d+) results/);
      const finalCount = results.length;
      
      console.log = originalLog; // 元に戻す
      
      console.log(`\n📊 取得件数の内訳:`);
      console.log(`  1. ベクトル検索: ${vectorCount || 'N/A'}件`);
      console.log(`  2. BM25検索（各キーワード）: ${bm25Count || 'N/A'}件/キーワード`);
      console.log(`  3. BM25検索（合計）: ${bm25Total || 'N/A'}件`);
      console.log(`  4. タイトル候補数: ${titleCandidates || 'N/A'}件`);
      console.log(`  5. KG拡張後のベクトル: ${vectorAfterKG || 'N/A'}件`);
      console.log(`  6. BM25マージ後: ${mergedBM25 || 'N/A'}件`);
      console.log(`  7. RRF統合後: ${rrfCount || 'N/A'}件`);
      console.log(`  8. Composite Scoring対象: ${compositeScored || 'N/A'}件`);
      console.log(`  9. 最終返却件数: ${finalCount}件`);
      
    } catch (error: any) {
      console.log = originalLog; // 元に戻す
      console.error(`   ❌ エラー: ${error.message}`);
    }
  }
  
  // コード内の定数を確認
  console.log('\n' + '='.repeat(80));
  console.log('\n📋 コード内の取得件数設定:');
  console.log('  ベクトル検索: topK * 30 (例: topK=20 → 600件)');
  console.log('  BM25検索: 各キーワード最大100件');
  console.log('  タイトル検索: 候補ごとに最大20件、最大10候補');
  console.log('  Composite Scoring: 上位100件');
  console.log('  最終返却: topK * 3 (例: topK=20 → 60件)');
  
  process.exit(0);
}

function extractCount(logs: string[], pattern: RegExp): number | null {
  for (const log of logs) {
    const match = log.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  return null;
}

checkResultCounts().catch(console.error);

