import 'dotenv/config';
import { matchNeighborsGRPC } from '../lib/vector-search-grpc';

async function main() {
  const numericProjectId = process.env.VERTEX_AI_NUMERIC_PROJECT_ID || '122015916118';
  const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
  const indexEndpointId = process.env.VERTEX_AI_ENDPOINT_ID || '1939767209815441408';
  const deployedIndexId = process.env.VERTEX_AI_DEPLOYED_INDEX_ID || 'min_test_deployed';
  const publicEndpointDomain = process.env.VERTEX_AI_PUBLIC_ENDPOINT_DOMAIN || '2012456896.asia-northeast1-122015916118.vdb.vertexai.goog';

  // 固定10次元ベクトル（最小構成と一致）
  const vector = [1,0,0,0,0,0,0,0,0,0];

  console.log('gRPC minimal test', { numericProjectId, location, indexEndpointId, deployedIndexId });
  const neighbors = await matchNeighborsGRPC({
    numericProjectId,
    location,
    indexEndpointId,
    deployedIndexId,
    vector,
    neighborCount: 1,
    publicEndpointDomain,
  });
  console.log('Neighbors:', neighbors);
}

main().catch((e) => { console.error('Error:', e?.message || e); process.exit(1); });
