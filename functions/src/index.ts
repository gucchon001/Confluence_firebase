import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { GoogleAuth } from 'google-auth-library';
// 以下のインポートは一時的にコメントアウト
// import { testVectorSearchUploadV3 } from './minimal-test-v3';
// import { testVectorSearchUploadV4 } from './minimal-test-v4';
// バッチ更新に必要なライブラリをインポート
import { Storage } from '@google-cloud/storage';
import { IndexServiceClient } from '@google-cloud/aiplatform/build/src/v1';

// Firebase初期化
admin.initializeApp();

// 環境変数の確認
function assertEnv(name: string): string {
  // Firebase環境変数から取得を試みる
  const config = functions.config();
  console.log(`[env] Looking for ${name} in Firebase config`);
  
  // 環境変数名をFirebase configのパスに変換
  // 例: VERTEX_AI_PROJECT_ID → config.vertexai.project_id
  const parts = name.toLowerCase().split('_');
  if (parts.length >= 2) {
    const section = parts[0];
    const key = parts.slice(1).join('_');
    console.log(`[env] Checking config.${section}.${key}`);
    
    if (config[section] && config[section][key]) {
      console.log(`[env] Found ${name} in Firebase config: ${config[section][key]}`);
      return config[section][key];
    }
  }
  
  // Firebase configになければ、通常の環境変数から取得
  const value = process.env[name];
  if (!value) {
    console.log(`[env] Environment variable ${name} not found in Firebase config or process.env`);
    throw new Error(`環境変数 ${name} が設定されていません。`);
  }
  console.log(`[env] Found ${name} in process.env`);
  return value;
}

