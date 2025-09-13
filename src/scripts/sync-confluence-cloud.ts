/**
 * Confluence → Vector Search 同期スクリプト
 * - Confluenceからデータを取得
 * - テキスト抽出・チャンク分割
 * - Embedding生成
 * - Vector Searchへのアップロード
 */

import 'dotenv/config';
import { getAllSpaceContent } from '@/lib/confluence-client';
import axios from 'axios';
import { GoogleAuth } from 'google-auth-library';

// 環境変数の確認
function assertEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`環境変数 ${name} が設定されていません。`);
  }
  return value;
}

// データ型定義
type EmbeddingRecord = {
  pageId: string;
  title: string;
  chunkIndex: number;
  text: string;
  embedding: number[];
  url: string;
  labels: string[];
  lastUpdated: string;
};

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

// Vector Searchへのアップロード
async function uploadToVectorSearch(records: EmbeddingRecord[], projectId: string, location: string, indexId: string) {
  if (!indexId) {
    console.warn('[ingest] VERTEX_AI_INDEX_ID not set, skipping Vector Search upload');
    return;
  }

  console.log(`[ingest] Uploading ${records.length} records to Vector Search index ${indexId}`);
  console.log(`[ingest] Project: ${projectId}, Location: ${location}`);
  
  try {
    // アクセストークンの取得
    let accessToken;
    try {
      // Google Cloud SDK がインストールされている場合
      const { execSync } = require('child_process');
      accessToken = execSync('gcloud auth print-access-token 2>nul').toString().trim();
    } catch (error) {
      console.log('[ingest] Failed to get access token via gcloud CLI. Using ADC instead.');
      
      // ADC から直接取得する方法（本番環境用）
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
      });
      const client = await auth.getClient();
      const token = await client.getAccessToken();
      accessToken = token.token;
    }
    
    // インデックスの完全名
    const indexName = `projects/${projectId}/locations/${location}/indexes/${indexId}`;
    console.log(`[ingest] Using index: ${indexName}`);
    
    // REST APIのエンドポイント
    const apiEndpoint = `https://${location}-aiplatform.googleapis.com/v1/${indexName}:upsertDatapoints`;
    
    // データポイントの準備
    const datapoints = records.map((record) => {
      // Vector Search APIの仕様に合わせた最小限のデータ形式
      return {
        datapoint_id: `${record.pageId}-${record.chunkIndex}`,
        feature_vector: record.embedding,
        // restrictsは必要最小限に
        restricts: [
          { namespace: 'source', allow_list: ['confluence'] }
        ]
      };
    });
    
    // バッチサイズを設定（APIの制限に合わせて調整）
    const BATCH_SIZE = 100;
    const batches = [];
    
    for (let i = 0; i < datapoints.length; i += BATCH_SIZE) {
      batches.push(datapoints.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`[ingest] Uploading in ${batches.length} batches`);
    
    // バッチごとにアップロード
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`[ingest] Uploading batch ${i + 1}/${batches.length} (${batch.length} records)`);
      
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
      
      console.log(`[ingest] Batch ${i + 1} upload complete: Status ${response.status}`);
    }
    
    console.log(`[ingest] Vector Search upload complete: ${records.length} records processed`);
    return records.length;
  } catch (err) {
    console.error('[ingest] Vector Search upload error:', err);
    if (err.response && err.response.data) {
      console.error('[ingest] Error details:', JSON.stringify(err.response.data, null, 2));
    }
    throw err;
  }
}

async function main() {
  const spaceKey = assertEnv('CONFLUENCE_SPACE_KEY');
  // Vertex AI 用（ADC 前提）
  const projectId = assertEnv('VERTEX_AI_PROJECT_ID');
  const location = assertEnv('VERTEX_AI_LOCATION');
  // Vector Search インデックスID（任意）
  const indexId = process.env.VERTEX_AI_INDEX_ID || '';

  console.log(`[ingest] Start ingest for space: ${spaceKey}`);

  // Confluenceからページを取得
  const pages = await getAllSpaceContent(spaceKey, 'page');
  console.log(`[ingest] fetched pages: ${pages.length}`);

  // 処理対象のページを選択（オプション: 環境変数でフィルタリング）
  const pageLimit = process.env.INGEST_PAGE_LIMIT ? parseInt(process.env.INGEST_PAGE_LIMIT, 10) : undefined;
  const targetPages = pageLimit ? pages.slice(0, pageLimit) : pages;
  
  if (pageLimit) {
    console.log(`[ingest] limiting to first ${pageLimit} pages for test`);
  }

  // 出力データの配列
  const output: EmbeddingRecord[] = [];

  // ページごとの処理
  for (const page of targetPages) {
    const pageId = page.id;
    const title = page.title;
    const html = page.body?.storage?.value || '';
    const url = `${process.env.CONFLUENCE_BASE_URL}/wiki/spaces/${spaceKey}/pages/${pageId}`;
    const labels = page.metadata?.labels?.results?.map((label: any) => label.name) || [];
    const lastUpdated = page.version?.when || new Date().toISOString();
    
    // HTMLの一部をログ出力（デバッグ用）
    console.log(`[ingest] Original HTML snippet:`);
    console.log(html.substring(0, 100) + '...');
    
    // HTMLからテキストを抽出
    let pageText = stripHtml(html);
    if (!pageText) continue;
    
    // 抽出したテキストの一部をログ出力（デバッグ用）
    console.log(`[ingest] Decoded text snippet: ${pageText.substring(0, 100)}...`);
    console.log(' '.repeat(17)); // 整形用の空白
    
    console.log(`[ingest] ${title} (${pageId}) -> chunks: ${chunkText(pageText).length}, labels: ${labels.length ? labels.join(', ') : 'none'}`);
    
    // 文字化けチェック
    if (/縺/.test(pageText)) {
      console.warn('[ingest] Warning: Text appears to be encoded incorrectly, using console output instead');
      pageText = `${title}のコンテンツ（文字化けのため省略）`;
    }
    
    // テキストをチャンクに分割
    const chunks = chunkText(pageText);
    
    // チャンクごとに埋め込みベクトルを生成
    for (let i = 0; i < chunks.length; i++) {
      let content = chunks[i];
      console.log(`[ingest] Chunk ${i} first 10 chars: ${content.substring(0, 10)}`);
      
      // 文字化けチェック（各チャンク）- より強力な検出
      if (content.includes('縺') || content.includes('繧') || content.includes('繝')) {
        console.warn(`[ingest] Warning: Chunk ${i} appears to be encoded incorrectly, using placeholder`);
        content = `${title} (チャンク ${i+1}/${chunks.length})`;
      }
      
      // 埋め込みベクトルの生成
      // Vertex AI APIを使用して埋め込みベクトルを生成
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
      });
      
      const client = await auth.getClient();
      const token = await client.getAccessToken();
      const accessToken = token.token;
      
      const apiEndpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/text-embedding-004:predict`;
      
      const response = await axios.post(
        apiEndpoint,
        {
          instances: [{ content: content }]
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const embedding = response.data.predictions[0].embeddings.values;
      
      // 出力データに追加
      output.push({
        pageId,
        title,
        chunkIndex: i,
        text: content,
        embedding: embedding,
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
      console.log('[ingest] Continuing with local file only');
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

main().catch((err) => {
  console.error('[ingest] Error:', err);
  process.exit(1);
});
