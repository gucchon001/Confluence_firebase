// 検索処理の直接テスト
import { retrieveRelevantDocs } from './src/ai/flows/retrieve-relevant-docs-lancedb';
import * as fs from 'fs';

// ログをファイルに出力
const logStream = fs.createWriteStream('search-direct-debug.log');

const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
  const message = args.join(' ') + '\n';
  logStream.write(message);
  originalLog(...args);
};

console.error = (...args) => {
  const message = args.join(' ') + '\n';
  logStream.write('ERROR: ' + message);
  originalError(...args);
};

async function testSearchDirect() {
  try {
    console.log('=== 検索処理直接テスト開始 ===');
    console.log('時刻:', new Date().toISOString());
    
    const results = await retrieveRelevantDocs({
      question: 'オファー機能の種類は',
      labelFilters: {
        includeMeetingNotes: false,
        includeArchived: false
      }
    });
    
    console.log('\n=== 検索結果 ===');
    console.log('- 結果数:', results.length);
    console.log('- 結果詳細:');
    results.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title} (スコア: ${result.score})`);
      console.log(`     ラベル: ${JSON.stringify(result.labels)}`);
    });
    
    console.log('\n=== テスト完了 ===');
    
  } catch (error) {
    console.error('エラー:', error);
    console.error('スタック:', error.stack);
  } finally {
    logStream.end();
  }
}

testSearchDirect();