// HTMLタグの除去
function stripHtml(html: string): string {
  const decoded = html
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  return decoded
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// テキストをチャンクに分割
function chunkText(text: string, maxChunkSize: number = 1000): string[] {
  if (!text) return [];
  if (text.length <= maxChunkSize) return [text];
  
  const chunks = [];
  let start = 0;
  let end = maxChunkSize;
  
  while (start < text.length) {
    // チャンクの終わりを文の終わりに調整
    if (end < text.length) {
      const lastPeriod = text.substring(start, end).lastIndexOf('。');
      if (lastPeriod !== -1) {
        end = start + lastPeriod + 1;
      }
    }
    
    chunks.push(text.substring(start, end));
    start = end;
    end = start + maxChunkSize;
    if (end > text.length) end = text.length;
  }
  
  return chunks.filter(Boolean);
}

// Confluenceからデータを取得する関数
async function getAllSpaceContent(spaceKey: string, type: string = 'page', limit: number = 100) {
  // Firebase config から直接環境変数を取得
  const config = functions.config();
  
  const baseUrl = config.confluence?.base_url || process.env.CONFLUENCE_BASE_URL;
  if (!baseUrl) {
    throw new Error('環境変数 CONFLUENCE_BASE_URL が設定されていません。');
  }
  
  const email = config.confluence?.user_email || process.env.CONFLUENCE_USER_EMAIL;
  if (!email) {
    throw new Error('環境変数 CONFLUENCE_USER_EMAIL が設定されていません。');
  }
  
  const apiToken = config.confluence?.api_token || process.env.CONFLUENCE_API_TOKEN;
  if (!apiToken) {
    throw new Error('環境変数 CONFLUENCE_API_TOKEN が設定されていません。');
  }
  
  const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
  
  let start = 0;
  let allResults: any[] = [];
  let hasMore = true;
  
  console.log(`[confluence] Fetching ${type}s from space ${spaceKey}`);
  
  while (hasMore) {
    try {
      const response = await axios.get(
        `${baseUrl}/wiki/rest/api/content`,
        {
          params: {
            spaceKey,
            type,
            expand: 'body.storage,version,metadata.labels',
            limit: 100, // 一度に取得するページ数を25から100に増やす
            start
          },
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const { results, size, limit: responseLimit, start: currentStart } = response.data;
      
      // レスポンスの詳細をログに出力
      console.log(`[confluence] Response details: size=${size}, limit=${responseLimit}, currentStart=${currentStart}`);
      
      if (results && results.length > 0) {
        allResults = [...allResults, ...results];
        console.log(`[confluence] Fetched ${results.length} ${type}s (total: ${allResults.length})`);
        
        // 次のページがあるか確認
        start = currentStart + size;
        console.log(`[confluence] Next start position: ${start}`);
        
        // 取得したページ数がlimitと同じ場合は次のページがある可能性がある
        hasMore = size === responseLimit;
        console.log(`[confluence] Has more pages: ${hasMore} (size=${size}, responseLimit=${responseLimit})`);
        
        // 指定された上限に達した場合は終了（limitが0の場合は無制限）
        if (limit > 0 && allResults.length >= limit) {
          console.log(`[confluence] Reached specified limit of ${limit} pages, stopping pagination`);
          hasMore = false;
        }
      } else {
        console.log(`[confluence] No more results returned, stopping pagination`);
        hasMore = false;
      }
      
      // 指定された上限に達したら結果を切り詰める（limitが0の場合は無制限）
      if (limit > 0 && allResults.length > limit) {
        console.log(`[confluence] Trimming results to specified limit of ${limit} pages`);
        allResults = allResults.slice(0, limit);
      }
    } catch (error) {
      console.error(`[confluence] Error fetching content: ${error}`);
      throw error;
    }
  }
  
  return allResults;
}

// 埋め込みベクトルを生成する関数
async function generateEmbedding(text: string): Promise<number[]> {
  // Firebase config から直接環境変数を取得
  const config = functions.config();
  
  const projectId = config.vertexai?.project_id || process.env.VERTEX_AI_PROJECT_ID;
  if (!projectId) {
    throw new Error('環境変数 VERTEX_AI_PROJECT_ID が設定されていません。');
  }
  
  const location = config.vertexai?.location || process.env.VERTEX_AI_LOCATION;
  if (!location) {
    throw new Error('環境変数 VERTEX_AI_LOCATION が設定されていません。');
  }
  
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });
  
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  const accessToken = token.token;
  
  const apiEndpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/text-embedding-004:predict`;
  
  try {
    const response = await axios.post(
      apiEndpoint,
      {
        instances: [{ content: text }]
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const embedding = response.data.predictions[0].embeddings.values;
    console.log(`[embedding] Generated embedding with ${embedding.length} dimensions`);
    return embedding;
  } catch (error) {
    console.error('[embedding] Error generating embedding:', error);
    throw error;
  }
}

// Vector Searchへのアップロード（バッチ更新方式）
async function uploadToVectorSearch(records: any[], projectId: string, location: string, indexId: string) {
  if (!indexId) {
    console.warn('[ingest] VERTEX_AI_INDEX_ID not set, skipping Vector Search upload');
    return;
  }

  console.log(`[ingest-batch] Uploading ${records.length} records to Vector Search index ${indexId}`);
  console.log(`[ingest-batch] Project: ${projectId}, Location: ${location}`);
  
  try {
    // アクセストークンの取得
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const client = await auth.getClient();
    
    // インデックスの完全名
    const indexName = `projects/${projectId}/locations/${location}/indexes/${indexId}`;
    console.log(`[ingest-batch] Using index: ${indexName}`);
    
    // データポイントの準備（JSONL形式）
    const datapoints = records.map((record) => {
      return {
        id: `${record.pageId}-${record.chunkIndex}`,
        // embedding → featureVector に変更（検索時のフィールド名と一致させる）
        featureVector: record.embedding.map(Number),
        restricts: [
          {
            namespace: "title",
            allow_list: [record.title]
          },
          {
            namespace: "content_type",
            allow_list: ["confluence_page"]
          }
        ],
        crowding_tag: record.pageId
      };
    });
    
    // JSONL形式に変換
    const jsonlContent = datapoints.map(dp => JSON.stringify(dp)).join('\n');
    
    // デバッグ用：最初のデータポイントの内容をログに出力
    if (datapoints.length > 0) {
      console.log('[ingest-batch] First datapoint sample:', JSON.stringify(datapoints[0], null, 2));
    }
    
    // バケット名の設定（環境変数から取得するか、デフォルト値を使用）
    const config = functions.config();
    const bucketName = config.vertexai?.storage_bucket || 
                      process.env.VERTEX_AI_STORAGE_BUCKET || 
                      `${projectId}-vector-search`;
    
    console.log(`[ingest-batch] Using GCS bucket: ${bucketName}`);
    
    // Cloud Storageクライアントの初期化
    const storage = new Storage();
    
    // バケットの存在確認と作成
    try {
      const [bucketExists] = await storage.bucket(bucketName).exists();
      if (!bucketExists) {
        console.log(`[ingest-batch] Bucket ${bucketName} does not exist, creating...`);
        await storage.createBucket(bucketName, {
          location: location.includes('-') ? location : 'asia-northeast1',
          storageClass: 'STANDARD'
        });
        console.log(`[ingest-batch] Bucket ${bucketName} created successfully`);
      } else {
        console.log(`[ingest-batch] Bucket ${bucketName} already exists`);
      }
    } catch (bucketErr) {
      console.error('[ingest-batch] Error checking/creating bucket:', bucketErr);
      throw bucketErr;
    }
    
    // ファイル名にタイムスタンプを追加
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `embeddings-${timestamp}.jsonl`;
    
    // ファイルのアップロード
    console.log(`[ingest-batch] Uploading data to gs://${bucketName}/${fileName}`);
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);
    
    try {
      await file.save(jsonlContent, {
        contentType: 'application/jsonl',
        metadata: {
          contentType: 'application/jsonl'
        }
      });
      console.log(`[ingest-batch] File uploaded successfully to gs://${bucketName}/${fileName}`);
    } catch (uploadErr) {
      console.error('[ingest-batch] Error uploading file to GCS:', uploadErr);
      throw uploadErr;
    }
    
    // GCSのURI
    const gcsUri = `gs://${bucketName}/${fileName}`;
    
    // IndexServiceClientの初期化
    const indexServiceClient = new IndexServiceClient({
      apiEndpoint: `${location}-aiplatform.googleapis.com`
    });
    
    // インデックス更新リクエスト
    console.log(`[ingest-batch] Updating index ${indexName} with data from ${gcsUri}`);
    try {
      // @ts-ignore TypeScriptの型エラーを無視
      const operation = await indexServiceClient.updateIndex({
        index: {
          name: indexName,
          metadata: {
            // @ts-ignore TypeScriptの型エラーを無視
            contentsDeltaUri: gcsUri
          }
        },
        updateMask: {
          paths: ['metadata.contentsDeltaUri']
        }
      });
      
      console.log('[ingest-batch] Update operation started');
      console.log('[ingest-batch] Waiting for operation to complete (this may take several minutes)...');
      
      // 更新操作の完了を待機
      // @ts-ignore TypeScriptの型エラーを無視
      const response = await operation[0].promise();
      console.log(`[ingest-batch] Index update completed successfully: ${JSON.stringify(response)}`);
    } catch (updateErr: any) {
      console.error('[ingest-batch] Error updating index:', updateErr);
      
      if (updateErr.details) {
        console.error('[ingest-batch] Error details:', updateErr.details);
      }
      
      throw updateErr;
    }
    
    console.log(`[ingest-batch] Vector Search batch update complete: ${records.length} records processed`);
    return records.length;
  } catch (err: any) {
    console.error('[ingest-batch] Vector Search upload error:', err.message);
    
    if (err.response) {
      console.error('[ingest-batch] Error status:', err.response.status);
      console.error('[ingest-batch] Error headers:', JSON.stringify(err.response.headers, null, 2));
      console.error('[ingest-batch] Error data (Full):', JSON.stringify(err.response.data, null, 2));
      
      if (err.response.data?.error) {
        console.error('[ingest-batch] Error code:', err.response.data.error.code);
        console.error('[ingest-batch] Error message:', err.response.data.error.message);
        console.error('[ingest-batch] Error status:', err.response.data.error.status);
        if (err.response.data.error.details) {
          console.error('[ingest-batch] Error details:', JSON.stringify(err.response.data.error.details, null, 2));
        }
      }
    } else if (err.request) {
      console.error('[ingest-batch] No response received');
    } else {
      console.error('[ingest-batch] Error message:', err.message);
    }
    
    throw err;
  }
}

