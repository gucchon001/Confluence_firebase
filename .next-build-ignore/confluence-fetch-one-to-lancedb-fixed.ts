/**
 * Confluence特定ページをLanceDBに保存するスクリプト（完全修正版）
 * 
 * 使用方法:
 * npx tsx src/scripts/confluence-fetch-one-to-lancedb-fixed.ts <pageId> <tableName> <contentLimit>
 * 例: npx tsx src/scripts/confluence-fetch-one-to-lancedb-fixed.ts 740163745 confluence_fixed 800
 */
import 'dotenv/config';
import axios from 'axios';
import * as path from 'path';
import * as lancedb from '@lancedb/lancedb';
import { getEmbeddings } from '../lib/embeddings';

// 型定義
interface ConfluencePage {
  id: string;
  title: string;
  body?: { storage?: { value: string; }; };
  space?: { key: string; name: string; };
  version?: { when: string; };
  metadata?: { labels?: { results: Array<{ name: string; }>; }; };
}

// 最小限のスキーマ定義
interface MinimalRecord {
  id: string;
  vector: number[];
  title: string;
  content: string;
}

/**
 * HTMLからテキストを抽出する（シンプル版）
 */
function extractTextFromHtml(html: string): string {
  if (!html) return '';
  
  // HTMLタグを削除して空白に置換
  const withoutTags = html.replace(/<[^>]*>/g, ' ');
  
  // 連続する空白を1つにまとめる
  const normalizedSpaces = withoutTags.replace(/\s+/g, ' ');
  
  // 前後の空白を削除
  return normalizedSpaces.trim();
}

/**
 * Confluenceから特定のページを取得
 */
async function fetchConfluencePage(pageId: string): Promise<ConfluencePage> {
  const baseUrl = process.env.CONFLUENCE_BASE_URL;
  const userEmail = process.env.CONFLUENCE_USER_EMAIL;
  const apiToken = process.env.CONFLUENCE_API_TOKEN;

  if (!baseUrl || !userEmail || !apiToken) {
    throw new Error('Confluence API認証情報が環境変数に設定されていません');
  }

  const endpoint = `${baseUrl}/wiki/rest/api/content/${pageId}`;
  const auth = { username: userEmail, password: apiToken };
  const params = {
    expand: 'body.storage,metadata.labels,version,space',
  };

  console.log(`Confluenceからページ(ID: ${pageId})を取得中...`);

  try {
    const response = await axios.get(endpoint, { params, auth, timeout: 30000 });
    return response.data;
  } catch (error: any) {
    console.error('Confluence APIからのデータ取得中にエラーが発生しました:', error.message);
    if (axios.isAxiosError(error) && error.response) {
      console.error('レスポンスステータス:', error.response.status);
      console.error('レスポンスデータ:', error.response.data);
    }
    throw error;
  }
}

