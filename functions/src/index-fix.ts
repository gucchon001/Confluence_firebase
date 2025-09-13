// 修正版 - APIリクエスト形式の修正

import axios from 'axios';

// EmbeddingRecordの型定義
interface EmbeddingRecord {
  pageId: string;
  chunkIndex: number;
  embedding: number[];
  title: string;
  url: string;
  content: string;
}

// 既存の関数内の一部を修正
// uploadToVectorSearchV3関数内の修正部分

async function uploadToVectorSearchV3(records: EmbeddingRecord[], projectId: string, location: string, indexId: string): Promise<number> {
  try {
    console.log(`[ingest-v3] Uploading ${records.length} records to Vector Search`);
    
    // Google Cloud認証
    const { GoogleAuth } = require('google-auth-library');
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    const accessToken = token.token;
    
    // インデックスの完全名
    const indexName = `projects/${projectId}/locations/${location}/indexes/${indexId}`;
    console.log(`[ingest-v3] Using index: ${indexName}`);
    
    // REST APIのエンドポイント
    const apiEndpoint = `https://${location}-aiplatform.googleapis.com/v1/${indexName}:upsertDatapoints`;
    console.log(`[ingest-v3] Using endpoint: ${apiEndpoint}`);
    
    // データポイントの準備
    const datapoints = records.map((record) => {
      // Vector Search APIの仕様に合わせた最小限のデータ形式
      return {
        id: `${record.pageId}-${record.chunkIndex}`, // 最新のドキュメントに合わせてidを使用
        embedding: record.embedding.map(Number), // 最新のドキュメントに合わせて単純な配列を使用
        restricts: [ // 検索制限用のメタデータ
          {
            namespace: "content_type",
            allow: ["confluence_page"] // allowを使用
          }
        ],
        crowding_tag: record.pageId, // 同じページからの結果を多様化するためのタグ
        metadata: { // メタデータを単一のオブジェクトとして指定
          title: record.title,
          url: record.url,
          content: record.content
        }
      };
    });
    
    // デバッグ用：最初のデータポイントの内容をログに出力
    if (datapoints.length > 0) {
      console.log('[ingest-v3] First datapoint sample:', JSON.stringify(datapoints[0], null, 2));
    }
    
    // バッチサイズを小さくして処理を安定化
    const BATCH_SIZE = 10; // 50から10に減らす
    const batches = [];
    
    for (let i = 0; i < datapoints.length; i += BATCH_SIZE) {
      batches.push(datapoints.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`[ingest-v3] Uploading in ${batches.length} batches`);
    
    // デバッグモードを無効化（常に全バッチをアップロード）
    const isDebugMode = false; // 明示的にfalseに設定
    const maxBatches = batches.length; // 常に全バッチを処理
    
    console.log(`[ingest-v3] Processing all ${batches.length} batches`);
    
    // バッチごとにアップロード
    for (let i = 0; i < maxBatches; i++) {
      const batch = batches[i];
      console.log(`[ingest-v3] Uploading batch ${i + 1}/${maxBatches} (${batch.length} records)`);
      
      try {
        // デバッグ用：リクエストの内容を表示
        console.log(`[ingest-v3] Request payload for batch ${i + 1}:`, JSON.stringify({ datapoints: batch }, null, 2));
        
        // REST APIリクエスト
        const response = await axios.post(
          apiEndpoint,
          { datapoints: batch },
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        console.log(`[ingest-v3] Batch ${i + 1} upload complete: Status ${response.status}`);
        
        // レート制限を考慮して少し待機
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (batchErr: any) {
        console.error(`[ingest-v3] Error uploading batch ${i + 1}:`, batchErr.message);
        
        // エラーの詳細を完全に表示
        if (batchErr.response) {
          console.error('[ingest-v3] Error status:', batchErr.response.status);
          console.error('[ingest-v3] Error headers:', JSON.stringify(batchErr.response.headers, null, 2));
          
          if (batchErr.response.data) {
            console.error('[ingest-v3] Raw error data:', batchErr.response.data);
            console.error('[ingest-v3] Error details:', JSON.stringify(batchErr.response.data, null, 2));
            
            // Google APIのエラー形式に対応
            if (batchErr.response.data.error) {
              console.error('[ingest-v3] Error code:', batchErr.response.data.error.code);
              console.error('[ingest-v3] Error message:', batchErr.response.data.error.message);
              console.error('[ingest-v3] Error status:', batchErr.response.data.error.status);
              if (batchErr.response.data.error.details) {
                console.error('[ingest-v3] Error details:', JSON.stringify(batchErr.response.data.error.details, null, 2));
              }
            }
          }
        }
        
        // 最初のバッチでエラーが発生した場合は中断
        if (i === 0) throw batchErr;
        
        // それ以外の場合は続行を試みる
        console.log('[ingest-v3] Continuing with next batch...');
        
        // エラー後は少し長めに待機
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log(`[ingest-v3] Vector Search upload complete: ${records.length} records processed`);
    return records.length;
  } catch (err: any) {
    console.error('[ingest-v3] Vector Search upload error:', err);
    
    if (err.response) {
      console.error('[ingest-v3] Error status:', err.response.status);
      console.error('[ingest-v3] Error headers:', JSON.stringify(err.response.headers, null, 2));
      if (err.response.data) {
        console.error('[ingest-v3] Error data full details:', JSON.stringify(err.response.data, null, 2));
      }
    } else if (err.request) {
      console.error('[ingest-v3] No response received');
    } else {
      console.error('[ingest-v3] Error message:', err.message);
    }
    
    throw err;
  }
}
