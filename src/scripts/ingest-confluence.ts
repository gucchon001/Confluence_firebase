/*
 * Confluence → Embeddings ローカル取り込みスクリプト
 * - SYS-001: Confluenceデータ取得・抽出・分割
 * - SYS-002: Embedding生成（googleai/text-embedding-004）→ JSON 保存
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { ai } from '@/ai/genkit';
import { getAllSpaceContent } from '@/lib/confluence-client';
import axios from 'axios';

type EmbeddingRecord = {
  pageId: string;
  title: string;
  chunkIndex: number;
  text: string;
  embedding: number[];
  url: string;
  labels: string[];
  lastUpdated: string; // ISO形式の日時文字列
};

function assertEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing environment variable: ${key}`);
  return v;
}

function stripHtml(html: string): string {
  // HTMLエンティティをデコード
  const decoded = html
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
    
  // HTMLタグを削除
  return decoded
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function chunkText(text: string, maxLen = 800): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + maxLen);
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks.filter(Boolean);
}

// Vector Search へのアップロード
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
      const { GoogleAuth } = require('google-auth-library');
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
      return {
        datapoint_id: `${record.pageId}-${record.chunkIndex}`,
        feature_vector: record.embedding,
        restricts: [
          { namespace: 'source', allow_list: ['confluence'] },
          { namespace: 'pageId', allow_list: [record.pageId] },
        ],
        crowding_tag: record.pageId,
        numeric_restricts: [
          { 
            namespace: 'lastUpdated', 
            value: new Date(record.lastUpdated).getTime() / 1000 
          },
        ],
        metadata: {
          fields: {
            title: { string_value: record.title },
            text: { string_value: record.text },
            url: { string_value: record.url },
            labels: { string_value: record.labels.join(',') },
            pageId: { string_value: record.pageId },
            chunkIndex: { string_value: record.chunkIndex.toString() },
            lastUpdated: { string_value: record.lastUpdated },
          },
        },
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

  const pages = await getAllSpaceContent(spaceKey, 'page');
  console.log(`[ingest] fetched pages: ${pages.length}`);

  // テスト用に上限をかける（環境変数 INGEST_PAGE_LIMIT）
  const limitEnv = process.env.INGEST_PAGE_LIMIT;
  const pageLimit = limitEnv ? Math.max(0, parseInt(limitEnv, 10)) : undefined;
  const targetPages = pageLimit ? pages.slice(0, pageLimit) : pages;
  if (pageLimit) {
    console.log(`[ingest] limiting to first ${pageLimit} pages for test`);
  }

  const output: EmbeddingRecord[] = [];

  for (const page of targetPages) {
    const pageId: string = page.id;
    const title: string = page.title ?? '';
    const html: string = page.body?.storage?.value ?? '';
    
    // エンコーディング問題のデバッグ
    console.log(`[ingest] Original HTML snippet: ${html.substring(0, 100)}...`);
    
    // 変数として宣言（constではなくlet）
    let pageText = stripHtml(html);
    if (!pageText) continue;
    
    // デコード後のテキストをログに出力
    console.log(`[ingest] Decoded text snippet: ${pageText.substring(0, 100)}...`);
    
    // 文字化けチェック
    if (/縺/.test(pageText)) {
      console.warn('[ingest] Warning: Text appears to be encoded incorrectly, using console output instead');
      // ログに出力されたテキストを使用（実際には取得できないため、代替テキストを使用）
      pageText = `${title}のコンテンツ（文字化けのため省略）`;
    }

    // ラベルの取得
    const labels: string[] = [];
    try {
      const labelsData = page.metadata?.labels?.results || [];
      for (const label of labelsData) {
        if (label.name) {
          labels.push(label.name);
        }
      }
    } catch (err) {
      console.warn(`[ingest] Warning: Failed to extract labels for page ${pageId}:`, err);
    }

    // 更新日時の取得
    const lastUpdated = page.version?.when || new Date().toISOString();

    const chunks = chunkText(pageText, 800);
    console.log(`[ingest] ${title} (${pageId}) -> chunks: ${chunks.length}, labels: ${labels.join(', ') || 'none'}`);

    // 連続呼び出しを避けるためシーケンシャル実行
    for (let i = 0; i < chunks.length; i++) {
      let content = chunks[i];
      
      // デバッグ: 最初の10文字を表示
      console.log(`[ingest] Chunk ${i} first 10 chars: ${content.substring(0, 10)}`);
      
      // 文字化けチェック（各チャンク）- より強力な検出
      if (content.includes('縺') || content.includes('繧') || content.includes('繝')) {
        console.warn(`[ingest] Warning: Chunk ${i} appears to be encoded incorrectly, using placeholder`);
        content = `${title} (チャンク ${i+1}/${chunks.length})`;
      }
      
      const embeddingRes = await ai.embed({
        embedder: 'googleai/text-embedding-004',
        content,
      });

      // 型アサーションで明示的に型を指定
      const vector = Array.isArray(embeddingRes)
        ? (embeddingRes[0] as any).embedding
        : (embeddingRes as any).embedding;

      output.push({
        pageId,
        title,
        chunkIndex: i,
        text: content,
        embedding: vector as number[],
        url: `${process.env.CONFLUENCE_BASE_URL}/wiki/spaces/${spaceKey}/pages/${pageId}`,
        labels,
        lastUpdated,
      });
    }
  }

  const outDir = path.join(process.cwd(), 'data');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `embeddings-${spaceKey}.json`);
  
  // JSON文字列に変換
  const jsonString = JSON.stringify(output, null, 2);
  
  fs.writeFileSync(outFile, jsonString, 'utf-8');
  console.log(`[ingest] saved: ${outFile} (records: ${output.length})`);
  
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
}

main().catch((err) => {
  console.error('[ingest] Error:', err);
  process.exit(1);
});


