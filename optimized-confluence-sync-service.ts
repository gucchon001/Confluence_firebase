/**
 * 最適化されたConfluence同期サービス
 * バッチクエリ、キャッシュ、並列処理による高速化を実装
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';

interface OptimizedSyncConfig {
  batchSize: number;
  concurrency: number;
  enableCache: boolean;
  enablePreFiltering: boolean;
  enableParallelFiltering: boolean;
}

interface SyncResult {
  totalPages: number;
  newPages: number;
  updatedPages: number;
  skippedPages: number;
  excludedPages: number;
  processingTime: number;
  performanceGain: number;
}

class OptimizedConfluenceSyncService extends ConfluenceSyncService {
  private existingPageCache: Set<string> = new Set();
  private cacheInitialized: boolean = false;
  private config: OptimizedSyncConfig;

  constructor(config?: Partial<OptimizedSyncConfig>) {
    super();
    this.config = {
      batchSize: 50,
      concurrency: 10,
      enableCache: true,
      enablePreFiltering: true,
      enableParallelFiltering: true,
      ...config
    };
  }

  /**
   * 既存ページIDキャッシュを初期化
   */
  private async initializeCache(): Promise<void> {
    if (!this.config.enableCache || this.cacheInitialized) {
      return;
    }

    console.log('📦 既存ページIDキャッシュを初期化中...');
    const startTime = Date.now();

    try {
      const table = await this.lancedbClient.getTable();
      const dummyVector = new Array(768).fill(0);
      const allChunks = await table.search(dummyVector).limit(10000).toArray();
      
      // 既存ページIDをキャッシュに追加
      allChunks.forEach((chunk: any) => {
        this.existingPageCache.add(chunk.pageId.toString());
      });

      const endTime = Date.now();
      console.log(`✅ キャッシュ初期化完了: ${this.existingPageCache.size}ページ (${endTime - startTime}ms)`);
      this.cacheInitialized = true;
    } catch (error) {
      console.error('❌ キャッシュ初期化エラー:', error);
    }
  }

  /**
   * バッチで既存ページをチェック
   */
  private async batchCheckExistingPages(pageIds: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    if (this.config.enableCache && this.cacheInitialized) {
      // キャッシュを使用した高速チェック
      pageIds.forEach(pageId => {
        results.set(pageId, this.existingPageCache.has(pageId));
      });
      return results;
    }

    // データベースからバッチクエリ
    try {
      const table = await this.lancedbClient.getTable();
      const dummyVector = new Array(768).fill(0);
      const allChunks = await table.search(dummyVector).limit(10000).toArray();
      
      const existingPageIds = new Set(
        allChunks.map((chunk: any) => chunk.pageId.toString())
      );
      
      pageIds.forEach(pageId => {
        results.set(pageId, existingPageIds.has(pageId));
      });
    } catch (error) {
      console.error('❌ バッチチェックエラー:', error);
      // エラーの場合は全て新規として扱う
      pageIds.forEach(pageId => {
        results.set(pageId, false);
      });
    }

    return results;
  }

  /**
   * 並列フィルタリング
   */
  private async parallelFilterPages(pages: any[]): Promise<{
    included: any[];
    excluded: any[];
  }> {
    if (!this.config.enableParallelFiltering) {
      // シーケンシャルフィルタリング
      const included: any[] = [];
      const excluded: any[] = [];
      
      pages.forEach(page => {
        if (this.shouldExcludePage(page)) {
          excluded.push(page);
        } else {
          included.push(page);
        }
      });
      
      return { included, excluded };
    }

    // 並列フィルタリング
    const chunkSize = Math.ceil(pages.length / this.config.concurrency);
    const chunks = [];
    
    for (let i = 0; i < pages.length; i += chunkSize) {
      chunks.push(pages.slice(i, i + chunkSize));
    }

    const filterPromises = chunks.map(async (chunk) => {
      const included: any[] = [];
      const excluded: any[] = [];
      
      chunk.forEach(page => {
        if (this.shouldExcludePage(page)) {
          excluded.push(page);
        } else {
          included.push(page);
        }
      });
      
      return { included, excluded };
    });

    const results = await Promise.all(filterPromises);
    
    const included = results.flatMap(r => r.included);
    const excluded = results.flatMap(r => r.excluded);
    
    return { included, excluded };
  }

  /**
   * 最適化された同期処理
   */
  async optimizedSyncPages(maxPages: number = 1143): Promise<SyncResult> {
    console.log('🚀 最適化された同期処理を開始します...');
    const startTime = Date.now();

    try {
      // 1. キャッシュ初期化
      await this.initializeCache();

      // 2. 全ページ取得
      console.log(`📄 全ページ取得中... (最大${maxPages}ページ)`);
      const allPages = await this.getAllConfluencePages(maxPages);
      console.log(`✅ ${allPages.length}ページを取得しました`);

      // 3. 事前フィルタリング
      console.log('🚫 除外ページのフィルタリング中...');
      const { included: filteredPages, excluded: excludedPages } = 
        await this.parallelFilterPages(allPages);
      
      console.log(`- 対象ページ: ${filteredPages.length}件`);
      console.log(`- 除外ページ: ${excludedPages.length}件`);
      console.log(`- 除外率: ${((excludedPages.length / allPages.length) * 100).toFixed(1)}%`);

      // 4. バッチで既存ページチェック
      console.log('🔍 既存ページのバッチチェック中...');
      const pageIds = filteredPages.map(page => page.id.toString());
      const batchSize = this.config.batchSize;
      const batches = [];
      
      for (let i = 0; i < pageIds.length; i += batchSize) {
        batches.push(pageIds.slice(i, i + batchSize));
      }

      const existingPageMap = new Map<string, boolean>();
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`  バッチ ${i + 1}/${batches.length}: ${batch.length}ページをチェック中...`);
        
        const batchResults = await this.batchCheckExistingPages(batch);
        batchResults.forEach((exists, pageId) => {
          existingPageMap.set(pageId, exists);
        });
      }

      // 5. ページを分類
      const newPages: any[] = [];
      const existingPages: any[] = [];
      
      filteredPages.forEach(page => {
        const pageId = page.id.toString();
        if (existingPageMap.get(pageId)) {
          existingPages.push(page);
        } else {
          newPages.push(page);
        }
      });

      console.log(`- 新規ページ: ${newPages.length}件`);
      console.log(`- 既存ページ: ${existingPages.length}件`);

      // 6. 並列処理で同期実行
      console.log('⚡ 並列同期処理を開始します...');
      const table = await this.lancedbClient.getTable();
      
      let processedNew = 0;
      let processedExisting = 0;
      let skipped = 0;

      // 新規ページの並列処理
      if (newPages.length > 0) {
        console.log(`📝 新規ページの同期中... (${newPages.length}件)`);
        const newPageBatches = [];
        for (let i = 0; i < newPages.length; i += this.config.batchSize) {
          newPageBatches.push(newPages.slice(i, i + this.config.batchSize));
        }

        for (const batch of newPageBatches) {
          const batchPromises = batch.map(async (page) => {
            try {
              await this.addNewPage(table, page);
              return { type: 'added', page };
            } catch (error) {
              console.error(`新規ページ追加エラー: ${page.id} - ${error}`);
              return { type: 'error', page, error };
            }
          });

          const batchResults = await Promise.all(batchPromises);
          processedNew += batchResults.filter(r => r.type === 'added').length;
        }
      }

      // 既存ページの並列処理（更新が必要なもののみ）
      if (existingPages.length > 0) {
        console.log(`🔄 既存ページの更新チェック中... (${existingPages.length}件)`);
        
        const existingPageBatches = [];
        for (let i = 0; i < existingPages.length; i += this.config.batchSize) {
          existingPageBatches.push(existingPages.slice(i, i + this.config.batchSize));
        }

        for (const batch of existingPageBatches) {
          const batchPromises = batch.map(async (page) => {
            try {
              const existingChunks = await this.findExistingChunks(table, page.id);
              if (existingChunks.length === 0) {
                await this.addNewPage(table, page);
                return { type: 'added', page };
              }

              const existingLastModified = existingChunks[0].lastUpdated;
              const confluenceLastModified = page.lastModified || new Date().toISOString();
              
              const existingDate = new Date(existingLastModified);
              const confluenceDate = new Date(confluenceLastModified);
              const timeDiff = confluenceDate.getTime() - existingDate.getTime();
              const isSignificantlyNewer = timeDiff > 1000;

              if (isSignificantlyNewer) {
                await this.updateExistingPage(table, page, existingChunks);
                return { type: 'updated', page };
              } else {
                return { type: 'skipped', page };
              }
            } catch (error) {
              console.error(`既存ページ処理エラー: ${page.id} - ${error}`);
              return { type: 'error', page, error };
            }
          });

          const batchResults = await Promise.all(batchPromises);
          processedExisting += batchResults.filter(r => r.type === 'updated').length;
          skipped += batchResults.filter(r => r.type === 'skipped').length;
        }
      }

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // 7. 結果サマリー
      const result: SyncResult = {
        totalPages: allPages.length,
        newPages: processedNew,
        updatedPages: processedExisting,
        skippedPages: skipped,
        excludedPages: excludedPages.length,
        processingTime,
        performanceGain: 0 // 後で計算
      };

      console.log('\n🎉 最適化された同期処理が完了しました！');
      console.log('='.repeat(60));
      console.log('📊 同期結果サマリー:');
      console.log(`- 総ページ数: ${result.totalPages}`);
      console.log(`- 新規追加: ${result.newPages}件`);
      console.log(`- 更新: ${result.updatedPages}件`);
      console.log(`- スキップ: ${result.skippedPages}件`);
      console.log(`- 除外: ${result.excludedPages}件`);
      console.log(`- 処理時間: ${(result.processingTime / 1000).toFixed(2)}秒`);
      console.log(`- 除外率: ${((result.excludedPages / result.totalPages) * 100).toFixed(1)}%`);
      
      return result;

    } catch (error) {
      console.error('❌ 同期処理中にエラーが発生しました:', error);
      throw error;
    }
  }

  /**
   * パフォーマンス比較テスト
   */
  async performanceComparisonTest(maxPages: number = 100): Promise<void> {
    console.log('🏁 パフォーマンス比較テストを開始します...');
    
    // 1. 最適化前の処理時間測定
    console.log('\n⏱️ 最適化前の処理時間を測定中...');
    const originalStartTime = Date.now();
    
    const originalPages = await this.getAllConfluencePages(maxPages);
    const originalFiltered = originalPages.filter(page => !this.shouldExcludePage(page));
    
    // 既存ページチェック（個別）
    for (const page of originalFiltered.slice(0, 20)) {
      await this.findExistingChunks(await this.lancedbClient.getTable(), page.id);
    }
    
    const originalTime = Date.now() - originalStartTime;
    
    // 2. 最適化後の処理時間測定
    console.log('\n⚡ 最適化後の処理時間を測定中...');
    const optimizedStartTime = Date.now();
    
    await this.optimizedSyncPages(maxPages);
    
    const optimizedTime = Date.now() - optimizedStartTime;
    
    // 3. 比較結果
    const improvement = originalTime - optimizedTime;
    const improvementPercentage = (improvement / originalTime) * 100;
    
    console.log('\n📈 パフォーマンス比較結果:');
    console.log('='.repeat(60));
    console.log(`最適化前: ${(originalTime / 1000).toFixed(2)}秒`);
    console.log(`最適化後: ${(optimizedTime / 1000).toFixed(2)}秒`);
    console.log(`改善時間: ${(improvement / 1000).toFixed(2)}秒`);
    console.log(`改善率: ${improvementPercentage.toFixed(1)}%`);
    
    if (improvementPercentage > 0) {
      console.log('✅ 最適化が成功しました！');
    } else {
      console.log('❌ 最適化の効果が見られませんでした');
    }
  }
}

// 使用例
async function runOptimizedSync() {
  const optimizedSync = new OptimizedConfluenceSyncService({
    batchSize: 50,
    concurrency: 10,
    enableCache: true,
    enablePreFiltering: true,
    enableParallelFiltering: true
  });

  try {
    // 全ページ同期の実行
    await optimizedSync.optimizedSyncPages(1143);
  } catch (error) {
    console.error('同期処理エラー:', error);
  }
}

// パフォーマンステストの実行
async function runPerformanceTest() {
  const optimizedSync = new OptimizedConfluenceSyncService();
  
  try {
    await optimizedSync.performanceComparisonTest(50);
  } catch (error) {
    console.error('パフォーマンステストエラー:', error);
  }
}

// 実行
if (process.argv.includes('--test')) {
  runPerformanceTest();
} else {
  runOptimizedSync();
}
