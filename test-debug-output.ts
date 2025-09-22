// デバッグ出力確認用スクリプト
import { askQuestion } from './src/app/actions';

async function testDebugOutput() {
  try {
    console.log('=== デバッグ出力確認テスト ===');
    
    const result = await askQuestion('オファー機能の種類は', [], {
      includeMeetingNotes: false,
      includeArchived: false
    });
    
    console.log('\n=== 最終結果 ===');
    console.log('Answer:', result.answer);
    console.log('References count:', result.references.length);
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

testDebugOutput();
