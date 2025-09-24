/**
 * 正しい同期仕様のテスト
 * 
 * 仕様：
 * 1. ページIDが存在しない場合：追加
 * 2. ページIDが存在する場合：更新日時比較
 *    - Confluenceの方が新しい場合：削除して再作成
 *    - 更新がない場合：何もしない
 */

import { LanceDBClient } from '../lib/lancedb-client';
import { UnifiedEmbeddingService } from '../lib/unified-embedding-service';

interface TestPage {
  id: string;
  title: string;
  content: string;
  lastModified: string;
  spaceKey: string;
}

interface TestChunk {
  pageId: string;
  title: string;
  content: string;
  chunkIndex: number;
  lastModified: string;
  embedding: number[];
}

class CorrectSyncService {
  private lancedbClient: LanceDBClient;
  private embeddingService: UnifiedEmbeddingService;

  constructor() {
    this.lancedbClient = LanceDBClient.getInstance();
    this.embeddingService = UnifiedEmbeddingService.getInstance();
  }

  /**
   * 正しい仕様に基づく同期処理
   */
  async syncPages(pages: TestPage[]): Promise<{
    added: number;
    updated: number;
    unchanged: number;
    errors: string[];
  }> {
    await this.lancedbClient.connect();
    const table = await this.lancedbClient.getTable();
    
    const results = {
      added: 0,
      updated: 0,
      unchanged: 0,
      errors: [] as string[]
    };

    console.log(`🔄 ${pages.length}ページの同期を開始します...`);

    for (const page of pages) {
      try {
        // 1. 既存のページを検索
        const existingChunks = await this.findExistingChunks(table, page.id);
        
        if (existingChunks.length === 0) {
          // ページIDが存在しない場合：追加
          console.log(`➕ 新規追加: ${page.title} (${page.id})`);
          await this.addNewPage(table, page);
          results.added++;
        } else {
          // ページIDが存在する場合：更新日時を比較
          const existingLastModified = existingChunks[0].lastModified;
          
          if (new Date(page.lastModified) > new Date(existingLastModified)) {
            // Confluenceの方が新しい場合：削除して再作成
            console.log(`🔄 更新: ${page.title} (${page.id})`);
            await this.updateExistingPage(table, page, existingChunks);
            results.updated++;
          } else {
            // 更新がない場合：何もしない
            console.log(`⏭️ 変更なし: ${page.title} (${page.id})`);
            results.unchanged++;
          }
        }
      } catch (error) {
        const errorMsg = `ページ ${page.id} の処理に失敗: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`❌ ${errorMsg}`);
        results.errors.push(errorMsg);
      }
    }

    return results;
  }

  /**
   * 既存のチャンクを検索
   */
  private async findExistingChunks(table: any, pageId: string): Promise<TestChunk[]> {
    try {
      // ダミーベクトルで検索して、pageIdでフィルタリング
      const dummyVector = new Array(768).fill(0);
      const allChunks = await table.search(dummyVector).limit(10000).toArray();
      
      return allChunks.filter((chunk: any) => chunk.pageId === pageId);
    } catch (error) {
      console.error(`既存チャンクの検索に失敗: ${error}`);
      return [];
    }
  }

  /**
   * 新しいページを追加
   */
  private async addNewPage(table: any, page: TestPage): Promise<void> {
    // ページを2-3チャンクに分割
    const chunks = this.splitPageIntoChunks(page);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // 埋め込みベクトルを生成
      const embedding = await this.embeddingService.generateSingleEmbedding(chunk.content);
      
      // チャンクデータを作成
      const chunkData = {
        pageId: chunk.pageId,
        title: chunk.title,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        lastModified: chunk.lastModified,
        spaceKey: page.spaceKey,
        embedding: embedding
      };

      // LanceDBに追加
      await table.add([chunkData]);
    }
  }

  /**
   * 既存ページを更新（削除→再作成）
   */
  private async updateExistingPage(table: any, page: TestPage, existingChunks: TestChunk[]): Promise<void> {
    // 1. 既存のチャンクを削除
    for (const chunk of existingChunks) {
      await table.delete(`pageId = '${chunk.pageId}'`);
    }
    
    // 2. 新しいチャンクを追加
    await this.addNewPage(table, page);
  }

  /**
   * ページをチャンクに分割
   */
  private splitPageIntoChunks(page: TestPage): TestChunk[] {
    const chunks: TestChunk[] = [];
    const content = page.content;
    const chunkSize = Math.ceil(content.length / 3); // 3チャンクに分割
    
    for (let i = 0; i < 3; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, content.length);
      const chunkContent = content.substring(start, end);
      
      if (chunkContent.trim()) {
        chunks.push({
          pageId: page.id,
          title: page.title,
          content: chunkContent,
          chunkIndex: i,
          lastModified: page.lastModified
        });
      }
    }
    
    return chunks;
  }

  /**
   * データベースの状態を表示
   */
  async showDatabaseStatus(): Promise<void> {
    await this.lancedbClient.connect();
    const table = await this.lancedbClient.getTable();
    
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    
    // ページIDごとにグループ化
    const pageGroups = new Map<string, any[]>();
    allChunks.forEach((chunk: any) => {
      if (!pageGroups.has(chunk.pageId)) {
        pageGroups.set(chunk.pageId, []);
      }
      pageGroups.get(chunk.pageId)!.push(chunk);
    });
    
    console.log(`\n📊 データベースの状態:`);
    console.log(`  総チャンク数: ${allChunks.length}`);
    console.log(`  ユニークページ数: ${pageGroups.size}`);
    
    console.log(`\n📋 ページ一覧:`);
    for (const [pageId, chunks] of pageGroups) {
      console.log(`  PageID: ${pageId}, タイトル: ${chunks[0].title}, チャンク数: ${chunks.length}`);
    }
  }
}

export { CorrectSyncService, TestPage, TestChunk };
