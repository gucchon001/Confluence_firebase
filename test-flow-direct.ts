// フローを直接テストするスクリプト
import { retrieveRelevantDocs } from './src/ai/flows/retrieve-relevant-docs-lancedb';

async function testFlowDirect() {
  try {
    console.log('=== フロー直接テスト ===');
    
    const results = await retrieveRelevantDocs({
      question: 'オファー機能の種類は',
      labelFilters: {
        includeMeetingNotes: false,
        includeArchived: false
      }
    });
    
    console.log('結果数:', results.length);
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title}`);
    });
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

testFlowDirect();
