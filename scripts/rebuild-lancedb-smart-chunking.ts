/**
 * LanceDB スマート・チャンキング再構築
 * 
 * 8,192トークン以内: チャンク分割なし（98%）
 * 8,192トークン超過: チャンク分割あり（2%）
 */

import { OptimizedLanceDBClient } from '../src/lib/optimized-lancedb-client';
import { EXTENDED_LANCEDB_SCHEMA } from '../src/lib/lancedb-schema-extended';
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

// Phase 0A-4: チャンクサイズ最適化
// 参考: https://docs.databricks.com/gcp/ja/generative-ai/vector-search-best-practices
// RAG標準: 512-1,024トークン（2,000～4,000文字）
const TOKEN_LIMIT = 1024; // 最適化: 8,192 → 1,024トークン（約4,000文字）
const CHUNK_SIZE = 1600;  // 最適化: 1,800 → 1,600文字
const CHUNK_OVERLAP = 200; // 新規追加: 10-15%オーバーラップ（文脈保持）

// Phase 4: タイトル重複埋め込み（ベクトル検索での発見率向上）
const TITLE_WEIGHT = 3; // タイトルを3回繰り返してベクトル化（重み付け）

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Phase 0A-2: ページ除外フィルタリング定義
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const EXCLUDED_LABELS = ['アーカイブ', 'archive', 'フォルダ', 'スコープ外'];
const EXCLUDED_TITLE_PATTERNS = [
  '■要件定義', 
  'xxx_', 
  '【削除】', 
  '【不要】', 
  '【統合により削除】', 
  '【機能廃止のため作成停止】', 
  '【他ツールへ機能切り出しのため作成停止】'
];
const MIN_CONTENT_LENGTH = 100;

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
  // BOM文字（U+FEFF）を削除（埋め込み生成エラーを防ぐため）
  let text = html.replace(/\uFEFF/g, '');
  
  text = text
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // 念のため再度BOM文字を削除
  return text.replace(/\uFEFF/g, '');
}

/**
 * ページが除外対象かどうかをチェック
 * Phase 0A-2: オリジナル設計の除外ロジックを実装
 */
function shouldExcludePage(page: any): boolean {
  // 1. ラベルによる除外
  const labels = page.metadata?.labels?.results?.map((l: any) => l.name) || [];
  const hasExcludedLabel = labels.some((label: string) => 
    EXCLUDED_LABELS.includes(label)
  );
  
  if (hasExcludedLabel) {
    console.log(`   [除外] ラベル: ${page.title} - ${labels.join(', ')}`);
    return true;
  }
  
  // 2. タイトルパターンによる除外
  const hasExcludedTitlePattern = EXCLUDED_TITLE_PATTERNS.some(pattern => 
    page.title.includes(pattern)
  );
  
  if (hasExcludedTitlePattern) {
    console.log(`   [除外] タイトル: ${page.title}`);
    return true;
  }
  
  // 3. コンテンツ長による除外
  const content = stripHtml(page.body?.storage?.value || '');
  if (content.length < MIN_CONTENT_LENGTH) {
    console.log(`   [除外] 短いコンテンツ: ${page.title} (${content.length}文字)`);
    return true;
  }
  
  return false;
}

/**
 * テキストをチャンク分割
 */
/**
 * テキストをオーバーラップ付きでチャンク分割
 * Phase 0A-4: オーバーラップ機能を追加（文脈保持のため）
 */
function splitIntoChunks(text: string, chunkSize: number, overlap: number = CHUNK_OVERLAP): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.substring(start, end));
    
    // 次のチャンクはoverlapだけ前から開始（文脈を保持）
    start = end - overlap;
    
    // 最後のチャンクに到達した場合は終了
    if (start + chunkSize >= text.length && chunks.length > 0) {
      break;
    }
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
  // BOM文字（U+FEFF）を削除（埋め込み生成エラーを防ぐため）
  const cleanText = text.replace(/\uFEFF/g, '');
  
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  
  const result = await model.embedContent(cleanText);
  return result.embedding.values;
}

