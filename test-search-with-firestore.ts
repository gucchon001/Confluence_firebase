import axios from 'axios';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as admin from 'firebase-admin';
import { ai } from './src/ai/genkit'; // Genkitインスタンスをインポート
import dotenv from 'dotenv';

// .env.localを読み込む
dotenv.config({ path: '.env.local' });

// 環境変数から設定を取得
const VERTEX_AI_PUBLIC_ENDPOINT_DOMAIN = process.env.VERTEX_AI_PUBLIC_ENDPOINT_DOMAIN;
const VERTEX_AI_DEPLOYED_INDEX_ID = process.env.VERTEX_AI_DEPLOYED_INDEX_ID;
const VERTEX_AI_NUMERIC_PROJECT_ID = process.env.VERTEX_AI_NUMERIC_PROJECT_ID;
const VERTEX_AI_LOCATION = process.env.VERTEX_AI_LOCATION;
const VERTEX_AI_ENDPOINT_ID = process.env.VERTEX_AI_ENDPOINT_ID;
const FIREBASE_PROJECT_ID = 'confluence-copilot-ppjye';

// Firebase Adminの初期化
const serviceAccount = require('./keys/firebase-adminsdk-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// 認証トークンを取得
const getToken = () => {
  try {
    const token = execSync('gcloud auth print-access-token').toString().trim();
    return token;
  } catch (error) {
    console.error('gcloudから認証トークンを取得できませんでした。');
    process.exit(1);
  }
};

// テキストをベクトル化する関数 - Genkitを使用
const getEmbedding = async (text: string, normalize: boolean = true): Promise<number[]> => {
  try {
    console.log('Genkitを使用してテキストをベクトル化しています...');
    const embeddingResponse = await ai.embed({
      embedder: 'googleai/text-embedding-004',
      content: text,
    });

    // Genkit v1.19+ は [{ embedding: [...] }] という形式で返す
    if (Array.isArray(embeddingResponse) && embeddingResponse.length > 0 && embeddingResponse[0].embedding) {
      const vector = embeddingResponse[0].embedding;
      
      if (normalize) {
        // DOT_PRODUCT_DISTANCE 対応のため、L2正規化
        const l2 = Math.sqrt(vector.reduce((s: number, v: number) => s + v * v, 0)) || 1;
        const normalizedVector = vector.map((v: number) => v / l2);
        console.log(`埋め込みベクトルをL2正規化しました。次元数: ${normalizedVector.length}`);
        return normalizedVector;
      }
      
      console.log(`埋め込みベクトルの次元数: ${vector.length}`);
      return vector;
    }
    
    // フォールバックや古い形式のチェック
    if (Array.isArray(embeddingResponse) && typeof embeddingResponse[0] === 'number') {
        const vector = embeddingResponse as number[];
        if (normalize) {
            const l2 = Math.sqrt(vector.reduce((s, v) => s + v * v, 0)) || 1;
            const normalizedVector = vector.map((v: number) => v / l2);
            console.log(`埋め込みベクトルをL2正規化しました。次元数: ${normalizedVector.length}`);
            return normalizedVector;
        }
        console.log(`埋め込みベクトルの次元数: ${vector.length}`);
        return vector;
    }

    throw new Error('Genkitから予期しない埋め込み形式が返されました。');
  } catch (error) {
    console.error('Genkitでの埋め込み生成中にエラーが発生しました:', error);
    process.exit(1);
  }
};

// Firestoreからチャンクデータを取得する関数
const getChunkDataFromFirestore = async (chunkIds) => {
  try {
    console.log('Firestoreからチャンクデータを取得しています...');
    
    const chunkData = [];
    for (const chunkId of chunkIds) {
      // チャンクIDからページIDとチャンクインデックスを抽出
      const [pageId, chunkIndex] = chunkId.split('-');
      
      // chunksコレクションからデータを取得
      const chunkDoc = await db.collection('chunks').doc(chunkId).get();
      
      if (chunkDoc.exists) {
        const chunk = chunkDoc.data();
        chunkData.push({
          id: chunkId,
          title: chunk.title || '不明なタイトル',
          content: chunk.content || '内容が見つかりません',
          url: chunk.url || '#',
          spaceName: chunk.spaceName || '不明なスペース',
          lastUpdated: chunk.lastUpdated || '不明な更新日'
        });
      } else {
        chunkData.push({
          id: chunkId,
          title: '不明なチャンク',
          content: '該当するチャンクが見つかりません',
          url: '#',
          spaceName: '不明なスペース',
          lastUpdated: '不明な更新日'
        });
      }
    }
    
    return chunkData;
  } catch (error) {
    console.error('Firestoreからのデータ取得中にエラーが発生しました:', error);
    return chunkIds.map(id => ({
      id: id,
      title: 'エラーが発生しました',
      content: 'データの取得に失敗しました',
      url: '#',
      spaceName: '不明なスペース',
      lastUpdated: '不明な更新日'
    }));
  }
};

// 検索リクエストを実行
const searchWithQuery = async (query: string) => {
  console.log(`クエリ: "${query}"`);
  
  console.log('クエリをベクトル化しています...');
  const queryVector = await getEmbedding(query, false); // ★正規化を無効化
  console.log(`${queryVector.length}次元のベクトルを生成しました。`);
  
  // クエリベクトルのL2ノルムを確認
  const norm = Math.sqrt(queryVector.reduce((s, v) => s + v * v, 0));
  console.log(`クエリベクトルのL2ノルム: ${norm}`);
  
  // 認証トークンを取得
  const token = getToken();
  
  // エンドポイントURLを構築
  const url = `https://${VERTEX_AI_PUBLIC_ENDPOINT_DOMAIN}/v1beta1/projects/${VERTEX_AI_NUMERIC_PROJECT_ID}/locations/${VERTEX_AI_LOCATION}/indexEndpoints/${VERTEX_AI_ENDPOINT_ID}:findNeighbors`;
  
  // リクエストボディを構築
  const requestBody = {
    deployed_index_id: VERTEX_AI_DEPLOYED_INDEX_ID,
    queries: [
      {
        datapoint: {
          datapoint_id: 'user-query',
          feature_vector: queryVector
        },
        neighbor_count: 5
      }
    ]
  };

  console.log('--- クエリベクトル ---');
  console.log(JSON.stringify(queryVector.slice(0, 5))); // ベクトルの先頭5次元だけ表示
  console.log('--------------------');

  console.log('検索リクエストを送信中...');
  
  try {
    // リクエストを送信
    const response = await axios.post(url, requestBody, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    // レスポンスを表示
    console.log('検索成功！');
    
    if (response.data && response.data.nearestNeighbors && response.data.nearestNeighbors[0].neighbors) {
      const neighbors = response.data.nearestNeighbors[0].neighbors;
      console.log(`${neighbors.length}件の類似ドキュメントが見つかりました。`);
      
      // チャンクIDを抽出
      const chunkIds = neighbors.map(n => n.datapoint.datapointId);
      
      // Firestoreからチャンクデータを取得
      const chunkData = await getChunkDataFromFirestore(chunkIds);
      
      // 検索結果の詳細を表示
      console.log('\n--- 検索結果の詳細 ---');
      chunkData.forEach((chunk, index) => {
        const distance = neighbors[index].distance;
        console.log(`\n結果 ${index + 1}:`);
        console.log(`ID: ${chunk.id}`);
        console.log(`タイトル: ${chunk.title}`);
        console.log(`URL: ${chunk.url}`);
        console.log(`スペース: ${chunk.spaceName}`);
        console.log(`最終更新日: ${chunk.lastUpdated}`);
        console.log(`距離: ${distance}`);
        console.log(`内容: ${chunk.content.substring(0, 200)}...`);
      });
      
      // 結果をファイルに保存
      fs.writeFileSync(
        path.join(__dirname, 'search-results-with-content.json'),
        JSON.stringify({
          query,
          results: chunkData.map((chunk, index) => ({
            ...chunk,
            distance: neighbors[index].distance
          }))
        }, null, 2)
      );
      console.log('\n詳細な結果は search-results-with-content.json に保存されました。');
    } else {
      console.log('検索結果が空です。');
    }
  } catch (error) {
    console.error('エラーが発生しました:');
    if (error.response) {
      console.error(`ステータスコード: ${error.response.status}`);
      console.error('レスポンスデータ:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
};

// コマンドライン引数からクエリを取得
const query = process.argv[2] || 'ログイン機能の詳細を教えて';

// 検索を実行
searchWithQuery(query).finally(() => {
  // Firebase接続を終了
  // genkit.shutdown() のような明示的な終了処理がGenkitにあるか確認
  setTimeout(() => process.exit(0), 1000); // 非同期処理が終わるのを待つ
});