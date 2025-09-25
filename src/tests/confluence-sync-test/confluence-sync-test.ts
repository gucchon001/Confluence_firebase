/**
 * Confluence同期テストプログラム
 * 正しいデータ構造に基づく20ページのテスト
 * 
 * テスト内容:
 * 1. 新規・差分更新（pageId -> 日付比較）
 * 2. ハイブリッド検索の動作確認
 * 3. 埋め込み・ラベルロジックの検証
 */

import { ConfluenceSyncService, ConfluencePage } from '../../lib/confluence-sync-service';
import { LanceDBClient } from '../../lib/lancedb-client';
import { UnifiedEmbeddingService } from '../../lib/unified-embedding-service';
import { HybridSearchEngine } from '../../lib/hybrid-search-engine';

interface TestResult {
  syncResult: {
    added: number;
    updated: number;
    unchanged: number;
    errors: string[];
  };
  searchResults: {
    query: string;
    results: number;
    executionTime: number;
    hasLabels: boolean;
    hasVector: boolean;
  }[];
  labelStats: {
    totalLabels: number;
    uniqueLabels: string[];
    pagesWithLabels: number;
  };
  dataQuality: {
    totalChunks: number;
    totalPages: number;
    memoryUsage: number;
    hasCorrectDataTypes: boolean;
  };
}

export class ConfluenceSyncTest {
  private confluenceSyncService: ConfluenceSyncService;
  private lancedbClient: LanceDBClient;
  private embeddingService: UnifiedEmbeddingService;
  private searchEngine: HybridSearchEngine;

  constructor() {
    this.confluenceSyncService = new ConfluenceSyncService();
    this.lancedbClient = LanceDBClient.getInstance();
    this.embeddingService = UnifiedEmbeddingService.getInstance();
    this.searchEngine = new HybridSearchEngine();
  }

  /**
   * 特定のページIDのConfluenceデータを取得
   */
  async fetchSpecificPage(): Promise<ConfluencePage[]> {
    console.log('🔍 特定ページID (721125561) のConfluenceデータを取得中...');
    
    try {
      // 特定のページIDを直接取得
      const page = await this.confluenceSyncService.getConfluencePageById('721125561');
      
      if (!page) {
        throw new Error('指定されたページIDが見つかりません: 721125561');
      }

      console.log(`📄 取得したページ: ${page.title} (ID: ${page.id})`);
      return [page];
    } catch (error) {
      console.error('❌ Confluenceデータ取得エラー:', error);
      throw error;
    }
  }

  /**
   * 20ページのConfluenceデータを取得
   */
  async fetch20PagesFromConfluence(): Promise<ConfluencePage[]> {
    console.log('🔍 20ページのConfluenceデータを取得中...');
    
    try {
      const allPages: ConfluencePage[] = [];
      let start = 0;
      const limit = 10; // 一度に10ページずつ取得
      
      while (allPages.length < 20) {
        const remaining = 20 - allPages.length;
        const currentLimit = Math.min(limit, remaining);
        
        console.log(`📄 ページ ${start + 1}-${start + currentLimit} を取得中...`);
        const pages = await this.confluenceSyncService.getConfluencePages(currentLimit, start);
        
        if (pages.length === 0) {
          console.log('⚠️ これ以上ページがありません');
          break;
        }
        
        allPages.push(...pages);
        start += currentLimit;
        
        // API制限を避けるため少し待機
        if (allPages.length < 20) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`📄 取得したページ数: ${allPages.length}`);
      return allPages.slice(0, 20); // 20ページに制限
    } catch (error) {
      console.error('❌ データ取得エラー:', error);
      throw error;
    }
  }

  /**
   * ページ統計情報を表示
   */
  private displayPageStats(pages: ConfluencePage[]): void {
    console.log('\n📊 ページ統計情報:');
    console.log(`  総ページ数: ${pages.length}`);
    
    // ラベル統計
    const allLabels = new Set<string>();
    let pagesWithLabels = 0;
    
    pages.forEach(page => {
      const labels = page.metadata?.labels?.results?.map(label => label.name) || [];
      if (labels.length > 0) {
        pagesWithLabels++;
        labels.forEach(label => allLabels.add(label));
      }
    });
    
    console.log(`  ラベル付きページ数: ${pagesWithLabels}`);
    console.log(`  ユニークラベル数: ${allLabels.size}`);
    console.log(`  ラベル一覧: ${Array.from(allLabels).join(', ')}`);
    
    // スペース統計
    const spaces = new Set<string>();
    pages.forEach(page => {
      if (page.space?.key) {
        spaces.add(page.space.key);
      }
    });
    
    console.log(`  ユニークスペース数: ${spaces.size}`);
    console.log(`  スペース一覧: ${Array.from(spaces).join(', ')}`);
    
    // ページ詳細（最初の5ページ）
    console.log('\n📋 ページ詳細 (最初の5ページ):');
    pages.slice(0, 5).forEach((page, index) => {
      const labels = page.metadata?.labels?.results?.map(label => label.name) || [];
      const contentLength = page.body?.storage?.value?.length || 0;
      const wordCount = contentLength > 0 ? page.body.storage.value.split(/\s+/).length : 0;
      
      console.log(`  ${index + 1}. ${page.title}`);
      console.log(`     単語数: ${wordCount}, ラベル: ${labels.join(', ') || 'なし'}`);
    });
  }

