import 'dotenv/config';
import axios from 'axios';
import { GoogleAuth } from 'google-auth-library';

async function main() {
  const publicEndpoint = process.env.VERTEX_AI_PUBLIC_ENDPOINT_DOMAIN || '2012456896.asia-northeast1-122015916118.vdb.vertexai.goog';
  const numericProjectId = process.env.VERTEX_AI_NUMERIC_PROJECT_ID || '122015916118';
  const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
  const indexEndpointId = process.env.VERTEX_AI_ENDPOINT_ID || '1939767209815441408';
  const deployedIndexId = process.env.VERTEX_AI_DEPLOYED_INDEX_ID || 'min_test_deployed';

  // 同一ベクトル（10次元）
  const vector = [1,0,0,0,0,0,0,0,0,0];

  const url = `https://${publicEndpoint}/v1/projects/${numericProjectId}/locations/${location}/indexEndpoints/${indexEndpointId}:predict`;

  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token || !token.token) throw new Error('Failed to get access token');

  const body = {
    instances: [
      {
        neighborCount: 1,
        datapoint: {
          featureVector: vector
        }
      }
    ],
    parameters: {
      deployedIndexId
    }
  };

  console.log('POST', url);
  const resp = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${token.token}`,
      'Content-Type': 'application/json'
    },
    validateStatus: () => true
  });
  console.log('Status:', resp.status);
  console.log(JSON.stringify(resp.data, null, 2));
}

main().catch((e) => { console.error('Error:', e?.response?.data || e?.message || e); process.exit(1); });