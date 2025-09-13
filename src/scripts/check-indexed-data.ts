import axios from 'axios';
import { execSync } from 'child_process';
import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

// .env.localを読み込む
dotenv.config({ path: './.env.local' });

// --- 環境変数チェック ---
const {
  VERTEX_AI_PUBLIC_ENDPOINT_DOMAIN,
  VERTEX_AI_DEPLOYED_INDEX_ID,
  VERTEX_AI_NUMERIC_PROJECT_ID,
  VERTEX_AI_LOCATION,
  VERTEX_AI_ENDPOINT_ID,
  VERTEX_AI_INDEX_ID, // インデックスIDも必要
} = process.env;

if (!VERTEX_AI_PUBLIC_ENDPOINT_DOMAIN || !VERTEX_AI_DEPLOYED_INDEX_ID || !VERTEX_AI_NUMERIC_PROJECT_ID || !VERTEX_AI_LOCATION || !VERTEX_AI_ENDPOINT_ID || !VERTEX_AI_INDEX_ID) {
  console.error('必要な環境変数が設定されていません。./.env.local を確認してください。');
  process.exit(1);
}

// --- Firebase Adminの初期化 ---
const serviceAccount = require('../../keys/firebase-adminsdk-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// --- 認証トークン取得 ---
const getToken = () => {
  try {
    return execSync('gcloud auth print-access-token').toString().trim();
  } catch (error) {
    console.error('gcloudから認証トークンを取得できませんでした。');
    process.exit(1);
  }
};

/**
 * Vector Searchから指定されたIDのデータを読み出す
 * @param datapointIds 読み出すデータのID配列
 */
async function getVectorsFromIndex(datapointIds: string[]) {
  const token = getToken();
  const url = `https://${VERTEX_AI_LOCATION}-aiplatform.googleapis.com/v1beta1/projects/${VERTEX_AI_NUMERIC_PROJECT_ID}/locations/${VERTEX_AI_LOCATION}/indexes/${VERTEX_AI_INDEX_ID}:readIndexDatapoints`;

  const requestBody = {
    ids: datapointIds,
    // readIndexDatapoints では deployed_index_id は不要
  };

  try {
    console.log(`\n--- Vector Search Indexからデータを取得中 (${datapointIds.length}件) ---`);
    const response = await axios.post(url, requestBody, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('Vector Searchからのデータ取得成功。');
    return response.data.datapoints as any[];
  } catch (error: any) {
    console.error('Vector Searchからのデータ取得中にエラーが発生しました:');
    if (error.response) {
      console.error(`ステータスコード: ${error.response.status}`);
      console.error('レスポンスデータ:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    return [];
  }
}

/**
 * Firestoreから指定されたIDのチャンクデータを取得する
 * @param chunkIds 取得するチャンクのID配列
 */
async function getContentFromFirestore(chunkIds: string[]) {
  try {
    console.log(`\n--- Firestoreからコンテンツを取得中 (${chunkIds.length}件) ---`);
    const chunkDataMap = new Map<string, any>();
    for (const chunkId of chunkIds) {
      const chunkDoc = await db.collection('chunks').doc(chunkId).get();
      if (chunkDoc.exists) {
        chunkDataMap.set(chunkId, chunkDoc.data());
      } else {
        chunkDataMap.set(chunkId, { content: 'Not Found in Firestore' });
      }
    }
    console.log('Firestoreからのコンテンツ取得成功。');
    return chunkDataMap;
  } catch (error) {
    console.error('Firestoreからのデータ取得中にエラーが発生しました:', error);
    return new Map();
  }
}

/**
 * メイン関数
 */
async function main() {
  const datapointIds = process.argv.slice(2);
  if (datapointIds.length === 0) {
    console.log('調査対象のデータポイントIDをコマンドライン引数として1つ以上指定してください。');
    console.log('例: npx tsx src/scripts/check-indexed-data.ts 704053518-6 704446760-6');
    process.exit(0);
  }

  const [vectors, contents] = await Promise.all([
    getVectorsFromIndex(datapointIds),
    getContentFromFirestore(datapointIds)
  ]);

  console.log('\n\n--- 調査結果 ---');
  if (vectors.length === 0) {
    console.log('Vector Searchからデータを取得できませんでした。');
  }

  for (const vectorData of vectors) {
    const id = vectorData.datapointId;
    const contentData = contents.get(id);

    console.log(`\n------------------------------`);
    console.log(`ID: ${id}`);
    console.log(`------------------------------`);
    console.log(`■ Firestore Content:`);
    console.log(`  Title: ${contentData?.title}`);
    console.log(`  Content: "${(contentData?.content || '').substring(0, 150)}..."`);
    console.log(`\n■ Indexed Vector (先頭5次元):`);
    console.log(`  ${JSON.stringify(vectorData.featureVector.slice(0, 5))}`);
    const norm = Math.sqrt(vectorData.featureVector.reduce((s: number, v: number) => s + v * v, 0));
    console.log(`  L2 Norm: ${norm}`);
    console.log(`------------------------------`);
  }
  
  // 終了処理
  process.exit(0);
}

main().catch(error => {
  console.error("スクリプトの実行に失敗しました:", error);
  process.exit(1);
});
