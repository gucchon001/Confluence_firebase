/**
 * 統一Confluence同期サービス
 * 
 * 正しい仕様に基づくConfluence同期機能を提供
 * 1. ページIDが存在しない場合：追加
 * 2. ページIDが存在する場合：更新日時比較
 *    - Confluenceの方が新しい場合：削除して再作成
 *    - 更新がない場合：何もしない
 */

import { LanceDBClient } from './lancedb-client';
import { UnifiedEmbeddingService } from './unified-embedding-service';
import axios from 'axios';

export interface ConfluencePage {
  id: string;
  title: string;
  body?: { storage?: { value: string; }; };
  space?: { key: string; name: string; };
  version?: { when: string; };
  metadata?: { labels?: { results: Array<{ name: string; }>; }; };
}

export interface ConfluenceChunk {
  pageId: string;
  title: string;
  content: string;
  chunkIndex: number;
  lastModified: string;
  spaceKey: string;
  embedding: number[];
}

export interface SyncResult {
  added: number;
  updated: number;
  unchanged: number;
  errors: string[];
}

export class ConfluenceSyncService {
  private lancedbClient: LanceDBClient;
  private embeddingService: UnifiedEmbeddingService;
  private baseUrl: string;
  private username: string;
  private apiToken: string;
  private spaceKey: string;

  constructor() {
    this.lancedbClient = LanceDBClient.getInstance();
    this.embeddingService = UnifiedEmbeddingService.getInstance();
    
    // 環境変数からConfluence設定を取得
    this.baseUrl = process.env.CONFLUENCE_BASE_URL || '';
    this.username = process.env.CONFLUENCE_USER_EMAIL || '';
    this.apiToken = process.env.CONFLUENCE_API_TOKEN || '';
    this.spaceKey = process.env.CONFLUENCE_SPACE_KEY || '';
  }

  /**
   * Confluence APIから全ページを取得（ページネーション対応）
   */
  async getAllConfluencePages(): Promise<ConfluencePage[]> {
    const allPages: ConfluencePage[] = [];
    let start = 0;
    const batchSize = 50;
    let hasMore = true;

    console.log('🔄 ページネーション対応で全ページを取得中...');

    while (hasMore) {
      try {
        const pages = await this.getConfluencePages(batchSize, start);
        console.log(`📥 バッチ取得: ${pages.length}ページ (start=${start}, limit=${batchSize})`);
        
        if (pages.length === 0) {
          console.log(`🔚 ページが見つかりません (start=${start}), 同期を停止`);
          hasMore = false;
          break;
        }
        
        allPages.push(...pages);
        start += pages.length;
        
        // ページネーション継続条件のチェック
        if (pages.length < batchSize) {
          console.log(`🔚 最後のバッチ: ${pages.length}ページ (バッチサイズ ${batchSize} 未満)`);
          hasMore = false;
        }
        
        console.log(`📊 累計取得ページ数: ${allPages.length}ページ`);
        
      } catch (error) {
        console.error(`❌ バッチ取得エラー (start=${start}):`, error);
        hasMore = false;
      }
    }

    console.log(`✅ 全ページ取得完了: ${allPages.length}ページ`);
    return allPages;
  }

  /**
   * Confluence APIからページを取得（単一バッチ）
   */
  async getConfluencePages(limit: number = 10, start: number = 0): Promise<ConfluencePage[]> {
    const url = `${this.baseUrl}/wiki/rest/api/content`;
    const params = new URLSearchParams({
      spaceKey: this.spaceKey,
      expand: 'body.storage,space,version,metadata.labels',
      limit: limit.toString(),
      start: start.toString()
    });

    console.log(`🔍 Confluence API URL: ${url}?${params}`);

    const response = await fetch(`${url}?${params}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${this.username}:${this.apiToken}`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Confluence API error: ${response.status} ${response.statusText}`);
      console.error(`Error details: ${errorText}`);
      throw new Error(`Confluence API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`📄 取得したページ数: ${data.results?.length || 0}`);
    return data.results || [];
  }