// メインの同期処理
async function syncConfluenceDataImpl() {
  // Firebase config から直接環境変数を取得
  const config = functions.config();
  console.log('[debug] Firebase config:', JSON.stringify(config));
  
  // Confluence 設定
  const spaceKey = config.confluence?.space_key || process.env.CONFLUENCE_SPACE_KEY;
  if (!spaceKey) {
    throw new Error('環境変数 CONFLUENCE_SPACE_KEY が設定されていません。');
  }
  
  // Vertex AI 設定
  const projectId = config.vertexai?.project_id || process.env.VERTEX_AI_PROJECT_ID;
  if (!projectId) {
    throw new Error('環境変数 VERTEX_AI_PROJECT_ID が設定されていません。');
  }
  
  const location = config.vertexai?.location || process.env.VERTEX_AI_LOCATION;
  if (!location) {
    throw new Error('環境変数 VERTEX_AI_LOCATION が設定されていません。');
  }
  
  // Vector Search インデックスID
  const indexId = config.vertexai?.index_id || process.env.VERTEX_AI_INDEX_ID || '';

  console.log(`[ingest] Start ingest for space: ${spaceKey}`);

  // Confluenceからページを取得（制限なし）
  const pages = await getAllSpaceContent(spaceKey, 'page', 0); // 0を指定して制限を無効化
  console.log(`[ingest] fetched pages: ${pages.length}`);

  // 全てのページを処理対象とする（ページ制限を無効化）
  const targetPages = pages;
  console.log(`[ingest] Processing all ${pages.length} pages`);

  // 出力データの配列
  const output: any[] = [];

  // ページごとの処理
  for (const page of targetPages) {
    const pageId = page.id;
    const title = page.title;
    const html = page.body?.storage?.value || '';
    const url = `${process.env.CONFLUENCE_BASE_URL}/wiki/spaces/${spaceKey}/pages/${pageId}`;
    const labels = page.metadata?.labels?.results?.map((label: any) => label.name) || [];
    const lastUpdated = page.version?.when || new Date().toISOString();
    
    // HTMLからテキストを抽出
    let pageText = stripHtml(html);
    if (!pageText) continue;
    
    console.log(`[ingest] ${title} (${pageId}) -> chunks: ${chunkText(pageText).length}, labels: ${labels.length ? labels.join(', ') : 'none'}`);
    
    // 文字化けチェック
    if (/縺/.test(pageText)) {
      console.warn('[ingest] Warning: Text appears to be encoded incorrectly, using placeholder');
      pageText = `${title}のコンテンツ（文字化けのため省略）`;
    }
    
    // テキストをチャンクに分割
    const chunks = chunkText(pageText);
    
    // チャンクごとに埋め込みベクトルを生成
    for (let i = 0; i < chunks.length; i++) {
      let content = chunks[i];
      console.log(`[ingest] Chunk ${i} first 10 chars: ${content.substring(0, 10)}`);
      
      // 文字化けチェック（各チャンク）
      if (content.includes('縺') || content.includes('繧') || content.includes('繝')) {
        console.warn(`[ingest] Warning: Chunk ${i} appears to be encoded incorrectly, using placeholder`);
        content = `${title} (チャンク ${i+1}/${chunks.length})`;
      }
      
      // 埋め込みベクトルの生成
      const embedding = await generateEmbedding(content);
      
      // 出力データに追加
      output.push({
        pageId,
        title,
        chunkIndex: i,
        text: content,
        embedding,
        url,
        labels,
        lastUpdated,
      });
    }
  }

  // Vector Searchへのアップロード（インデックスIDが設定されている場合のみ）
  if (indexId) {
    try {
      await uploadToVectorSearch(output, projectId, location, indexId);
      console.log(`[ingest] Vector Search upload complete for ${output.length} records`);
    } catch (err) {
      console.error('[ingest] Vector Search upload failed:', err);
      // エラーがあっても処理は継続
    }
  } else {
    console.log('[ingest] VERTEX_AI_INDEX_ID not set, skipping Vector Search upload');
    console.log('[ingest] To upload to Vector Search, set VERTEX_AI_INDEX_ID environment variable');
  }
  
  console.log(`[ingest] Processing complete: ${output.length} records processed`);
  return {
    status: 'success',
    message: 'Confluence data sync completed',
    processed_pages: targetPages.length,
    records: output.length
  };
}