  /**
   * データベースの状態を表示
   */
  private async displayDatabaseStatus(): Promise<void> {
    await this.lancedbClient.connect();
    const table = await this.lancedbClient.getTable();
    
    const dummyVector = new Array(768).fill(0);
    const allData = await table.search(dummyVector).limit(10000).toArray();
    
    // ラベル統計
    const allLabels = new Set<string>();
    allData.forEach((row: any) => {
      if (row.labels && Array.isArray(row.labels)) {
        row.labels.forEach((label: string) => allLabels.add(label));
      }
    });

    console.log('\n📊 データベースの状態:');
    console.log(`  総チャンク数: ${allData.length}`);
    console.log(`  ユニークラベル数: ${allLabels.size}`);
    console.log(`  ラベル一覧: ${Array.from(allLabels).join(', ')}`);

    // ページ一覧（最初の5ページ）
    const uniquePageIds = new Set<number>();
    allData.forEach((row: any) => uniquePageIds.add(row.pageId));
    
    console.log(`  ユニークページ数: ${uniquePageIds.size}`);
    console.log('\n📋 ページ一覧 (最初の5ページ):');
    allData.slice(0, 5).forEach((row: any, i: number) => {
      const labels = Array.isArray(row.labels) ? row.labels : [];
      console.log(`  PageID: ${row.pageId}, タイトル: ${row.title}, ラベル: [${labels.join(', ')}]`);
    });
  }

  /**
   * ハイブリッド検索テスト
   */
  private async testHybridSearch(): Promise<{
    query: string;
    results: number;
    executionTime: number;
    hasLabels: boolean;
    hasVector: boolean;
  }[]> {
    console.log('\n🔍 ハイブリッド検索テストを開始...');
    
    const testQueries = [
      '機能要件',
      'ワークフロー',
      'データベース',
      'セキュリティ',
      '会員管理'
    ];

    const results = [];

    for (const query of testQueries) {
      console.log(`\n🔍 検索クエリ: "${query}"`);
      const startTime = Date.now();
      
      try {
        const searchResults = await this.searchEngine.search({ query, topK: 5 });
        const executionTime = Date.now() - startTime;
        
        // データ品質チェック
        const hasLabels = searchResults.some(result => result.labels && result.labels.length > 0);
        const hasVector = searchResults.length > 0; // 結果があればベクトル検索が動作している
        
        console.log(`  結果数: ${searchResults.length}`);
        console.log(`  実行時間: ${executionTime}ms`);
        console.log(`  ラベルデータ: ${hasLabels ? '✅' : '❌'}`);
        console.log(`  ベクトル検索: ${hasVector ? '✅' : '❌'}`);
        
        // サンプル結果表示
        if (searchResults.length > 0) {
          const sample = searchResults[0];
          console.log(`  サンプル結果: ${sample.title} (PageID: ${sample.pageId})`);
        }
        
        results.push({
          query,
          results: searchResults.length,
          executionTime,
          hasLabels,
          hasVector
        });
        
      } catch (error) {
        console.error(`  検索エラー: ${error}`);
        results.push({
          query,
          results: 0,
          executionTime: Date.now() - startTime,
          hasLabels: false,
          hasVector: false
        });
      }
    }

    return results;
  }

  /**
   * ラベル統計を取得
   */
  private async getLabelStats(): Promise<{
    totalLabels: number;
    uniqueLabels: string[];
    pagesWithLabels: number;
  }> {
    await this.lancedbClient.connect();
    const table = await this.lancedbClient.getTable();
    
    const dummyVector = new Array(768).fill(0);
    const allData = await table.search(dummyVector).limit(10000).toArray();
    
    const allLabels = new Set<string>();
    let pagesWithLabels = 0;
    
    allData.forEach((row: any) => {
      if (row.labels && Array.isArray(row.labels) && row.labels.length > 0) {
        pagesWithLabels++;
        row.labels.forEach((label: string) => allLabels.add(label));
      }
    });
    
    return {
      totalLabels: allLabels.size,
      uniqueLabels: Array.from(allLabels),
      pagesWithLabels
    };
  }

