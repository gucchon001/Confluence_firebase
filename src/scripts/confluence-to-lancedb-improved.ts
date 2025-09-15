/**
 * Confluenceからデータを取得してLanceDBに保存する改良版スクリプト
 * 
 * 改良点:
 * - エラーハンドリングの強化
 * - 進捗表示の改善
 * - コンテンツの正規化（HTML特殊文字の処理）
 * - 重複チェック機能
 * - バッチ処理の最適化
 * - ログ出力の強化
 * - メモリ使用量の最適化
 * 
 * Usage: npx tsx src/scripts/confluence-to-lancedb-improved.ts [--limit N] [--batch-size N] [--space SPACE_KEY] [--vector-dim N]
 */
import 'dotenv/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as minimist from 'minimist';
import * as lancedb from '@lancedb/lancedb';

interface ConfluencePage {
  id: string;
  title: string;
  body?: { storage?: { value: string; }; };
  space?: { key: string; name: string; };
  version?: { when: string; };
  metadata?: { labels?: { results: Array<{ name: string; }>; }; };
}

interface ChunkRecord {
  id: string;
  vector: number[];
  space_key: string;
  title: string;
  labels: string[];
  content: string; // チャンクのテキスト内容
  pageId: string;
  chunkIndex: number;
  url: string;
  lastUpdated: string;
}

/**
 * HTMLからテキストを抽出する（改良版）
 */
function extractTextFromHtml(html: string): string {
  if (!html) return '';
  
  // HTML特殊文字をデコード
  const decodedHtml = html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'");
  
  // HTMLタグを削除
  const withoutTags = decodedHtml.replace(/<[^>]*>/g, ' ');
  
  // 連続する空白を1つにまとめる
  const normalizedSpaces = withoutTags.replace(/\s+/g, ' ');
  
  // 前後の空白を削除
  return normalizedSpaces.trim();
}

/**
 * テキストをチャンクに分割する（改良版）
 */
function splitTextIntoChunks(text: string, chunkSize: number = 1000, overlapSize: number = 100): string[] {
  if (!text) return [];
  
  const chunks: string[] = [];
  let position = 0;
  
  while (position < text.length) {
    // チャンクサイズ分のテキストを取得
    let chunkEnd = Math.min(position + chunkSize, text.length);
    
    // 文の途中で切れないようにする（ピリオドの後で区切る）
    if (chunkEnd < text.length) {
      const nextPeriod = text.indexOf('.', chunkEnd - 50);
      if (nextPeriod > 0 && nextPeriod < chunkEnd + 50) {
        chunkEnd = nextPeriod + 1;
      }
    }
    
    const chunk = text.substring(position, chunkEnd).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    
    // オーバーラップを考慮して次の位置を計算
    position = chunkEnd - overlapSize;
    if (position < 0) position = 0;
  }
  
  return chunks;
}

/**
 * 簡易埋め込みベクトル生成関数
 * メモリ使用量を抑えるため、固定次元のダミーベクトルを生成
 */
function generateDummyEmbedding(text: string, dimension: number = 10): number[] {
  // テキストのハッシュ値を計算
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32bit整数に変換
  }
  
  // ハッシュ値をシードとして使用し、ダミーベクトルを生成
  const vector = new Array(dimension).fill(0).map((_, i) => {
    // ハッシュとインデックスを組み合わせて疑似乱数を生成
    const value = Math.sin(hash * 0.01 + i * 0.1);
    return value;
  });
  
  // ベクトルを正規化
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0)) || 1;
  return vector.map(val => val / norm);
}

/**
 * Confluenceからデータを取得する（改良版）
 */
