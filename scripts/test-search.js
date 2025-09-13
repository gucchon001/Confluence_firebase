/**
 * 新しいエンドポイントで検索をテストするスクリプト
 */
const axios = require('axios');
const { execSync } = require('child_process');

// 設定を読み込む
const config = require('../config/vector-search-config');

// 認証トークンを取得
const getToken = () => {
  const token = execSync('gcloud auth print-access-token').toString().trim();
  return token;
};

// テスト用のクエリベクトル（768次元、最初の要素のみ1、他は0）
const queryVector = Array(768).fill(0);
queryVector[0] = 1;

// L2正規化
const normalize = (vector) => {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return vector.map(val => val / magnitude);
};

// 正規化されたクエリベクトル
const normalizedQueryVector = normalize(queryVector);

// 検索リクエストを実行
const searchNearestNeighbors = async () => {
  const token = getToken();
  const endpointDomain = config.publicEndpointDomain;
  const deployedIndexId = 'confluence_embeddings_v2_deployed'; // 明示的に指定
  const numericProjectId = config.numericProjectId;
  const location = config.location;
  const indexEndpointId = config.indexEndpointId;
  const apiVersion = config.apiVersion || 'v1beta1';
  
  console.log('設定値:');
  console.log('endpointDomain:', endpointDomain);
  console.log('deployedIndexId:', deployedIndexId);
  console.log('numericProjectId:', numericProjectId);
  console.log('location:', location);
  console.log('indexEndpointId:', indexEndpointId);
  console.log('apiVersion:', apiVersion);
  
  const url = `https://${endpointDomain}/${apiVersion}/projects/${numericProjectId}/locations/${location}/indexEndpoints/${indexEndpointId}:findNeighbors`;
  
  const requestBody = {
    deployed_index_id: deployedIndexId,
    queries: [
      {
        datapoint: {
          datapoint_id: "query-1",
          feature_vector: normalizedQueryVector
        },
        neighbor_count: 10
      }
    ]
  };
  
  console.log('リクエストURL:', url);
  console.log('リクエストボディ:', JSON.stringify(requestBody, null, 2));
  
  try {
    const response = await axios.post(url, requestBody, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('検索結果:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('エラー:', error.response ? error.response.data : error.message);
  }
};

// 検索を実行
searchNearestNeighbors();
