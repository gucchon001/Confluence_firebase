// オファー機能検索のデバッグ（ファイル出力版）
import { askQuestion } from './src/app/actions';
import * as fs from 'fs';

// ログをファイルに出力
const logStream = fs.createWriteStream('offer-debug.log');

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

async function testOfferSearch() {
  try {
    console.log('=== オファー機能検索テスト開始 ===');
    console.log('時刻:', new Date().toISOString());
    
    const result = await askQuestion('オファー機能の種類は', [], {
      includeMeetingNotes: false,
      includeArchived: false
    });
    
    console.log('\n=== 最終結果 ===');
    console.log('- Answer:', result.answer);
    console.log('- References count:', result.references.length);
    console.log('- References:');
    result.references.forEach((ref, index) => {
      console.log(`  ${index + 1}. ${ref.title} (${ref.score}%)`);
    });
    
    console.log('\n=== テスト完了 ===');
    
  } catch (error) {
    console.error('エラー:', error);
    console.error('スタック:', error.stack);
  } finally {
    logStream.end();
  }
}

testOfferSearch();