  /**
   * 正しい仕様に基づく同期処理
   */
  async syncPages(pages: ConfluencePage[]): Promise<SyncResult> {
    await this.lancedbClient.connect();
    const table = await this.lancedbClient.getTable();

    const results: SyncResult = { added: 0, updated: 0, unchanged: 0, errors: [] };

    console.log(`🔄 ${pages.length}ページの同期を開始します...`);

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      try {
        if (i % 100 === 0) {
          console.log(`📊 処理進行状況: ${i + 1}/${pages.length}ページ (${Math.round((i + 1) / pages.length * 100)}%)`);
        }
        const existingChunks = await this.findExistingChunks(table, page.id);

        if (existingChunks.length === 0) {
          // ページIDが存在しない場合：追加
          console.log(`➕ 新規追加: ${page.title} (${page.id})`);
          await this.addNewPage(table, page);
          results.added++;
        } else {
          // ページIDが存在する場合：更新日時を比較
          const existingLastModified = existingChunks[0].lastModified;
          const confluenceLastModified = page.version?.when || new Date().toISOString();
          
          console.log(`📅 更新日時比較:`);
          console.log(`  既存: ${existingLastModified}`);
          console.log(`  Confluence: ${confluenceLastModified}`);
          
          const existingDate = new Date(existingLastModified);
          const confluenceDate = new Date(confluenceLastModified);
          
          if (confluenceDate > existingDate) {
            // Confluenceの方が新しい場合：削除して再作成
            console.log(`🔄 更新: ${page.title} (${page.id}) - Confluenceが新しい`);
            await this.updateExistingPage(table, page, existingChunks);
            results.updated++;
          } else if (confluenceDate < existingDate) {
            // 既存の方が新しい場合：何もしない
            console.log(`⏭️ 変更なし: ${page.title} (${page.id}) - 既存が新しい`);
            results.unchanged++;
          } else {
            // 同じ日時の場合：何もしない
            console.log(`⏭️ 変更なし: ${page.title} (${page.id}) - 同じ日時`);
            results.unchanged++;
          }
        }
      } catch (error) {
        const errorMsg = `ページ ${page.id} の処理に失敗: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`❌ ${errorMsg}`);
        results.errors.push(errorMsg);
        
        // エラーが発生した場合でも処理を継続
        console.log(`⚠️ エラーが発生しましたが、処理を継続します...`);
      }
    }
    
    console.log(`✅ 全ページの処理が完了しました: ${pages.length}ページ`);
    return results;
  }

  /**
   * 既存のチャンクを検索
   */
  private async findExistingChunks(table: any, pageId: string): Promise<ConfluenceChunk[]> {
    try {
      // ダミーベクトルで検索して、pageIdでフィルタリング
      const dummyVector = new Array(768).fill(0);
      const allChunks = await table.search(dummyVector).limit(10000).toArray();
      
      const existingChunks = allChunks.filter((chunk: any) => chunk.pageId === parseInt(pageId));
      console.log(`🔍 ページID ${pageId} の既存チャンク数: ${existingChunks.length}`);
      
      return existingChunks;
    } catch (error) {
      console.error(`既存チャンクの検索に失敗: ${error}`);
      return [];
    }
  }

  /**
   * 新しいページを追加
   */
  private async addNewPage(table: any, page: ConfluencePage): Promise<void> {
    try {
      // ページを2-3チャンクに分割
      const chunks = this.splitPageIntoChunks(page);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // 埋め込みベクトルを生成
        const embedding = await this.embeddingService.generateSingleEmbedding(chunk.content);
        
        // チャンクデータを作成（LanceDBのスキーマに合わせる）
        const chunkData = {
          id: `${chunk.pageId}-${chunk.chunkIndex}`,
          pageId: parseInt(chunk.pageId),
          title: chunk.title,
          content: chunk.content,
          chunkIndex: chunk.chunkIndex,
          lastUpdated: chunk.lastModified,
          space_key: chunk.spaceKey,
          url: `${process.env.CONFLUENCE_BASE_URL}/wiki/spaces/${chunk.spaceKey}/pages/${chunk.pageId}`,
          labels: [],
          vector: embedding
        };

        // LanceDBに追加
        await table.add([chunkData]);
        console.log(`  ✅ チャンク ${i + 1}/${chunks.length} を追加: ${chunk.title}`);
      }
    } catch (error) {
      console.error(`ページ追加エラー: ${error}`);
      throw error;
    }
  }

  /**
   * 既存ページを更新（削除→再作成）
   */
  private async updateExistingPage(table: any, page: ConfluencePage, existingChunks: ConfluenceChunk[]): Promise<void> {
    try {
      console.log(`  🗑️ 既存チャンク ${existingChunks.length} 件を削除中...`);
      
      // 1. 既存のチャンクを削除
      for (const chunk of existingChunks) {
        await table.delete(`pageId = ${chunk.pageId}`);
      }
      
      console.log(`  ✅ 既存チャンクの削除完了`);
      
      // 2. 新しいチャンクを追加
      await this.addNewPage(table, page);
      
      console.log(`  ✅ ページ更新完了: ${page.title}`);
    } catch (error) {
      console.error(`ページ更新エラー: ${error}`);
      throw error;
    }
  }

  /**
   * ページをチャンクに分割
   */
  private splitPageIntoChunks(page: ConfluencePage): ConfluenceChunk[] {
    const content = page.body?.storage?.value || '';
    const title = page.title || 'No Title';
    const pageId = page.id;
    const lastModified = page.version?.when || new Date().toISOString();
    const spaceKey = page.space?.key || 'N/A';

    // 元の仕様に合わせたチャンク分割ロジック
    const chunkSize = 1800; // 元の仕様と同じ1800文字
    const chunks: ConfluenceChunk[] = [];
    let currentText = content;

    // 元の仕様と同じロジックでチャンク分割
    for (let i = 0; i < currentText.length; i += chunkSize) {
      const chunk = currentText.substring(i, i + chunkSize).trim();
      if (chunk) {
        chunks.push({
          pageId,
          title,
          content: chunk,
          chunkIndex: Math.floor(i / chunkSize),
          lastModified,
          spaceKey,
          embedding: [] // 後で埋め込みを生成
        });
      }
    }

    if (chunks.length === 0) {
      chunks.push({
        pageId,
        title,
        content: title, // コンテンツがない場合はタイトルを使用
        chunkIndex: 0,
        lastModified,
        spaceKey,
        embedding: []
      });
    }
    return chunks;
  }

  /**
   * データベースの現在の状態を表示
   */
  async showDatabaseStatus(): Promise<void> {
    await this.lancedbClient.connect();
    const table = await this.lancedbClient.getTable();
    
    const dummyVector = new Array(768).fill(0);
    const allData = await table.search(dummyVector).limit(10000).toArray();
    
    const uniquePageIds = new Set<string>();
    allData.forEach((row: any) => uniquePageIds.add(row.pageId));

    console.log(`📊 データベースの状態:`);
    console.log(`  総チャンク数: ${allData.length}`);
    console.log(`  ユニークページ数: ${uniquePageIds.size}`);
    
    console.log('\n📋 ページ一覧（最初の10件）:');
    allData.slice(0, 10).forEach((row: any, i: number) => {
      console.log(`  PageID: ${row.pageId}, タイトル: ${row.title}, チャンク数: ${allData.filter((d: any) => d.pageId === row.pageId).length}`);
    });
  }
}

// シングルトンインスタンス
export const confluenceSyncService = new ConfluenceSyncService();
