import 'dotenv/config';
import { retrieveRelevantDocs } from '../ai/flows/retrieve-relevant-docs';
import { summarizeConfluenceDocs } from '../ai/flows/summarize-confluence-docs';

async function testRagFlow() {
  try {
    console.log('Testing RAG Flow...');
    
    // テスト用の質問
    const testQuestions = [
      '求人詳細画面の仕様について教えてください',
      'ログイン認証の仕組みはどうなっていますか？',
      '存在しない仕様についての質問'
    ];
    
    for (const question of testQuestions) {
      console.log(`\n--- Testing question: "${question}" ---`);
      
      // 1. 関連ドキュメントの検索
      console.log('Step 1: Retrieving relevant documents...');
      console.log(`[retrieveRelevantDocs] Searching for question: ${question}`);
      try {
        const relevantDocs = await retrieveRelevantDocs({ question });
        console.log(`Found ${relevantDocs.length} relevant documents`);
        if (relevantDocs.length > 0) {
          console.log('First document:', {
            title: relevantDocs[0].title,
            content: relevantDocs[0].content.substring(0, 100) + '...',
            distance: relevantDocs[0].distance
          });
        }
      } catch (error) {
        console.error(`Error retrieving documents: ${error.message}`);
        continue;
      }
      
      // 2. 要約の生成
      console.log('Step 2: Generating summary...');
      let response;
      try {
        const relevantDocs = await retrieveRelevantDocs({ question });
        if (relevantDocs.length === 0) {
          console.log('No relevant documents found, skipping summary generation');
          response = { summary: '関連するドキュメントが見つかりませんでした。', sources: [] };
        } else {
          response = await summarizeConfluenceDocs({ question, context: relevantDocs });
        }
      } catch (error) {
        console.error(`Error generating summary: ${error.message}`);
        response = { summary: 'エラーが発生しました。', sources: [] };
      }
      
      // 3. 結果の表示
      console.log('\nRAG Flow Result:');
      console.log('Summary:', response.summary);
      console.log('Sources:');
      response.sources.forEach((source, i) => {
        console.log(`  ${i + 1}. ${source.title} (${source.url})`);
      });
    }
    
    console.log('\nRAG Flow test completed successfully');
    
  } catch (error) {
    console.error('RAG Flow test failed:', error);
  }
}

testRagFlow();
