// デバッグ出力をファイルに保存するスクリプト
import { askQuestion } from './src/app/actions';
import * as fs from 'fs';

// コンソールログをファイルにリダイレクト
const logStream = fs.createWriteStream('debug-output.log');
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

async function testDebugWithFile() {
  try {
    console.log('=== デバッグ出力確認テスト開始 ===');
    console.log('時刻:', new Date().toISOString());
    
    const result = await askQuestion('オファー機能の種類は', [], {
      includeMeetingNotes: false,
      includeArchived: false
    });
    
    console.log('\n=== 最終結果 ===');
    console.log('Answer:', result.answer);
    console.log('Answer length:', result.answer?.length || 0);
    console.log('References count:', result.references.length);
    
    result.references.forEach((ref, index) => {
      console.log(`Reference ${index + 1}: ${ref.title}`);
    });
    
    console.log('=== テスト完了 ===');
    
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    logStream.end();
  }
}

testDebugWithFile();
