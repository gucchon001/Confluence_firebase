/**
 * LanceDB スマート・チャンキング再構築
 * 
 * 8,192トークン以内: チャンク分割なし（98%）
 * 8,192トークン超過: チャンク分割あり（2%）
 */

import { OptimizedLanceDBClient } from '../src/lib/optimized-lancedb-client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as arrow from 'apache-arrow';

dotenv.config();

const CONFLUENCE_BASE_URL = process.env.CONFLUENCE_BASE_URL || '';
const CONFLUENCE_USER_EMAIL = process.env.CONFLUENCE_USER_EMAIL || '';
const CONFLUENCE_API_TOKEN = process.env.CONFLUENCE_API_TOKEN || '';
const CONFLUENCE_SPACE_KEY = process.env.CONFLUENCE_SPACE_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const TOKEN_LIMIT = 8192; // 実際の上限
const CHUNK_SIZE = 1800; // チャンク分割時のサイズ

interface ProcessingStats {
  totalPages: number;
  noChunkingPages: number;
  chunkingPages: number;
  totalVectors: number;
  errors: number;
  startTime: number;
}

/**
 * トークン数を推定
 */
function estimateTokens(text: string): number {
  const ascii = text.match(/[a-zA-Z0-9\s\p{P}]/gu)?.length || 0;
  const japanese = text.length - ascii;
  return Math.ceil(ascii * 0.5 + japanese * 1.8);
}

/**
 * HTMLタグを削除
 */
function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * テキストをチャンク分割
 */
function splitIntoChunks(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.substring(start, end));
    start = end;
  }
  
  return chunks;
}

/**
 * Confluenceページを取得
 */
async function fetchAllPages(): Promise<any[]> {
  const auth = Buffer.from(`${CONFLUENCE_USER_EMAIL}:${CONFLUENCE_API_TOKEN}`).toString('base64');
  const allPages: any[] = [];
  let start = 0;
  const limit = 100;
  
  while (true) {
    const response = await axios.get(
      `${CONFLUENCE_BASE_URL}/wiki/rest/api/content`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
        },
        params: {
          spaceKey: CONFLUENCE_SPACE_KEY,
          limit: limit,
          start: start,
          expand: 'body.storage,space,version,metadata.labels',
          type: 'page',
        },
      }
    );
    
    const pages = response.data.results;
    allPages.push(...pages);
    
    if (pages.length < limit) break;
    start += limit;
    
    console.log(`   取得中: ${allPages.length}ページ...`);
  }
  
  return allPages;
}

/**
 * 埋め込みベクトルを生成
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  
  const result = await model.embedContent(text);
  return result.embedding.values;
}

/**
 * ページを処理（スマート・チャンキング）
 */
async function processPage(page: any, stats: ProcessingStats): Promise<any[]> {
  const pageId = page.id;
  const title = page.title || 'Untitled';
  const bodyHtml = page.body?.storage?.value || '';
  const plainText = stripHtml(bodyHtml);
  
  if (plainText.length < 100) {
    console.log(`   [スキップ] ${title}: コンテンツが短すぎる (${plainText.length}文字)`);
    return [];
  }
  
  const estimatedTokens = estimateTokens(plainText);
  const records: any[] = [];
  
  try {
    if (estimatedTokens <= TOKEN_LIMIT) {
      // チャンク分割不要（98%のケース）
      console.log(`   [一括処理] ${title}: ${estimatedTokens}トークン (${plainText.length}文字)`);
      
      const embedding = await generateEmbedding(plainText);
      
      records.push({
        id: pageId,
        pageId: pageId, // WHERE句用
        title: title,
        content: plainText,
        vector: embedding,
        isChunked: false, // チャンク統合不要フラグ
        tokenCount: estimatedTokens,
        charCount: plainText.length,
        chunkIndex: 0,
        totalChunks: 1,
        spaceKey: page.space?.key || CONFLUENCE_SPACE_KEY,
        lastUpdated: page.version?.when || new Date().toISOString(),
        labels: (page.metadata?.labels?.results || []).map((l: any) => l.name),
      });
      
      stats.noChunkingPages++;
      stats.totalVectors++;
      
    } else {
      // チャンク分割が必要（2%のケース）
      console.log(`   [チャンク分割] ${title}: ${estimatedTokens}トークン → チャンク分割実行`);
      
      const chunks = splitIntoChunks(plainText, CHUNK_SIZE);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await generateEmbedding(chunk);
        
        records.push({
          id: `${pageId}-${i}`,
          pageId: pageId, // WHERE句用
          title: title,
          content: chunk,
          vector: embedding,
          isChunked: true, // チャンク統合が必要
          tokenCount: estimateTokens(chunk),
          charCount: chunk.length,
          chunkIndex: i,
          totalChunks: chunks.length,
          spaceKey: page.space?.key || CONFLUENCE_SPACE_KEY,
          lastUpdated: page.version?.when || new Date().toISOString(),
          labels: (page.metadata?.labels?.results || []).map((l: any) => l.name),
        });
        
        stats.totalVectors++;
        
        // レート制限対策
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`     → ${chunks.length}チャンクに分割`);
      stats.chunkingPages++;
    }
    
  } catch (error: any) {
    console.error(`   [エラー] ${title}: ${error.message}`);
    stats.errors++;
  }
  
  return records;
}

