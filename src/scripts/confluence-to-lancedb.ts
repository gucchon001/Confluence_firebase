/**
 * Confluenceからデータを取得し、LanceDBに保存するスクリプト
 * Usage: npx tsx src/scripts/confluence-to-lancedb.ts --limit 5
 */
import 'dotenv/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as lancedb from '@lancedb/lancedb';
import { getEmbeddings } from '../lib/embeddings';

// コマンドライン引数の解析
const args = process.argv.slice(2);
let limit = 5;

// --limit 引数を解析
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit' && i + 1 < args.length) {
    limit = parseInt(args[i + 1], 10);
    break;
  }
}

// Confluenceの認証情報
const CONFLUENCE_BASE_URL = process.env.CONFLUENCE_BASE_URL || '';
const CONFLUENCE_USER_EMAIL = process.env.CONFLUENCE_USER_EMAIL || '';
const CONFLUENCE_API_TOKEN = process.env.CONFLUENCE_API_TOKEN || '';
const CONFLUENCE_SPACE_KEY = process.env.CONFLUENCE_SPACE_KEY || '';

if (!CONFLUENCE_BASE_URL || !CONFLUENCE_USER_EMAIL || !CONFLUENCE_API_TOKEN || !CONFLUENCE_SPACE_KEY) {
  console.error('環境変数が設定されていません。.envファイルを確認してください。');
  process.exit(1);
}

interface ConfluencePage {
  id: string;
  title: string;
  body?: { storage?: { value: string; }; };
  space?: { key: string; name: string; };
  version?: { when: string; };
  metadata?: { labels?: { results: Array<{ name: string; }>; }; };
}

/**
 * HTMLからテキストを抽出する
 */
function extractTextFromHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * テキストをチャンクに分割する
 */
function splitTextIntoChunks(text: string, chunkSize: number = 1000): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.substring(i, i + chunkSize).trim();
    if (chunk) {
      chunks.push(chunk);
    }
  }
  return chunks;
}

/**
 * Confluenceからページを取得する
 */
async function fetchConfluencePages(spaceKey: string, limit: number = 10): Promise<ConfluencePage[]> {
  try {
    console.log(`Confluenceからデータを取得中... (スペースキー: ${spaceKey}, 上限: ${limit}件)`);
    
    const response = await axios.get(`${CONFLUENCE_BASE_URL}/wiki/rest/api/content`, {
      params: {
        spaceKey,
        expand: 'body.storage,metadata.labels,version,space',
        limit
      },
      auth: {
        username: CONFLUENCE_USER_EMAIL,
        password: CONFLUENCE_API_TOKEN
      }
    });
    
    if (!response.data || !response.data.results) {
      console.error('Confluenceからのレスポンスが不正です:', response.data);
      return [];
    }
    
    return response.data.results as ConfluencePage[];
  } catch (error: any) {
    console.error('Confluenceからのデータ取得に失敗しました:', error.message);
    if (error.response) {
      console.error('レスポンスステータス:', error.response.status);
      console.error('レスポンスデータ:', error.response.data);
    }
    return [];
  }
}

/**
 * メインの処理
 */
async function main() {
  try {
    // Confluenceからページを取得
    const pages = await fetchConfluencePages(CONFLUENCE_SPACE_KEY, limit);
    
    if (pages.length === 0) {
      console.log('ページが見つかりませんでした。');
      return;
    }
    
    console.log(`${pages.length}件のページを取得しました。`);
    
    // LanceDBに接続
    console.log('LanceDBに接続中...');
    const db = await lancedb.connect('.lancedb');
    const tableName = 'test_confluence_new';
    
    // テーブルが存在するか確認
    const tableNames = await db.tableNames();
    const exists = tableNames.includes(tableName);
    let tbl: lancedb.Table;
    
    if (exists) {
      console.log(`テーブル '${tableName}' が存在します。削除します...`);
      await db.dropTable(tableName);
      console.log(`テーブル '${tableName}' を削除しました。`);
    }
    
    // サンプルデータでテーブルを作成
    console.log(`テーブル '${tableName}' を作成します...`);
    const sampleData = {
      id: 'sample-1',
      vector: new Float32Array(Array(10).fill(0).map((_, i) => i / 10)),
      space_key: 'SAMPLE',
      title: 'サンプルデータ',
      labels: ['サンプル'],
      content: 'これはサンプルデータです。',
      pageId: 'sample-page-1',
      chunkIndex: 0,
      url: 'https://example.com',
      lastUpdated: new Date().toISOString()
    };
    
    tbl = await db.createTable(tableName, [sampleData]);
    console.log(`テーブル '${tableName}' を作成しました。`);
    
    // 各ページを処理
    let totalChunks = 0;
    for (const page of pages) {
      console.log(`\n[処理中] ${page.title} (ID: ${page.id})`);
      
      // HTMLからテキストを抽出
      const htmlContent = page.body?.storage?.value;
      if (!htmlContent) {
        console.log('  本文がありません。スキップします。');
        continue;
      }
      
      const textContent = extractTextFromHtml(htmlContent);
      console.log(`  テキスト抽出完了: ${textContent.length}文字`);
      
      // テキストをチャンクに分割
      const chunks = splitTextIntoChunks(textContent);
      console.log(`  ${chunks.length}個のチャンクに分割しました。`);
      
      // 各チャンクを処理
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkId = `${page.id}-${i}`;
        
        console.log(`  チャンク ${i + 1}/${chunks.length} を処理中...`);
        
        // 埋め込みベクトルを生成
        console.log('    埋め込みベクトルを生成中...');
        const vector = await getEmbeddings(chunk);
        console.log(`    埋め込みベクトル生成完了: ${vector.length}次元`);
        
        // 10次元に切り詰める（テスト用）
        const truncatedVector = vector.slice(0, 10);
        
        // LanceDBにデータを追加
        const record = {
          id: chunkId,
          vector: new Float32Array(truncatedVector),
          space_key: page.space?.key || '',
          title: page.title,
          labels: page.metadata?.labels?.results?.map(label => label.name) || [],
          content: chunk.substring(0, 200), // コンテンツを200文字に制限
          pageId: page.id,
          chunkIndex: i,
          url: `${CONFLUENCE_BASE_URL}/wiki/spaces/${page.space?.key}/pages/${page.id}`,
          lastUpdated: page.version?.when || new Date().toISOString()
        };
        
        await tbl.add([record]);
        console.log(`    チャンク ${i + 1} をLanceDBに追加しました。`);
        totalChunks++;
      }
    }
    
    // テーブル情報を表示
    const count = await tbl.countRows();
    console.log(`\n処理が完了しました。テーブル '${tableName}' には ${count} 行のデータがあります。`);
    console.log(`今回追加したチャンク数: ${totalChunks}`);
    
  } catch (error: any) {
    console.error('エラーが発生しました:', error.message);
    process.exit(1);
  }
}

main();