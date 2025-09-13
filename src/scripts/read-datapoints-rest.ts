import 'dotenv/config';
import axios from 'axios';
import { GoogleAuth } from 'google-auth-library';

async function main() {
  const numericProjectId = process.env.VERTEX_AI_NUMERIC_PROJECT_ID || '122015916118';
  const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
  const indexId = process.env.VERTEX_AI_INDEX_ID || '7360896096425476096';
  const ids = process.argv.slice(2);
  if (ids.length === 0) {
    console.error('Usage: npm run read:datapoints:rest -- <id1> <id2> ...');
    process.exit(1);
  }

  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${numericProjectId}/locations/${location}/indexes/${indexId}:readIndexDatapoints`;

  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token || !token.token) throw new Error('Failed to get access token');

  console.log('POST', url, 'ids=', ids);
  const resp = await axios.post(url, { ids }, {
    headers: {
      Authorization: `Bearer ${token.token}`,
      'Content-Type': 'application/json'
    }
  });

  console.log(JSON.stringify(resp.data, null, 2));
}

main().catch((e) => { console.error('Error:', e?.response?.data || e?.message || e); process.exit(1); });