async function fetchConfluenceData(limit: number = 10, spaceKey?: string): Promise<ConfluencePage[]> {
  const baseUrl = process.env.CONFLUENCE_BASE_URL;
  const userEmail = process.env.CONFLUENCE_USER_EMAIL;
  const apiToken = process.env.CONFLUENCE_API_TOKEN;
  const defaultSpaceKey = process.env.CONFLUENCE_SPACE_KEY;
  
  // 指定されたspaceKeyがなければ環境変数から取得
  const targetSpaceKey = spaceKey || defaultSpaceKey;

  if (!baseUrl || !userEmail || !apiToken || !targetSpaceKey) {
    throw new Error('Confluence API認証情報またはスペースキーが環境変数に設定されていません。');
  }

  const endpoint = `${baseUrl}/wiki/rest/api/content`;
  const auth = { username: userEmail, password: apiToken };
  const params = {
    spaceKey: targetSpaceKey,
    expand: 'body.storage,metadata.labels,version,space',
    limit: Math.min(limit, 100), // APIの制限を考慮
    start: 0,
  };

  console.log(`Confluenceからデータを取得中... (スペースキー: ${targetSpaceKey}, 上限: ${limit}件)`);

  const allPages: ConfluencePage[] = [];
  let hasMore = true;
  let totalFetched = 0;

  try {
    while (hasMore && totalFetched < limit) {
      console.log(`  ${totalFetched}件取得済み... (開始位置: ${params.start})`);
      
      const response = await axios.get(endpoint, { 
        params, 
        auth, 
        timeout: 30000,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      const data = response.data;
      
      if (!data.results || !Array.isArray(data.results)) {
        console.error('  予期しないAPIレスポース形式:', data);
        throw new Error('Confluence APIから予期しないレスポース形式が返されました。');
      }
      
      allPages.push(...data.results);
      totalFetched += data.results.length;
      
      if (data.size < data.limit || totalFetched >= limit) {
        hasMore = false;
      } else {
        params.start += data.size;
      }
    }
    
    console.log(`${allPages.length}件のページを取得しました。`);
    return allPages;
  } catch (error: any) {
    console.error('Confluence APIからのデータ取得中にエラーが発生しました:', error.message);
    if (axios.isAxiosError(error) && error.response) {
      console.error('レスポンスステータス:', error.response.status);
      console.error('レスポンスデータ:', error.response.data);
    }
    throw error;
  }
}

/**
 * メインの処理
 */
async function main() {
  const argv = minimist.default(process.argv.slice(2));
  const limit = argv.limit || 10; // デフォルトは10件
  const batchSize = argv['batch-size'] || 5; // 一度に処理するページ数
  const spaceKey = argv.space; // 特定のスペースを指定（オプション）
  const vectorDim = argv['vector-dim'] || 10; // ベクトルの次元数
  
  console.log('=== Confluence → LanceDB データ同期ツール (改良版) ===');
  console.log(`設定: ベクトル次元数=${vectorDim}, バッチサイズ=${batchSize}, 上限=${limit}件`);
  
  try {
    // Firebase初期化は不要になりました
    
    // LanceDBに接続
    console.log('\nLanceDBに接続中...');
    const dbPath = path.resolve('.lancedb');
    const db = await lancedb.connect(dbPath);
    const tableName = 'test_confluence';
    
    // テーブルの存在確認
    let exists = (await db.tableNames()).includes(tableName);
    let tbl;
    
    if (exists) {
      console.log(`テーブル '${tableName}' が存在します。開きます...`);
      tbl = await db.openTable(tableName);
      const count = await tbl.countRows();
      console.log(`テーブルには現在 ${count} 行のデータがあります。`);
    } else {
      console.log(`テーブル '${tableName}' が存在しません。新規作成します...`);
      // サンプルデータでテーブルを作成
      const sampleData = [{
        id: 'sample-1',
        vector: new Array(vectorDim).fill(0).map((_, i) => Math.sin(i * 0.1)),
        space_key: 'SAMPLE',
        title: 'サンプルデータ',
        labels: ['サンプル'],
        content: 'これはサンプルデータです。',
        pageId: 'sample-page-1',
        chunkIndex: 0,
        url: 'https://example.com',
        lastUpdated: new Date().toISOString()
      }];
      tbl = await db.createTable(tableName, sampleData);
      console.log(`テーブル '${tableName}' を作成しました。`);
      exists = true;
    }
    
    // Confluenceからデータを取得
    const pages = await fetchConfluenceData(limit, spaceKey);
    
    // 既存のIDを取得（重複チェック用）
    const existingIds = new Set<string>();
    if (exists) {
      console.log('\n既存のIDを確認中...');
      try {
        // ダミーベクトルで検索して全てのIDを取得
        const dummyVector = new Array(vectorDim).fill(0);
        const results = await tbl.search(dummyVector).limit(1000).execute();
        
        // @ts-ignore - promisedInnerがプライベートプロパティだが、これを使用する
        const batchData = await results.promisedInner;
        
        if (batchData && batchData.batches && batchData.batches.length > 0) {
          for (const batch of batchData.batches) {
            if (batch && batch.numRows > 0) {
              for (let i = 0; i < batch.numRows; i++) {
                const id = batch.getChild('id')?.get(i);
                if (id) existingIds.add(id);
              }
            }
          }
        }
        console.log(`${existingIds.size}件の既存IDを確認しました。`);
      } catch (error) {
        console.warn('既存IDの取得中にエラーが発生しました。重複チェックはスキップされます:', error);
      }
    }
    
    // バッチ処理のための準備
    const totalPages = pages.length;
    const batches = [];
    for (let i = 0; i < totalPages; i += batchSize) {
      batches.push(pages.slice(i, i + batchSize));
    }
    
    console.log(`\n${totalPages}件のページを${batches.length}バッチに分けて処理します。`);
    
    // 全チャンクの数をカウント
    let totalChunksProcessed = 0;
    
    // バッチ処理
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`\nバッチ ${batchIndex + 1}/${batches.length} を処理中...`);
      
      // このバッチのチャンクレコードを格納する配列
      const batchChunkRecords: ChunkRecord[] = [];
      
      // バッチ内の各ページを処理
      for (const page of batch) {
        console.log(`ページ処理中: ${page.title} (ID: ${page.id})`);
        const htmlContent = page.body?.storage?.value;
        
        if (!htmlContent) {
          console.log('  本文がありません。スキップします。');
          continue;
        }
        
        const textContent = extractTextFromHtml(htmlContent);
        const chunks = splitTextIntoChunks(textContent);
        console.log(`  ${chunks.length}個のチャンクに分割しました。`);
        
        if (chunks.length === 0) {
          console.log('  有効なチャンクがありません。スキップします。');
          continue;
        }
        
        // 各チャンクを処理
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const chunkId = `${page.id}-${i}`;
          
          // 既存IDチェック
          if (existingIds.has(chunkId)) {
            console.log(`  チャンク ${i + 1}/${chunks.length} は既に存在します。スキップします。`);
            continue;
          }
          
          const pageUrl = `${process.env.CONFLUENCE_BASE_URL}/wiki/spaces/${page.space?.key}/pages/${page.id}`;
          
          console.log(`  チャンク ${i + 1}/${chunks.length} の埋め込みベクトルを生成中...`);
          
          try {
            // ダミー埋め込みベクトルを生成（メモリ使用量削減のため）
            const embedding = generateDummyEmbedding(chunk, vectorDim);
            
            const record: ChunkRecord = {
              id: chunkId,
              vector: embedding,
              space_key: page.space?.key || 'unknown',
              title: page.title,
              labels: page.metadata?.labels?.results?.map(l => l.name) || [],
              content: chunk.substring(0, 500), // コンテンツは500文字に制限（メモリ使用量削減）
              pageId: page.id,
              chunkIndex: i,
              url: pageUrl,
              lastUpdated: page.version?.when || new Date().toISOString(),
            };
            
            batchChunkRecords.push(record);
            
            // Firestoreへのメタデータ保存は不要になりました
          } catch (error) {
            console.error(`  埋め込みベクトル生成中にエラーが発生しました (ID: ${chunkId}):`, error);
          }
        }
      }
      
      // このバッチのチャンクをLanceDBに保存
      if (batchChunkRecords.length > 0) {
        console.log(`バッチ ${batchIndex + 1} の ${batchChunkRecords.length} 件のチャンクをLanceDBに保存中...`);
        
        try {
          await tbl.add(batchChunkRecords);
          totalChunksProcessed += batchChunkRecords.length;
          console.log(`バッチ ${batchIndex + 1} の保存が完了しました。`);
        } catch (error) {
          console.error(`バッチ ${batchIndex + 1} の保存中にエラーが発生しました:`, error);
        }
      } else {
        console.log(`バッチ ${batchIndex + 1} には保存するチャンクがありません。`);
      }
      
      // メモリリークを防ぐため、バッチ処理後に明示的にGCを実行
      if (global.gc) {
        console.log('メモリを解放中...');
        global.gc();
      }
    }
    
    console.log(`\n合計 ${totalChunksProcessed} 個のチャンクを処理しました。`);
    
    // 最終的なテーブルの行数を確認
    const finalCount = await tbl.countRows();
    console.log(`テーブルには現在 ${finalCount} 行のデータがあります。`);
    
    console.log('\n処理が完了しました。');
  } catch (error: any) {
    console.error('スクリプト実行中にエラーが発生しました:', error.message);
    process.exit(1);
  }
}

main();