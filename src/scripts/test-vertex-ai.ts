import { ai } from '../ai/genkit';

async function testVertexAI() {
  try {
    console.log('Testing Gemini text generation...');
    const gen = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      prompt: 'Say hello in Japanese in 3 words.',
    });
    console.log('Generation output:', gen.text);

    console.log('\nTesting Embedding...');
    const emb = await ai.embed({
      embedder: 'googleai/text-embedding-004',
      content: 'Confluence specification document search bot',
    });
    type EmbeddingResult = { embedding: number[]; metadata?: Record<string, unknown> };
    const results = (Array.isArray(emb) ? emb : [emb]) as EmbeddingResult[];
    const dims = results[0].embedding.length;
    console.log('Embedding length:', dims);

    console.log('\nVertex AI connectivity OK');
  } catch (e) {
    console.error('Vertex AI test failed:', e);
  }
}

testVertexAI();