/**
 * メイン処理
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║       LanceDB スマート・チャンキング再構築                              ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝\n');
  
  const stats: ProcessingStats = {
    totalPages: 0,
    noChunkingPages: 0,
    chunkingPages: 0,
    totalVectors: 0,
    errors: 0,
    startTime: Date.now(),
  };
  
  // Step 1: Confluenceページ取得
  console.log('📥 Step 1: Confluenceページを取得中...');
  const pages = await fetchAllPages();
  
  stats.totalPages = pages.length;
  console.log(`✅ ${pages.length}ページ取得完了\n`);
  
  // Step 2: ページを処理
  console.log('🔄 Step 2: ページを処理中（スマート・チャンキング）...\n');
  
  const allRecords: any[] = [];
  
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    console.log(`[${i + 1}/${pages.length}] 処理中: ${page.title}`);
    
    const records = await processPage(page, stats);
    allRecords.push(...records);
    
    // 進捗を表示
    if ((i + 1) % 10 === 0 || (i + 1) === pages.length) {
      const progress = ((i + 1) / pages.length * 100).toFixed(1);
      const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(0);
      const rate = ((i + 1) / (Date.now() - stats.startTime) * 1000).toFixed(2);
      console.log(`\n   進捗: ${progress}% (${i + 1}/${pages.length}) - ${elapsed}秒経過 - ${rate}ページ/秒\n`);
    }
    
    // レート制限対策
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log('\n✅ ページ処理完了\n');
  
  // Step 3: LanceDBに保存
  console.log('💾 Step 3: LanceDBに保存中...');
  
  if (allRecords.length === 0) {
    console.log('❌ レコードがありません。保存をスキップします。');
    return;
  }
  
  // null値を持つレコードを除外（ベクトル検証）
  const validRecords = allRecords.filter((record, idx) => {
    if (!record.vector) {
      console.log(`   [警告] ベクトルがnull: ${record.title}`);
      return false;
    }
    
    // tokenCount, charCountを削除（パフォーマンス重視）
    delete record.tokenCount;
    delete record.charCount;
    return true;
  });
  
  console.log(`   有効なレコード: ${validRecords.length}/${allRecords.length}\n`);
  
  if (validRecords.length === 0) {
    console.log('❌ 有効なレコードがありません。保存をスキップします。');
    return;
  }
  
  try {
    // 既存のテーブルをバックアップ
    console.log('   既存データをバックアップ中...');
    const backupPath = `.lancedb.backup.${Date.now()}`;
    if (fs.existsSync('.lancedb')) {
      fs.cpSync('.lancedb', backupPath, { recursive: true });
      console.log(`   ✅ バックアップ完了: ${backupPath}`);
    }
    
    // 新しいテーブルを作成
    console.log('   新しいLanceDBテーブルを作成中...');
    const client = OptimizedLanceDBClient.getInstance();
    
    // 既存の接続をリセット
    client.resetConnection();
    
    // 既存の接続を完全にクローズ
    await client.disconnect();
    
    // .lancedbディレクトリを削除
    if (fs.existsSync('.lancedb')) {
      fs.rmSync('.lancedb', { recursive: true, force: true });
    }
    
    // 少し待機（ファイルシステムの同期）
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 直接LanceDBに接続（OptimizedLanceDBClientの自動作成を回避）
    const lancedb = await import('@lancedb/lancedb');
    const db = await lancedb.connect('.lancedb');
    
    // 最適化されたスキーマ定義
    // パフォーマンス重視: pageId（WHERE句用）、isChunked（チャンク統合判定）
    // 型安全性: 厳格なnullable/non-nullable設定
    const schema = new arrow.Schema([
      // コアフィールド（すべてnon-nullable）
      new arrow.Field('id', new arrow.Utf8(), false),
      new arrow.Field('pageId', new arrow.Utf8(), false),        // WHERE句フィルタリング用
      new arrow.Field('title', new arrow.Utf8(), false),
      new arrow.Field('content', new arrow.Utf8(), false),
      new arrow.Field('vector', new arrow.FixedSizeList(768, new arrow.Field('item', new arrow.Float32())), false),  // Gemini Embedding: 768次元
      
      // パフォーマンスフラグ（non-nullable）
      new arrow.Field('isChunked', new arrow.Bool(), false),     // チャンク統合判定フラグ
      
      // チャンク情報（non-nullable: 0/1でデフォルト値）
      new arrow.Field('chunkIndex', new arrow.Int32(), false),
      new arrow.Field('totalChunks', new arrow.Int32(), false),
      
      // メタデータ（nullable: 空の可能性あり）
      new arrow.Field('labels', new arrow.List(new arrow.Field('item', new arrow.Utf8())), true),
      
      // スペース・更新日時（non-nullable）
      new arrow.Field('spaceKey', new arrow.Utf8(), false),
      new arrow.Field('lastUpdated', new arrow.Utf8(), false),
    ]);
    
    // 最初のバッチでテーブルを作成（スキーマ指定）
    const firstBatch = validRecords.slice(0, Math.min(100, validRecords.length));
    const table = await db.createTable('confluence', firstBatch, { schema });
    
    console.log(`   ✅ テーブル作成完了（${firstBatch.length}レコード）`);
    
    // 残りのレコードを追加（バッチ処理）
    const batchSize = 100;
    if (validRecords.length > firstBatch.length) {
      for (let i = firstBatch.length; i < validRecords.length; i += batchSize) {
        const batch = validRecords.slice(i, Math.min(i + batchSize, validRecords.length));
        
        await table.add(batch);
        
        console.log(`   保存中: ${Math.min(i + batchSize, validRecords.length)}/${validRecords.length}レコード`);
      }
    }
    
    console.log('✅ LanceDB保存完了\n');
    
  } catch (error: any) {
    console.error('❌ LanceDB保存エラー:', error.message);
    console.error('   バックアップから復元してください');
    throw error;
  }
  
  // 結果サマリー
  const elapsed = (Date.now() - stats.startTime) / 1000;
  
  console.log('━'.repeat(120));
  console.log('📊 処理結果サマリー');
  console.log('━'.repeat(120));
  console.log(`総ページ数:                    ${stats.totalPages.toLocaleString()}ページ`);
  console.log(`チャンク分割なし:               ${stats.noChunkingPages.toLocaleString()}ページ (${(stats.noChunkingPages / stats.totalPages * 100).toFixed(1)}%)`);
  console.log(`チャンク分割あり:               ${stats.chunkingPages.toLocaleString()}ページ (${(stats.chunkingPages / stats.totalPages * 100).toFixed(1)}%)`);
  console.log(`総ベクトル数:                  ${stats.totalVectors.toLocaleString()}個`);
  console.log(`エラー:                        ${stats.errors}件`);
  console.log(`処理時間:                      ${elapsed.toFixed(0)}秒 (${(elapsed / 60).toFixed(1)}分)`);
  console.log(`平均処理速度:                  ${(stats.totalPages / elapsed).toFixed(2)}ページ/秒`);
  console.log('━'.repeat(120));
  console.log('');
  
  console.log('💡 期待される効果:');
  console.log(`   - チャンク統合が不要: ${stats.noChunkingPages}ページ (${(stats.noChunkingPages / stats.totalPages * 100).toFixed(1)}%)`);
  console.log(`   - 検索速度改善: 50秒 → 5-8秒（推定）`);
  console.log('   - チャンク統合処理の削減により大幅な高速化\n');
  
  console.log('✅ LanceDB再構築完了\n');
}

main().catch(console.error);


