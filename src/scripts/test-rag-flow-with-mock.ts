import 'dotenv/config';
import { retrieveRelevantDocs } from '../ai/flows/retrieve-relevant-docs';
import { summarizeConfluenceDocs } from '../ai/flows/summarize-confluence-docs';

/**
 * テスト環境を有効にする
 */
process.env.NODE_ENV = 'test';

async function testRagFlowWithMock() {
  try {
    console.log('Testing RAG Flow with mock data...');
    
    // テスト用の質問
    const testQuestions = [
      '教室登録の仕様について教えてください',
      'ログイン認証の仕組みはどうなっていますか？',
      '存在しない仕様についての質問'
    ];
    
    for (const question of testQuestions) {
      console.log(`\n--- Testing question: "${question}" ---`);
      
      // 1. 関連ドキュメントの検索
      console.log('Step 1: Retrieving relevant documents...');
      try {
        const relevantDocs = await retrieveRelevantDocs({ question });
        console.log(`Found ${relevantDocs.length} relevant documents`);
        
        if (relevantDocs.length > 0) {
          console.log('Documents found:');
          relevantDocs.forEach((doc, index) => {
            console.log(`  ${index + 1}. ${doc.title}`);
            console.log(`     Content: ${doc.content.substring(0, 50)}...`);
          });
          
          // 2. 要約の生成
          console.log('\nStep 2: Generating summary...');
          try {
            const response = await summarizeConfluenceDocs({ question, context: relevantDocs });
            
            // 3. 結果の表示
            console.log('\nRAG Flow Result:');
            console.log(`Question: ${question}`);
            console.log(`Answer: ${response.answer}`);
            console.log('Sources:');
            response.sources.forEach((source, i) => {
              console.log(`  ${i + 1}. ${source.title} (${source.url})`);
            });
          } catch (summaryError) {
            console.error(`Error generating summary: ${summaryError.message}`);
          }
        } else {
          console.log('No relevant documents found for this query.');
        }
      } catch (retrievalError) {
        console.error(`Error retrieving documents: ${retrievalError.message}`);
      }
    }
    
    console.log('\nRAG Flow test with mock data completed successfully');
    
  } catch (error) {
    console.error('RAG Flow test failed:', error);
  }
}

testRagFlowWithMock();