async function main() {
  // コマンドライン引数の処理
  const pageId = process.argv[2];
  const tableName = process.argv[3] || 'confluence_fixed';
  const contentLimit = parseInt(process.argv[4] || '800', 10);

  if (!pageId) {
    console.error('使用方法: npx tsx src/scripts/confluence-fetch-one-to-lancedb-fixed.ts <pageId> <tableName> <contentLimit>');
    process.exit(1);
  }

  console.log(`=== Confluence特定ページをLanceDBに保存（完全修正版） ===`);
  console.log(`設定: ページID=${pageId}, テーブル=${tableName}, コンテンツ制限=${contentLimit}文字`);

  try {
    // 1. Confluenceからページを取得
    console.log('\n1. Confluenceからページを取得');
    const page = await fetchConfluencePage(pageId);
    console.log(`ページ取得成功: ${page.title} (ID: ${page.id})`);
    
    // 2. HTMLからテキストを抽出
    console.log('\n2. HTMLからテキストを抽出');
    const htmlContent = page.body?.storage?.value;
    if (!htmlContent) {
      console.error('ページ本文が空です');
      process.exit(1);
    }
    
    const textContent = extractTextFromHtml(htmlContent);
    const limitedContent = textContent.substring(0, contentLimit);
    console.log(`テキスト抽出成功: ${limitedContent.length}文字 (制限: ${contentLimit}文字)`);
    console.log(`内容プレビュー: ${limitedContent.substring(0, 100)}...`);
    
    // 3. 埋め込みベクトルを生成
    console.log('\n3. 埋め込みベクトルを生成');
    console.log('getEmbeddings関数を呼び出し中...');
    const rawVector = await getEmbeddings(limitedContent);
    
    // 埋め込みベクトルの型情報を出力
    console.log(`埋め込みベクトルの型: ${typeof rawVector}`);
    console.log(`Array.isArray: ${Array.isArray(rawVector)}`);
    console.log(`コンストラクタ名: ${rawVector.constructor?.name || '不明'}`);
    console.log(`長さ: ${rawVector.length}`);
    console.log(`先頭10要素: [${rawVector.slice(0, 10).map(v => v.toFixed(6)).join(', ')}]`);
    
    // 4. ベクトルを純number[]に変換
    console.log('\n4. ベクトルをnumber[]に変換');
    const vector = Array.from(rawVector, x => {
      const num = Number(x);
      return Number.isFinite(num) ? num : 0;
    });
    
    console.log(`変換後の型: ${typeof vector}`);
    console.log(`Array.isArray: ${Array.isArray(vector)}`);
    console.log(`長さ: ${vector.length}`);
    console.log(`先頭10要素: [${vector.slice(0, 10).map(v => v.toFixed(6)).join(', ')}]`);
    
    // 5. LanceDBに接続
    console.log('\n5. LanceDBに接続');
    const dbPath = path.resolve('.lancedb');
    console.log(`データベースパス: ${dbPath}`);
    const db = await lancedb.connect(dbPath);
    
    // 6. テーブル作成（最小限のスキーマ）
    console.log(`\n6. テーブル '${tableName}' を作成/オープン`);
    
    // テーブルが既に存在するか確認
    const tableExists = (await db.tableNames()).includes(tableName);
    console.log(`テーブル '${tableName}' の存在: ${tableExists}`);
    
    // レコード準備
    const recordId = `${page.id}-0`;
    const record: MinimalRecord = {
      id: recordId,
      vector: vector,
      title: page.title,
      content: limitedContent
    };
    
    let tbl;
    if (!tableExists) {
      // サンプルデータを使用してテーブルを作成
      console.log('サンプルデータでテーブルを新規作成します');
      tbl = await db.createTable(tableName, [record as unknown as Record<string, unknown>]);
      console.log(`テーブル '${tableName}' を作成しました`);
    } else {
      console.log('既存のテーブルを開きます');
      tbl = await db.openTable(tableName);
      console.log(`テーブル '${tableName}' を開きました`);
      
      // 既存テーブルにレコードを追加
      console.log(`既存テーブルにレコード '${recordId}' を追加します`);
      await tbl.add([record]);
      console.log(`レコード '${recordId}' を追加しました`);
    }
    
    // 7. 読み戻し検証
    console.log('\n7. 読み戻し検証');
    try {
      const results = await tbl.query().where(`id = '${recordId}'`).toArray();
      console.log(`取得したレコード数: ${results.length}`);
      
      if (results.length > 0) {
        const record = results[0];
        console.log('挿入したレコード:');
        console.log(`  ID: ${record.id}`);
        console.log(`  タイトル: ${record.title}`);
        
        // ベクトルの型を確認
        console.log(`  ベクトルの型: ${typeof record.vector}`);
        console.log(`  ベクトルはArray? ${Array.isArray(record.vector)}`);
        console.log(`  ベクトル長: ${record.vector?.length || 'N/A'}`);
        
        // ベクトルの内容をJSON文字列として表示
        console.log(`  ベクトル先頭5要素: ${JSON.stringify(record.vector).substring(0, 50)}...`);
        console.log(`  内容: ${record.content.substring(0, 50)}...`);
      }
    } catch (error) {
      console.error('レコード読み取り中にエラーが発生しました:', error);
      throw error;
    }
    
    // 8. 検索の動作確認
    console.log('\n8. 検索の動作確認');
    try {
      const searchResults = await tbl.search(vector).limit(1).toArray();
      console.log(`検索結果数: ${searchResults.length}`);
      
      if (searchResults.length > 0) {
        const record = searchResults[0];
        console.log('検索結果:');
        console.log(`  ID: ${record.id}`);
        console.log(`  距離: ${record._distance}`);
        console.log(`  タイトル: ${record.title}`);
        console.log(`  内容: ${record.content.substring(0, 50)}...`);
      }
    } catch (error) {
      console.error('検索中にエラーが発生しました:', error);
      throw error;
    }
    
    console.log('\n=== 処理完了 ===');
    console.log(`テーブル '${tableName}' には現在 ${await tbl.countRows()} 行のデータがあります`);
    
  } catch (error) {
    console.error('スクリプト実行中にエラーが発生しました:', error);
    process.exit(1);
  }
}

main();
