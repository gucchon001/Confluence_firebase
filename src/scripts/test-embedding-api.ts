import 'dotenv/config';
import { getEmbeddings } from '../lib/vertex-ai-helper';

async function testEmbeddingApi() {
  console.log('Testing Vertex AI Embedding API...');
  
  try {
    const testTexts = ['これはテストです'];
    console.log(`Sending text to API: "${testTexts[0]}"`);
    
    const embeddings = await getEmbeddings(testTexts);
    
    if (embeddings && embeddings.length > 0 && embeddings[0].length > 0) {
      console.log('Successfully received embeddings!');
      console.log('Embedding vector (first 5 dimensions):', embeddings[0].slice(0, 5));
      console.log('Total dimensions:', embeddings[0].length);
    } else {
      console.error('Failed to get embeddings. The response was empty or invalid.');
    }
    
  } catch (error) {
    console.error('An error occurred during the API call:');
    console.error(error);
  }
}

testEmbeddingApi();
