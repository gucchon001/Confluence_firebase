import 'dotenv/config';
import { Storage } from '@google-cloud/storage';
import { ChromaClient, OpenAIEmbeddingFunction } from 'chromadb';

async function loadMiniBatch(gsUri: string) {
  const [, , bucket, ...rest] = gsUri.split('/');
  const filePath = rest.join('/');
  const storage = new Storage();
  const [buf] = await storage.bucket(bucket).file(filePath).download();
  const records = JSON.parse(buf.toString('utf8')) as Array<{ id: string; embedding: number[] }>; 
  return records;
}

async function main() {
  const miniGs = process.argv[2];
  if (!miniGs?.startsWith('gs://')) {
    console.error('Usage: tsx src/scripts/chroma-mini-batch-verify.ts gs://bucket/path/mini-batch-*/data.json');
    process.exit(1);
  }
  const records = await loadMiniBatch(miniGs);
  const ids = records.map(r => r.id);
  const embeddings = records.map(r => r.embedding);

  const client = new ChromaClient(); // in-process (default .chromadb dir)
  const collection = await client.getOrCreateCollection({ name: 'confluence-test' });

  await collection.upsert({ ids, embeddings });

  // verify top-1 self match for first 10 ids
  for (let i = 0; i < Math.min(10, records.length); i += 1) {
    const emb = embeddings[i];
    const q = await collection.query({ queryEmbeddings: [emb], nResults: 1 });
    const topId = q.ids?.[0]?.[0];
    console.log(`${ids[i]} -> top: ${topId} ${topId === ids[i] ? 'OK' : 'NG'}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });


