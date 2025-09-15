import 'dotenv/config';
import axios from 'axios';
import { GoogleAuth } from 'google-auth-library';

async function main() {
  const filename = process.argv[2];
  const bucket = process.env.VERTEX_AI_STORAGE_BUCKET || '122015916118-vector-search';
  const numericProjectId = process.env.VERTEX_AI_NUMERIC_PROJECT_ID || '122015916118';
  const indexId = process.env.VERTEX_AI_INDEX_ID || '7360896096425476096';
  const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';

  if (!filename) {
    console.error('Usage: npm run upload:vector-search:import -- <filename>');
    process.exit(1);
  }

  const gcsUri = `gs://${bucket}/${filename}`;
  const importUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${numericProjectId}/locations/${location}/indexes/${indexId}:import`;

  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token || !token.token) throw new Error('no access token');

  const body = {
    inputConfig: {
      gcsSource: { uris: [gcsUri] }
    }
  };

  console.log('Starting :import', { importUrl, gcsUri });
  const resp = await axios.post(importUrl, body, {
    headers: { Authorization: `Bearer ${token.token}`, 'Content-Type': 'application/json' }
  });
  const opName = resp.data.name;
  console.log('Operation:', opName);

  // simple poll
  const opUrl = `https://${location}-aiplatform.googleapis.com/v1/${opName}`;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const r = await axios.get(opUrl, { headers: { Authorization: `Bearer ${token.token}` } });
    if (r.data.done) {
      console.log('Done:', JSON.stringify(r.data, null, 2));
      if (r.data.error) process.exit(2);
      break;
    }
    await new Promise(res => setTimeout(res, 5000));
  }
}

main().catch(e => { console.error('Import failed:', e?.message || e); process.exit(1); });


