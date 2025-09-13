import 'dotenv/config';
import axios from 'axios';
import { GoogleAuth } from 'google-auth-library';

const project = process.env.VERTEX_AI_PROJECT_ID as string;
const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
const MODEL_ID = 'text-embedding-004';

function ensureEnv(name: string, value?: string) {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  ensureEnv('VERTEX_AI_PROJECT_ID', project);

  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${MODEL_ID}:predict`;

  const instances = texts.map(text => ({ content: text }));
  const requestBody = { instances };

  const resp = await axios.post(endpoint, requestBody, {
    headers: {
      Authorization: `Bearer ${token.token || token}`,
      'Content-Type': 'application/json'
    }
  });

  const predictions = resp.data?.predictions || [];
  const vectors: number[][] = predictions.map((p: any) => {
    // Newer schema: predictions[0].embeddings.values
    const values = p.embeddings?.values || p.embedding?.values || [];
    return values.map((v: any) => Number(v));
  });
  return vectors;
}
