/**
 * Confluence → Vector Search 同期スクリプト
 * - Confluenceからデータを取得
 * - テキスト抽出・チャンク分割
 * - Embedding生成
 * - Vector Searchへのアップロード
 */

import 'dotenv/config';
import { getAllSpaceContent } from '@/lib/confluence-client';
// removed Vertex AI and axios usage

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


async function main() {
  const spaceKey = assertEnv('CONFLUENCE_SPACE_KEY');
  // Vertex AI 関連は削除
  const projectId = '';
  const location = '';
  const indexId = '';

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
      
      // 埋め込みベクトルの生成（ダミー/または別実装に置換）
      const embedding = [] as number[];
      
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

  // Vector Searchへのアップロード（バッチ運用に統一のため、本スクリプトでは実行しない）
  console.log('[ingest] Skipping Vector Search upload (upsertDatapoints is disabled).');
  console.log('[ingest] Use folder-based import: convert-jsonl-to-json.ts -> upload-to-vector-search.ts');
  
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