/**
 * ページを処理（スマート・チャンキング）
 * Phase 4強化: タイトル重複埋め込みでベクトル検索の精度向上
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
      
      // Phase 4: タイトル重複埋め込み（タイトルを3回繰り返してベクトル検索でヒットしやすくする）
      const weightedText = `${title}\n\n`.repeat(TITLE_WEIGHT) + plainText;
      const embedding = await generateEmbedding(weightedText);
      
      // BOM文字（U+FEFF）を削除（埋め込み生成エラーを防ぐため）
      const cleanTitle = title.replace(/\uFEFF/g, '');
      const cleanContent = plainText.replace(/\uFEFF/g, '');
      
      records.push({
        id: pageId,
        pageId: pageId, // WHERE句用
        title: cleanTitle,
        content: cleanContent,
        vector: embedding,
        isChunked: false, // チャンク統合不要フラグ
        tokenCount: estimatedTokens,
        charCount: plainText.length,
        chunkIndex: 0,
        totalChunks: 1,
        labels: (page.metadata?.labels?.results || []).map((l: any) => l.name),
        spaceKey: page.space?.key || CONFLUENCE_SPACE_KEY,
        lastUpdated: page.version?.when || new Date().toISOString(),
        // Phase 0A-2: StructuredLabelフィールド（Firestore同期前はundefined）
        structured_category: undefined,
        structured_domain: undefined,
        structured_feature: undefined,
        structured_priority: undefined,
        structured_status: undefined,
        structured_version: undefined,
        structured_tags: undefined,
        structured_confidence: undefined,
        structured_content_length: undefined,
        structured_is_valid: undefined,
      });
      
      stats.noChunkingPages++;
      stats.totalVectors++;
      
    } else {
      // チャンク分割が必要（2%のケース）
      console.log(`   [チャンク分割] ${title}: ${estimatedTokens}トークン → チャンク分割実行`);
      
      const chunks = splitIntoChunks(plainText, CHUNK_SIZE);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        // Phase 4: 各チャンクにもタイトルを重複して埋め込む
        const weightedChunk = `${title}\n\n`.repeat(TITLE_WEIGHT) + chunk;
        const embedding = await generateEmbedding(weightedChunk);
        
        // BOM文字（U+FEFF）を削除（埋め込み生成エラーを防ぐため）
        const cleanTitle = title.replace(/\uFEFF/g, '');
        const cleanChunk = chunk.replace(/\uFEFF/g, '');
        
        records.push({
          id: `${pageId}-${i}`,
          pageId: pageId, // WHERE句用
          title: cleanTitle,
          content: cleanChunk,
          vector: embedding,
          isChunked: true, // チャンク統合が必要
          tokenCount: estimateTokens(chunk),
          charCount: chunk.length,
          chunkIndex: i,
          totalChunks: chunks.length,
          labels: (page.metadata?.labels?.results || []).map((l: any) => l.name),
          spaceKey: page.space?.key || CONFLUENCE_SPACE_KEY,
          lastUpdated: page.version?.when || new Date().toISOString(),
          // Phase 0A-2: StructuredLabelフィールド（Firestore同期前はundefined）
          structured_category: undefined,
          structured_domain: undefined,
          structured_feature: undefined,
          structured_priority: undefined,
          structured_status: undefined,
          structured_version: undefined,
          structured_tags: undefined,
          structured_confidence: undefined,
          structured_content_length: undefined,
          structured_is_valid: undefined,
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
  const allPages = await fetchAllPages();
  console.log(`✅ ${allPages.length}ページ取得完了\n`);
  
  // Phase 0A-2: 除外ページのフィルタリング
  console.log('🚫 Step 1.5: 除外ページのフィルタリング中...\n');
  const beforeFiltering = allPages.length;
  const pages = allPages.filter(page => !shouldExcludePage(page));
  const excludedCount = beforeFiltering - pages.length;
  
  console.log(`\n📊 フィルタリング結果:`);
  console.log(`   取得前: ${beforeFiltering}ページ`);
  console.log(`   除外: ${excludedCount}ページ (${(excludedCount / beforeFiltering * 100).toFixed(1)}%)`);
  console.log(`   処理対象: ${pages.length}ページ\n`);
  
  stats.totalPages = pages.length;
  
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
    const fs = await import('fs');
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
    
    // Phase 0A-2: 拡張スキーマを使用（StructuredLabel統合版）
    // - 基本フィールド + StructuredLabelフィールド
    // - Firestore統合による高度なフィルタリング・スコアリング対応
    
    // 最初のバッチでテーブルを作成（拡張スキーマ指定）
    const firstBatch = validRecords.slice(0, Math.min(100, validRecords.length));
    const table = await db.createTable('confluence', firstBatch, { schema: EXTENDED_LANCEDB_SCHEMA });
    
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