  /**
   * データ品質をチェック
   */
  private async checkDataQuality(): Promise<{
    totalChunks: number;
    totalPages: number;
    memoryUsage: number;
    hasCorrectDataTypes: boolean;
  }> {
    await this.lancedbClient.connect();
    const table = await this.lancedbClient.getTable();
    
    const dummyVector = new Array(768).fill(0);
    const allData = await table.search(dummyVector).limit(10000).toArray();
    
    // データ型チェック
    let hasCorrectDataTypes = true;
    let dataTypeErrors = [];
    
    allData.forEach((row: any, index: number) => {
      if (typeof row.pageId !== 'number') {
        hasCorrectDataTypes = false;
        dataTypeErrors.push(`Row ${index}: pageId is ${typeof row.pageId}, expected number`);
      }
      if (!Array.isArray(row.labels)) {
        hasCorrectDataTypes = false;
        dataTypeErrors.push(`Row ${index}: labels is ${typeof row.labels}, expected array`);
      }
      if (typeof row.lastUpdated !== 'string') {
        hasCorrectDataTypes = false;
        dataTypeErrors.push(`Row ${index}: lastUpdated is ${typeof row.lastUpdated}, expected string`);
      }
      if (!Array.isArray(row.vector) || row.vector.length !== 768) {
        hasCorrectDataTypes = false;
        dataTypeErrors.push(`Row ${index}: vector is ${Array.isArray(row.vector) ? `array with ${row.vector.length} elements` : typeof row.vector}, expected array with 768 elements`);
      }
    });
    
    if (dataTypeErrors.length > 0) {
      console.log(`  データ型エラー詳細 (最初の5件):`);
      dataTypeErrors.slice(0, 5).forEach(error => console.log(`    ${error}`));
    }
    
    const uniquePageIds = new Set<number>();
    allData.forEach((row: any) => uniquePageIds.add(row.pageId));
    
    return {
      totalChunks: allData.length,
      totalPages: uniquePageIds.size,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      hasCorrectDataTypes
    };
  }

  /**
   * メインテスト実行
   */
  async runTest(): Promise<TestResult> {
    console.log('🚀 Confluence同期テストを開始します（特定ページID: 721125561）...\n');

    try {
      // 1. 特定のページのデータを取得
      const pages = await this.fetchSpecificPage();
      this.displayPageStats(pages);

      // 2. 初回同期を実行
      console.log('\n🔄 初回同期を実行...');
      const syncResult = await this.confluenceSyncService.syncPages(pages);
      
      console.log('\n📈 初回同期結果:');
      console.log(`  追加: ${syncResult.added}ページ`);
      console.log(`  更新: ${syncResult.updated}ページ`);
      console.log(`  変更なし: ${syncResult.unchanged}ページ`);
      console.log(`  エラー: ${syncResult.errors.length}件`);

      // 3. 同期後の状態を表示
      await this.displayDatabaseStatus();

      // 4. 2回目同期を実行（差分更新テスト）
      console.log('\n🔄 2回目同期を実行（差分更新テスト）...');
      const secondSyncResult = await this.confluenceSyncService.syncPages(pages);
      
      console.log('\n📈 2回目同期結果:');
      console.log(`  追加: ${secondSyncResult.added}ページ`);
      console.log(`  更新: ${secondSyncResult.updated}ページ`);
      console.log(`  変更なし: ${secondSyncResult.unchanged}ページ`);
      console.log(`  エラー: ${secondSyncResult.errors.length}件`);

      // 5. ハイブリッド検索テスト
      const searchResults = await this.testHybridSearch();

      // 6. ラベル統計を取得
      const labelStats = await this.getLabelStats();
      
      console.log('\n🏷️ ラベル統計:');
      console.log(`  総ラベル数: ${labelStats.totalLabels}`);
      console.log(`  ラベル付きページ数: ${labelStats.pagesWithLabels}`);
      console.log(`  ラベル一覧: ${labelStats.uniqueLabels.join(', ')}`);

      // 7. データ品質をチェック
      const dataQuality = await this.checkDataQuality();
      
      console.log('\n📊 データ品質:');
      console.log(`  総チャンク数: ${dataQuality.totalChunks}`);
      console.log(`  総ページ数: ${dataQuality.totalPages}`);
      console.log(`  メモリ使用量: ${dataQuality.memoryUsage.toFixed(2)}MB`);
      console.log(`  データ型の正確性: ${dataQuality.hasCorrectDataTypes ? '✅' : '❌'}`);

      return {
        syncResult,
        searchResults,
        labelStats,
        dataQuality
      };

    } catch (error) {
      console.error('❌ テストエラー:', error);
      throw error;
    }
  }
}

// テスト実行
async function main() {
  const test = new ConfluenceSyncTest();
  const result = await test.runTest();
  
  console.log('\n🎉 テスト完了！');
  console.log('\n📋 テスト結果サマリー:');
  console.log(`  同期成功: ${result.syncResult.added + result.syncResult.updated}ページ`);
  console.log(`  検索テスト: ${result.searchResults.length}クエリ`);
  console.log(`  ラベル機能: ${result.labelStats.totalLabels > 0 ? '✅' : '❌'}`);
  console.log(`  データ品質: ${result.dataQuality.hasCorrectDataTypes ? '✅' : '❌'}`);
}

main().catch(console.error);
