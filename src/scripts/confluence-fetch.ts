/**
 * Confluenceからデータを取得するシンプルなスクリプト
 * Usage: npx tsx src/scripts/confluence-fetch.ts --limit 5
 */
import 'dotenv/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

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
    
    // 各ページの情報を表示
    pages.forEach((page, index) => {
      console.log(`\n[${index + 1}] ${page.title} (ID: ${page.id})`);
      console.log(`スペース: ${page.space?.key} (${page.space?.name})`);
      console.log(`最終更新: ${page.version?.when}`);
      
      if (page.metadata?.labels?.results.length) {
        const labels = page.metadata.labels.results.map(label => label.name).join(', ');
        console.log(`ラベル: ${labels}`);
      }
      
      if (page.body?.storage?.value) {
        const text = extractTextFromHtml(page.body.storage.value);
        const preview = text.length > 200 ? `${text.substring(0, 200)}...` : text;
        console.log(`本文プレビュー: ${preview}`);
      }
    });
    
    // データをJSONファイルに保存
    const outputDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputFile = path.join(outputDir, `confluence-pages-${Date.now()}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(pages, null, 2), 'utf8');
    
    console.log(`\nデータを保存しました: ${outputFile}`);
  } catch (error: any) {
    console.error('エラーが発生しました:', error.message);
    process.exit(1);
  }
}

main();