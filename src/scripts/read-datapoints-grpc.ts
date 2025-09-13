import 'dotenv/config';
import {v1 as aiplatform} from '@google-cloud/aiplatform';

async function main() {
  const numericProjectId = process.env.VERTEX_AI_NUMERIC_PROJECT_ID || '122015916118';
  const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
  const indexId = process.env.VERTEX_AI_INDEX_ID || '7360896096425476096425476096'.slice(0, 19); // fallback safety
  const ids = (process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['probe-min-1-0']);

  const apiEndpoint = `${location}-aiplatform.googleapis.com`;
  const indexName = `projects/${numericProjectId}/locations/${location}/indexes/${process.env.VERTEX_AI_INDEX_ID || '7360896096425476096'}`;

  const indexClient = new aiplatform.IndexServiceClient({ apiEndpoint });

  console.log('Reading datapoints (gRPC):', { indexName, ids });
  const [resp] = await indexClient.readIndexDatapoints({ index: indexName, ids });
  console.log(JSON.stringify(resp, null, 2));
}

main().catch((e) => { console.error('Error:', e?.message || e); process.exit(1); });