// HTTP関数: 手動実行用
export const syncConfluenceData = functions
  .region('asia-northeast1') // 東京リージョン
  .runWith({
    timeoutSeconds: 540, // 9分（最大10分）
    memory: '1GB'
  })
  .https.onRequest(async (req, res) => {
    try {
      console.log('[function] HTTP trigger received');
      const result = await syncConfluenceDataImpl();
      res.status(200).json(result);
    } catch (error: any) {
      console.error('[function] Error:', error);
      
      // エラーオブジェクトの詳細を出力
      if (error.response) {
        console.error('[function] Error response status:', error.response.status);
        console.error('[function] Error response headers:', JSON.stringify(error.response.headers, null, 2));
        
        // エラーデータを完全に文字列化して出力
        console.error('[function] Error response data (Full):', JSON.stringify(error.response.data, null, 2));
      } else if (error.request) {
        console.error('[function] No response received for request:', JSON.stringify(error.request, null, 2));
      }
      
      res.status(500).json({
        status: 'error',
        message: error.message || 'Unknown error',
        error: error.response?.data ? JSON.stringify(error.response.data) : 'No detailed error data'
      });
    }
  });

// Pub/Sub関数: スケジュール実行用
export const scheduledSyncConfluenceData = functions
  .region('asia-northeast1') // 東京リージョン
  .runWith({
    timeoutSeconds: 540, // 9分（最大10分）
    memory: '1GB'
  })
  .pubsub.schedule('0 0 * * *') // 毎日午前0時に実行
  .timeZone('Asia/Tokyo')
  .onRun(async (context) => {
    try {
      console.log('[function] Scheduled execution started');
      await syncConfluenceDataImpl();
      return null;
    } catch (error: any) {
      console.error('[function] Scheduled execution error:', error);
      
      // エラーオブジェクトの詳細を出力
      if (error.response) {
        console.error('[function] Error response status:', error.response.status);
        console.error('[function] Error response headers:', JSON.stringify(error.response.headers, null, 2));
        
        // エラーデータを完全に文字列化して出力
        console.error('[function] Error response data (Full):', JSON.stringify(error.response.data, null, 2));
      } else if (error.request) {
        console.error('[function] No response received for request:', JSON.stringify(error.request, null, 2));
      }
      
      throw error;
    }
  });

// テスト関数をエクスポート
// export { testVectorSearchUploadV3, testVectorSearchUploadV4 };