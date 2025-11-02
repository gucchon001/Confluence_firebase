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
import { convertLabelsToArray, shouldExcludeByLabels } from './label-helper';
import axios from 'axios';

export interface ConfluencePage {
  id: string;
  title: string;
  content: string;
  body?: { storage?: { value: string; }; };
  space?: { key: string; name: string; };
  spaceKey?: string;
  lastModified?: string;
  url?: string;
  version?: { when: string; };
  metadata?: { labels?: { results: Array<{ name: string; }>; }; };
}

export interface ConfluenceChunk {
  pageId: number;  // LanceDBスキーマに合わせてnumber型に変更
  title: string;
  content: string;
  chunkIndex: number;
  lastUpdated: string;
  spaceKey: string;
  embedding: number[];
}

export interface SyncResult {
  added: number;
  updated: number;
  unchanged: number;
  excluded: number;
  errors: string[];
}

export class ConfluenceSyncService {
  private lancedbClient: LanceDBClient;
  private embeddingService: UnifiedEmbeddingService;
  private baseUrl: string;
  private username: string;
  private apiToken: string;
  private spaceKey: string;
  
  // 除外するラベルのリスト
  private readonly EXCLUDED_LABELS = ['アーカイブ', 'archive', 'フォルダ', 'スコープ外'];
  private readonly EXCLUDED_TITLE_PATTERNS = ['■要件定義', 'xxx_', '【削除】', '【不要】', '【統合により削除】', '【機能廃止のため作成停止】', '【他ツールへ機能切り出しのため作成停止】'];

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
   * 特定のページIDでConfluenceページを取得
   */
  async getConfluencePageById(pageId: string): Promise<ConfluencePage | null> {
    try {
      const url = `${this.baseUrl}/wiki/rest/api/content/${pageId}?expand=body.storage,version,metadata.labels,space`;
      console.log(`🔍 API呼び出しURL: ${url}`);
      console.log(`🔍 認証情報: ${this.username}:${this.apiToken ? '***設定済み***' : '未設定'}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.username}:${this.apiToken}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      });

      console.log(`🔍 レスポンスステータス: ${response.status}`);
      console.log(`🔍 レスポンスOK: ${response.ok}`);

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`⚠️ ページが見つかりません: ${pageId}`);
          return null;
        }
        const errorText = await response.text();
        console.log(`❌ エラーレスポンス: ${errorText}`);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const data = await response.json();
      
      // ConfluencePage形式に変換
      const page: ConfluencePage = {
        id: data.id,
        title: data.title,
        content: data.body?.storage?.value || '',
        lastModified: data.version?.when || new Date().toISOString(),
        spaceKey: data.space?.key || '',
        url: `${this.baseUrl}/wiki/spaces/${data.space?.key}/pages/${data.id}`,
        metadata: {
          labels: data.metadata?.labels || { results: [] }
        }
      };

      console.log(`✅ ページ取得成功: ${page.title} (ID: ${page.id})`);
      return page;
    } catch (error) {
      console.error(`❌ ページ取得エラー (ID: ${pageId}):`, error);
      return null;
    }
  }


  /**
   * Confluenceページを並列バッチで取得
   */
  async getConfluencePagesBatch(totalPages: number, batchSize: number = 50): Promise<ConfluencePage[]> {
    console.log(`🚀 並列バッチ取得を開始: 総ページ数=${totalPages}, バッチサイズ=${batchSize}`);
    
    const allPages: ConfluencePage[] = [];
    const batches: Promise<ConfluencePage[]>[] = [];
    
    // バッチを作成
    for (let start = 0; start < totalPages; start += batchSize) {
      const currentBatchSize = Math.min(batchSize, totalPages - start);
      const batchPromise = this.getConfluencePages(currentBatchSize, start);
      batches.push(batchPromise);
      
      console.log(`📦 バッチ ${Math.floor(start / batchSize) + 1}: ${start}-${start + currentBatchSize - 1}ページ`);
    }
    
    console.log(`⚡ ${batches.length}個のバッチを並列実行中...`);
    const startTime = Date.now();
    
    try {
      // 全バッチを並列実行
      const batchResults = await Promise.all(batches);
      
      // 結果をマージ
      for (const batchPages of batchResults) {
        allPages.push(...batchPages);
      }
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      console.log(`✅ 並列バッチ取得完了: ${allPages.length}ページ (${executionTime}ms)`);
      console.log(`📊 パフォーマンス: ${Math.round(allPages.length / executionTime * 1000)}ページ/秒`);
      
      return allPages;
    } catch (error) {
      console.error(`❌ 並列バッチ取得エラー: ${error}`);
      throw error;
    }
  }

  /**
   * Confluence APIから全ページを取得（ページネーション対応）
   */
  async getAllConfluencePages(maxPages: number = 1000): Promise<ConfluencePage[]> {
    const allPages: ConfluencePage[] = [];
    let start = 0;
    const limit = 50; // 50ページずつ取得
    let hasMore = true;
    
    console.log(`🚀 全ページ取得を開始: 最大${maxPages}ページ`);
    
    while (hasMore && allPages.length < maxPages) {
      try {
        console.log(`📄 ページ ${start + 1}-${start + limit} を取得中...`);
        
        const pages = await this.getConfluencePages(limit, start);
        
        if (pages.length === 0) {
          hasMore = false;
          console.log('  これ以上ページがありません');
          break;
        }
        
        allPages.push(...pages);
        console.log(`  取得したページ数: ${pages.length} (累計: ${allPages.length})`);
        
        // 取得したページ数がlimitより少ない場合は最後のページ
        if (pages.length < limit) {
          hasMore = false;
          console.log('  最後のページに到達しました');
        }
        
        start += limit;
        
        // API制限を回避するための待機
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ ページ取得エラー (start=${start}): ${error}`);
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
    
    // ConfluencePage形式に変換
    const pages: ConfluencePage[] = (data.results || []).map((item: any) => ({
      id: item.id,
      title: item.title,
      content: item.body?.storage?.value || '',
      lastModified: item.version?.when || new Date().toISOString(),
      spaceKey: item.space?.key || '',
      url: `${this.baseUrl}/wiki/spaces/${item.space?.key}/pages/${item.id}`,
      metadata: {
        labels: item.metadata?.labels || { results: [] }
      }
    }));
    
    return pages;
  }

  /**
   * ページが除外対象かどうかをチェック
   */
  private shouldExcludePage(page: ConfluencePage): boolean {
    const labels = this.extractLabelsFromPage(page);
    const hasExcludedLabel = shouldExcludeByLabels(labels, this.EXCLUDED_LABELS);
    
    if (hasExcludedLabel) {
      console.log(`🚫 除外対象: ${page.title} (${page.id}) - ラベル: [${convertLabelsToArray(labels).join(', ')}]`);
      return true;
    }
    
    // タイトルパターンで除外チェック
    const hasExcludedTitlePattern = this.EXCLUDED_TITLE_PATTERNS.some(pattern => 
      page.title.includes(pattern)
    );
    
    if (hasExcludedTitlePattern) {
      console.log(`🚫 除外対象: ${page.title} (${page.id}) - タイトルパターン: ${this.EXCLUDED_TITLE_PATTERNS.find(pattern => page.title.includes(pattern))}`);
      return true;
    }
    
    // コンテンツ長による除外（100文字未満は除外）
    const content = page.content || '';
    if (content.length < 100) {
      console.log(`🚫 除外対象: ${page.title} (${page.id}) - コンテンツが短すぎる (${content.length}文字)`);
      return true;
    }
    
    return false;
  }

  /**
   * 除外対象のページをデータベースから削除
   */
  private async removeExcludedPages(table: any): Promise<number> {
    try {
      console.log(`🧹 除外対象のページをデータベースから削除中...`);
      
      // 全チャンクを取得
      const dummyVector = new Array(768).fill(0);
      const allChunks = await table.search(dummyVector).limit(10000).toArray();
      
      let removedCount = 0;
      
      // 除外対象のラベルまたはタイトルパターンを持つチャンクを削除
      for (const chunk of allChunks) {
        let shouldRemove = false;
        let reason = '';
        
        // ラベルで除外チェック
        if (chunk.labels && Array.isArray(chunk.labels)) {
          const hasExcludedLabel = chunk.labels.some((label: string) => 
            this.EXCLUDED_LABELS.includes(label)
          );
          
          if (hasExcludedLabel) {
            shouldRemove = true;
            reason = `ラベル: [${chunk.labels.join(', ')}]`;
          }
        }
        
        // タイトルパターンで除外チェック
        if (!shouldRemove && chunk.title) {
          const hasExcludedTitlePattern = this.EXCLUDED_TITLE_PATTERNS.some(pattern => 
            chunk.title.includes(pattern)
          );
          
          if (hasExcludedTitlePattern) {
            shouldRemove = true;
            reason = `タイトルパターン: ${this.EXCLUDED_TITLE_PATTERNS.find(pattern => chunk.title.includes(pattern))}`;
          }
        }
        
        if (shouldRemove) {
          // ★★★ MIGRATION: pageId → page_id (スカラーインデックス対応) ★★★
          await table.delete(`\`page_id\` = ${chunk.pageId}`);
          console.log(`🗑️ 除外対象ページを削除: ${chunk.title} (ID: ${chunk.pageId}) - ${reason}`);
          removedCount++;
        }
      }
      
      console.log(`✅ 除外対象のページ削除完了: ${removedCount}ページ`);
      return removedCount;
    } catch (error) {
      console.error(`除外対象ページの削除に失敗: ${error}`);
      return 0;
    }
  }

  /**
   * 指定されたページ数で同期を実行
   */
  async syncPagesByCount(maxPages: number): Promise<SyncResult> {
    console.log(`🔄 ${maxPages}ページの同期を開始します...`);
    
    // ページを取得
    const pages = await this.getAllConfluencePages(maxPages);
    console.log(`📄 取得したページ数: ${pages.length}`);
    
    // 並列同期を実行
    return await this.syncPagesParallel(pages, 10);
  }

  /**
   * 並列同期処理
   */
  async syncPagesParallel(pages: ConfluencePage[], concurrency: number = 10): Promise<SyncResult> {
    await this.lancedbClient.connect();
    const table = await this.lancedbClient.getTable();

    const results: SyncResult = { added: 0, updated: 0, unchanged: 0, excluded: 0, errors: [] };

    console.log(`🔄 並列同期を開始: ${pages.length}ページ, 並列度=${concurrency}`);
    
    // まず除外対象のページをデータベースから削除
    const removedCount = await this.removeExcludedPages(table);
    console.log(`📊 除外対象ページ削除: ${removedCount}ページ`);

    // ページをチャンクに分割
    const chunks: ConfluencePage[][] = [];
    for (let i = 0; i < pages.length; i += concurrency) {
      chunks.push(pages.slice(i, i + concurrency));
    }

    console.log(`📦 ${chunks.length}個のチャンクに分割して並列処理`);

    const startTime = Date.now();

    // 各チャンクを並列処理
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`⚡ チャンク ${i + 1}/${chunks.length} を並列処理中... (${chunk.length}ページ)`);
      
      const chunkPromises = chunk.map(async (page) => {
        try {
          // 除外対象のラベルを持つページはスキップ
          if (this.shouldExcludePage(page)) {
            return { type: 'excluded', page };
          }
          
          const existingChunks = await this.findExistingChunks(table, page.id);

          if (existingChunks.length === 0) {
            // ページIDが存在しない場合：追加
            await this.addNewPage(table, page);
            return { type: 'added', page };
                 } else {
                   // ページIDが存在する場合：セット全体で更新日時を比較
                   const existingLastModified = existingChunks[0].lastUpdated;
                   const confluenceLastModified = page.lastModified || new Date().toISOString();
                   
                   const existingDate = new Date(existingLastModified);
                   const confluenceDate = new Date(confluenceLastModified);
                   
                   // より厳密な日時比較（1秒以内の差は同じとみなす）
                   const timeDiff = confluenceDate.getTime() - existingDate.getTime();
                   const isSignificantlyNewer = timeDiff > 1000; // 1秒以上新しい場合のみ更新
                   
                   if (isSignificantlyNewer) {
                     // Confluenceが1秒以上新しい場合：セット全体を削除して再作成
                     await this.updateExistingPage(table, page, existingChunks);
                     return { type: 'updated', page };
                   } else {
                     // 1秒以内の差または既存の方が新しい場合：何もしない
                     return { type: 'unchanged', page };
                   }
                 }
        } catch (error) {
          const errorMsg = `ページ ${page.id} の処理に失敗: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(`❌ ${errorMsg}`);
          return { type: 'error', page, error: errorMsg };
        }
      });

      // チャンク内の全ページを並列実行
      const chunkResults = await Promise.all(chunkPromises);
      
      // 結果を集計
      for (const result of chunkResults) {
        switch (result.type) {
          case 'added':
            results.added++;
            break;
          case 'updated':
            results.updated++;
            break;
          case 'unchanged':
            results.unchanged++;
            break;
          case 'excluded':
            results.excluded++;
            break;
          case 'error':
            results.errors.push(result.error!);
            break;
        }
      }
      
      console.log(`✅ チャンク ${i + 1} 完了: 追加=${chunkResults.filter(r => r.type === 'added').length}, 更新=${chunkResults.filter(r => r.type === 'updated').length}, 除外=${chunkResults.filter(r => r.type === 'excluded').length}`);
    }
    
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    console.log(`✅ 並列同期完了: ${pages.length}ページ (${executionTime}ms)`);
    console.log(`📊 パフォーマンス: ${Math.round(pages.length / executionTime * 1000)}ページ/秒`);
    
    return results;
  }

  /**
   * 正しい仕様に基づく同期処理
   */
  async syncPages(pages: ConfluencePage[]): Promise<SyncResult> {
    await this.lancedbClient.connect();
    const table = await this.lancedbClient.getTable();

    const results: SyncResult = { added: 0, updated: 0, unchanged: 0, excluded: 0, errors: [] };

    console.log(`🔄 ${pages.length}ページの同期を開始します...`);
    
    // まず除外対象のページをデータベースから削除
    const removedCount = await this.removeExcludedPages(table);
    console.log(`📊 除外対象ページ削除: ${removedCount}ページ`);

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      try {
        if (i % 100 === 0) {
          console.log(`📊 処理進行状況: ${i + 1}/${pages.length}ページ (${Math.round((i + 1) / pages.length * 100)}%)`);
        }
        
        // 除外対象のラベルを持つページはスキップ
        if (this.shouldExcludePage(page)) {
          results.excluded++;
          continue;
        }
        
        const existingChunks = await this.findExistingChunks(table, page.id);

        if (existingChunks.length === 0) {
          // ページIDが存在しない場合：追加
          console.log(`➕ 新規追加: ${page.title} (${page.id})`);
          await this.addNewPage(table, page);
          results.added++;
        } else {
          // ページIDが存在する場合：セット全体で更新日時を比較
          const existingLastModified = existingChunks[0].lastUpdated;
          const confluenceLastModified = page.lastModified || new Date().toISOString();
          
          console.log(`📅 セット更新日時比較:`);
          console.log(`  既存セット: ${existingChunks.length}チャンク, 最終更新: ${existingLastModified}`);
          console.log(`  Confluence: ${confluenceLastModified}`);
          
          const existingDate = new Date(existingLastModified);
          const confluenceDate = new Date(confluenceLastModified);
          
          // より厳密な日時比較（1秒以内の差は同じとみなす）
          const timeDiff = confluenceDate.getTime() - existingDate.getTime();
          const isSignificantlyNewer = timeDiff > 1000; // 1秒以上新しい場合のみ更新
          
          console.log(`  時間差: ${timeDiff}ms (閾値: 1000ms)`);
          
          if (isSignificantlyNewer) {
            // Confluenceが1秒以上新しい場合：セット全体を削除して再作成
            console.log(`🔄 セット更新: ${page.title} (${page.id}) - Confluenceが${timeDiff}ms新しい`);
            await this.updateExistingPage(table, page, existingChunks);
            results.updated++;
          } else {
            // 1秒以内の差または既存の方が新しい場合：何もしない
            console.log(`⏭️ セット変更なし: ${page.title} (${page.id}) - 時間差${timeDiff}ms（閾値内）`);
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
   * 既存のチャンクを検索（セット管理）
   */
  private async findExistingChunks(table: any, pageId: string): Promise<ConfluenceChunk[]> {
    try {
      // ダミーベクトルで検索して、pageIdでフィルタリング
      const dummyVector = new Array(768).fill(0);
      const allChunks = await table.search(dummyVector).limit(10000).toArray();
      
      // ★★★ MIGRATION: pageId → page_id (スカラーインデックス対応) ★★★
      const existingChunks = allChunks.filter((chunk: any) => chunk.page_id === parseInt(pageId));
      console.log(`🔍 ページID ${pageId} の既存チャンク数: ${existingChunks.length}`);
      
      // チャンクインデックス順にソート
      existingChunks.sort((a: any, b: any) => a.chunkIndex - b.chunkIndex);
      
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
        
        // ラベルを抽出（デバッグログ付き）
        console.log(`🔍 ページ処理開始: ${page.title}`);
        console.log(`  page.metadata:`, page.metadata);
        const labels = this.extractLabelsFromPage(page);
        console.log(`  🏷️ 抽出されたラベル: [${labels.join(', ')}]`);
        
        // チャンクデータを作成（LanceDBのスキーマに合わせる）
        const chunkData = {
          id: `${chunk.pageId}-${chunk.chunkIndex}`,
          pageId: chunk.pageId,
          title: chunk.title,
          content: chunk.content,
          chunkIndex: chunk.chunkIndex,
          lastUpdated: chunk.lastUpdated,
          space_key: chunk.spaceKey,
          url: `${process.env.CONFLUENCE_BASE_URL}/wiki/spaces/${chunk.spaceKey}/pages/${chunk.pageId}`,
          labels: labels, // 配列として保存
          vector: embedding // 768次元の配列として保存
        };

        // LanceDB公式ドキュメントに基づく正しいデータ形式（型安全性を強化）
        // ★★★ MIGRATION: pageId → page_id (スカラーインデックス対応) ★★★
        const lanceData = {
          id: String(chunkData.id),
          page_id: Number(chunkData.pageId),  // データベースフィールド名はpage_id
          title: String(chunkData.title),
          content: String(chunkData.content),
          chunkIndex: Number(chunkData.chunkIndex),
          lastUpdated: String(chunkData.lastUpdated),
          space_key: String(chunkData.space_key),
          url: String(chunkData.url),
          // ラベルを確実に配列として変換（LanceDB Arrow形式対応）
          labels: (() => {
            if (Array.isArray(chunkData.labels)) {
              return [...chunkData.labels].map(String);
            } else if (chunkData.labels && typeof chunkData.labels === 'object') {
              // Arrow Vector型の場合は明示的に配列に変換
              try {
                const labelsArray = Array.from(chunkData.labels).map(String);
                console.log(`🔍 ラベル変換結果: ${JSON.stringify(labelsArray)}`);
                return labelsArray;
              } catch (error) {
                console.log(`❌ ラベル変換エラー: ${error}`);
                return [];
              }
            } else {
              return [];
            }
          })(),
          // ベクトルを確実に配列として変換
          vector: (() => {
            if (Array.isArray(chunkData.vector)) {
              return chunkData.vector.map(Number);
            } else if (chunkData.vector && typeof chunkData.vector === 'object') {
              // オブジェクトの場合は配列に変換を試行
              return Object.values(chunkData.vector).map(Number);
            } else {
              return new Array(768).fill(0.0);
            }
          })()
        };

        // デバッグ用ログ
        if (labels.length > 0) {
          console.log(`  🏷️ ラベル抽出: ${labels.join(', ')}`);
        }
        
        // 型変換のデバッグログ
        console.log(`  🔍 型変換前 - labels: ${typeof chunkData.labels}, vector: ${typeof chunkData.vector}`);
        console.log(`  🔍 型変換後 - labels: ${typeof lanceData.labels}, vector: ${typeof lanceData.vector}`);
        console.log(`  🔍 ラベル配列確認: ${Array.isArray(lanceData.labels)}`);
        console.log(`  🔍 ベクトル配列確認: ${Array.isArray(lanceData.vector)}`);

        // LanceDBに追加（明示的な型変換）
        const finalData = {
          id: lanceData.id,
          pageId: lanceData.pageId,
          title: lanceData.title,
          content: lanceData.content,
          chunkIndex: lanceData.chunkIndex,
          lastUpdated: lanceData.lastUpdated,
          space_key: lanceData.space_key,
          url: lanceData.url,
          labels: [...lanceData.labels], // スプレッド演算子で新しい配列を作成
          vector: [...lanceData.vector]  // スプレッド演算子で新しい配列を作成
        };
        
        console.log(`  🔍 最終データ型確認 - labels: ${typeof finalData.labels}, vector: ${typeof finalData.vector}`);
        console.log(`  🔍 最終配列確認 - labels: ${Array.isArray(finalData.labels)}, vector: ${Array.isArray(finalData.vector)}`);
        
        await table.add([finalData]);
        console.log(`  ✅ チャンク ${i + 1}/${chunks.length} を追加: ${chunk.title}`);
      }
    } catch (error) {
      console.error(`ページ追加エラー: ${error}`);
      throw error;
    }
  }

  /**
   * ページからラベルを抽出
   */
  private extractLabelsFromPage(page: ConfluencePage): string[] {
    console.log(`🔍 ラベル抽出デバッグ - ページ: ${page.title}`);
    console.log(`  metadata:`, page.metadata);
    console.log(`  labels:`, page.metadata?.labels);
    console.log(`  results:`, page.metadata?.labels?.results);
    
    if (!page.metadata?.labels?.results) {
      console.log(`  ❌ ラベル情報が見つかりません`);
      return [];
    }

    const labels = page.metadata.labels.results.map(label => label.name);
    console.log(`  ✅ 抽出されたラベル:`, labels);
    return labels;
  }

  /**
   * 既存ページを更新（セット全体を削除→再作成）
   */
  private async updateExistingPage(table: any, page: ConfluencePage, existingChunks: ConfluenceChunk[]): Promise<void> {
    try {
      console.log(`  🗑️ 既存チャンクセット ${existingChunks.length} 件を削除中...`);
      
      // 1. 既存のチャンクセット全体を削除（page_idで一括削除）
      // ★★★ MIGRATION: pageId → page_id (スカラーインデックス対応) ★★★
      const targetPageId = existingChunks[0].pageId;
      const deleteResult = await table.delete(`\`page_id\` = ${targetPageId}`);
      console.log(`  ✅ 既存チャンクセットの削除完了: pageId=${targetPageId}`);
      
      // 2. 削除の確認（少し待機してから確認）
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 3. 削除が正しく実行されたか確認
      // ★★★ MIGRATION: pageId → page_id (スカラーインデックス対応) ★★★
      const { getPageIdFromRecord } = await import('./pageid-migration-helper');
      const dummyVector = new Array(768).fill(0);
      const remainingChunks = await table.search(dummyVector).limit(10000).toArray();
      const remainingPageChunks = remainingChunks.filter((chunk: any) => {
        const chunkPageId = getPageIdFromRecord(chunk) || chunk.pageId;
        return chunkPageId === targetPageId;
      });
      
      if (remainingPageChunks.length > 0) {
        console.log(`  ⚠️ 削除後も ${remainingPageChunks.length} チャンクが残存しています。強制削除を実行...`);
        
        // 個別削除を試行
        for (const chunk of remainingPageChunks) {
          try {
            await table.delete(`"id" = '${chunk.id}'`);
          } catch (error) {
            console.log(`  ⚠️ 個別削除失敗: ${chunk.id} - ${error}`);
          }
        }
        
        // 再度確認
        await new Promise(resolve => setTimeout(resolve, 100));
        const finalCheck = await table.search(dummyVector).limit(10000).toArray();
        // ★★★ MIGRATION: pageId → page_id (スカラーインデックス対応) ★★★
        const finalPageChunks = finalCheck.filter((chunk: any) => {
          const chunkPageId = getPageIdFromRecord(chunk) || chunk.pageId;
          return chunkPageId === targetPageId;
        });
        console.log(`  📊 最終確認: ${finalPageChunks.length} チャンクが残存`);
      } else {
        console.log(`  ✅ 削除確認完了: チャンクは完全に削除されました`);
      }
      
      // 4. 新しいチャンクセットを追加
      await this.addNewPage(table, page);
      
      console.log(`  ✅ ページ更新完了: ${page.title}`);
    } catch (error) {
      console.error(`ページ更新エラー: ${error}`);
      throw error;
    }
  }

  /**
   * ページをチャンクに分割（1800文字程度でセット管理）
   */
  private splitPageIntoChunks(page: ConfluencePage): ConfluenceChunk[] {
    // HTMLタグを除去してクリーンなテキストを取得
    const cleanContent = this.extractTextFromHtml(page.content || '');
    const cleanTitle = this.extractTextFromHtml(page.title || 'No Title');
    const pageId = page.id;
    const lastUpdated = page.lastModified || new Date().toISOString();
    const spaceKey = page.spaceKey || 'N/A';

    // 1800文字程度でチャンク分割（セット管理対応）
    const chunkSize = 1800;
    const chunks: ConfluenceChunk[] = [];
    let currentText = cleanContent;

    // テキストを1800文字程度で分割
    for (let i = 0; i < currentText.length; i += chunkSize) {
      const chunk = currentText.substring(i, i + chunkSize).trim();
      
      // 有効なチャンクのみを追加
      if (chunk && this.isValidChunk(chunk)) {
        chunks.push({
          pageId: parseInt(pageId), // stringからnumberに変換
          title: cleanTitle,
          content: chunk,
          chunkIndex: Math.floor(i / chunkSize), // 枝番（0, 1, 2, ...）
          lastUpdated,
          spaceKey,
          embedding: [] // 後で埋め込みを生成
        });
      }
    }

    // コンテンツがない場合はタイトルを1チャンクとして追加
    if (chunks.length === 0) {
      chunks.push({
        pageId: parseInt(pageId), // stringからnumberに変換
        title: cleanTitle,
        content: cleanTitle, // コンテンツがない場合はタイトルを使用
        chunkIndex: 0, // 枝番0
        lastUpdated,
        spaceKey,
        embedding: []
      });
    }

    console.log(`  📝 チャンク分割完了: ${chunks.length}チャンク (pageId: ${pageId})`);
    return chunks;
  }

  /**
   * HTMLからテキストを抽出する
   */
  private extractTextFromHtml(html: string): string {
    if (!html) return '';
    
    // HTML特殊文字をデコード
    const htmlEntities: { [key: string]: string } = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&nbsp;': ' ',
      '&apos;': "'"
    };
    
    let text = html;
    for (const [entity, char] of Object.entries(htmlEntities)) {
      text = text.replace(new RegExp(entity, 'g'), char);
    }
    
    // HTMLタグを削除して空白に置換
    const withoutTags = text.replace(/<[^>]*>/g, ' ');
    
    // 連続する空白を1つにまとめる
    const normalizedSpaces = withoutTags.replace(/\s+/g, ' ');
    
    // 前後の空白を削除
    return normalizedSpaces.trim();
  }

  /**
   * チャンクが有効かどうかを判定
   */
  private isValidChunk(chunk: string): boolean {
    // 空文字列チェック
    if (!chunk || chunk.trim().length === 0) {
      return false;
    }
    
    // HTMLタグのみのチャンクを除外
    const textContent = chunk.replace(/<[^>]*>/g, '').trim();
    if (textContent.length < 20) {
      return false;
    }
    
    // 最小文字数チェック（100文字以上）
    if (chunk.length < 100) {
      return false;
    }
    
    return true;
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
