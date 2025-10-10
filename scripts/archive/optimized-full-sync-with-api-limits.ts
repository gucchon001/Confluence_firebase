/**
 * Confluence API制限を考慮した最適化された全ページ同期
 * レート制限遵守、バッチサイズ最適化、並列処理を実装
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';

interface OptimizedSyncResult {
  totalPages: number;
  newPages: number;
  updatedPages: number;
  skippedPages: number;
  excludedPages: number;
  processingTime: number;
  startTime: string;
  endTime: string;
  apiRequests: number;
  averageResponseTime: number;
}

class OptimizedConfluenceSyncService extends ConfluenceSyncService {
  private existingPageCache: Set<string> = new Set();
  private cacheInitialized: boolean = false;
  private config = {
    // API制限を考慮した最適化設定
    batchSize: 200, // 200ページずつ（API制限内で最大）
    concurrency: 2, // 2つの並列リクエスト
    delayBetweenRequests: 200, // 200ms間隔（レート制限遵守）
    enableCache: true,
    enableParallelFiltering: true,
    enablePreFiltering: true,
    memoryCheckInterval: 5 // 5バッチごとにメモリチェック
  };
  private processedBatches = 0;
  private apiRequestCount = 0;
  private totalResponseTime = 0;

  /**
   * Confluence APIから最適化されたページ取得
   */
  async getOptimizedConfluencePages(maxPages: number = 1143): Promise<ConfluencePage[]> {
    const allPages: ConfluencePage[] = [];
    let start = 0;
    const limit = this.config.batchSize;
    let hasMore = true;
    
    console.log(`🚀 最適化された全ページ取得を開始: 最大${maxPages}ページ`);
    console.log(`📦 バッチサイズ: ${limit}ページ`);
    console.log(`🔄 並列度: ${this.config.concurrency}`);
    console.log(`⏱️ リクエスト間隔: ${this.config.delayBetweenRequests}ms`);
    
    while (hasMore && allPages.length < maxPages) {
      try {
        const remainingPages = maxPages - allPages.length;
        const currentLimit = Math.min(limit, remainingPages);
        
        console.log(`📄 ページ ${start + 1}-${start + currentLimit} を取得中...`);
        
        const startTime = Date.now();
        const pages = await this.getConfluencePages(currentLimit, start);
        const responseTime = Date.now() - startTime;
        
        this.apiRequestCount++;
        this.totalResponseTime += responseTime;
        
        if (pages.length === 0) {
          hasMore = false;
          console.log('  これ以上ページがありません');
          break;
        }
        
        allPages.push(...pages);
        console.log(`  ✅ 取得完了: ${pages.length}ページ (${responseTime}ms) - 累計: ${allPages.length}ページ`);
        
        // 取得したページ数がlimitより少ない場合は最後のページ
        if (pages.length < currentLimit) {
          hasMore = false;
          console.log('  最後のページに到達しました');
        }
        
        start += currentLimit;
        
        // API制限を遵守するための待機
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenRequests));
        }
        
      } catch (error) {
        console.error(`❌ ページ取得エラー (start=${start}): ${error}`);
        hasMore = false;
      }
    }
    
    const averageResponseTime = this.totalResponseTime / this.apiRequestCount;
    console.log(`✅ 最適化された全ページ取得完了: ${allPages.length}ページ`);
    console.log(`📊 API統計: ${this.apiRequestCount}リクエスト, 平均応答時間: ${averageResponseTime.toFixed(2)}ms`);
    
    return allPages;
  }

  /**
   * 最適化された全ページ同期実行
   */
  async runOptimizedFullSync(maxPages: number = 1143): Promise<OptimizedSyncResult> {
    const startTime = new Date();
    console.log('🚀 Confluence API制限を考慮した最適化同期を開始します...');
    console.log(`📅 開始時刻: ${startTime.toLocaleString()}`);
    console.log(`🎯 対象ページ数: ${maxPages}ページ`);
    console.log('='.repeat(80));

    try {
      // 1. キャッシュ初期化
      console.log('\n1️⃣ キャッシュ初期化:');
      await this.initializeCache();

      // 2. 最適化された全ページ取得
      console.log('\n2️⃣ 最適化された全ページ取得:');
      const allPages = await this.getOptimizedConfluencePages(maxPages);
      console.log(`✅ ${allPages.length}ページを取得しました`);

      // 3. 並列フィルタリング
      console.log('\n3️⃣ 並列フィルタリング:');
      const { included: filteredPages, excluded: excludedPages } = 
        await this.parallelFilterPages(allPages);
      
      console.log(`✅ 対象ページ: ${filteredPages.length}件`);
      console.log(`🚫 除外ページ: ${excludedPages.length}件`);
      console.log(`📊 除外率: ${((excludedPages.length / allPages.length) * 100).toFixed(1)}%`);

      // 4. バッチで既存ページチェック
      console.log('\n4️⃣ 既存ページチェック:');
      const pageIds = filteredPages.map(page => page.id.toString());
      const existingPageMap = await this.batchCheckExistingPages(pageIds);

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

      console.log(`📝 新規ページ: ${newPages.length}件`);
      console.log(`🔄 既存ページ: ${existingPages.length}件`);

      // 6. 最適化された同期処理
      console.log('\n5️⃣ 最適化された同期処理:');
      const table = await this.lancedbClient.getTable();
      
      let processedNew = 0;
      let processedExisting = 0;
      let skipped = 0;
      let errors = 0;

      // 6.1 新規ページの処理（最適化バッチ）
      if (newPages.length > 0) {
        console.log(`📝 新規ページの同期中... (${newPages.length}件)`);
        const newPageBatches = [];
        for (let i = 0; i < newPages.length; i += this.config.batchSize) {
          newPageBatches.push(newPages.slice(i, i + this.config.batchSize));
        }

        for (let batchIndex = 0; batchIndex < newPageBatches.length; batchIndex++) {
          const batch = newPageBatches[batchIndex];
          console.log(`   バッチ ${batchIndex + 1}/${newPageBatches.length}: ${batch.length}ページを処理中...`);
          
          // 並列処理で同期実行
          const batchPromises = batch.map(async (page) => {
            try {
              await this.addNewPage(table, page);
              return { type: 'added', page };
            } catch (error) {
              console.error(`    ❌ 新規ページ追加エラー: ${page.id} - ${error}`);
              return { type: 'error', page, error };
            }
          });

          const batchResults = await Promise.all(batchPromises);
          const addedCount = batchResults.filter(r => r.type === 'added').length;
          const errorCount = batchResults.filter(r => r.type === 'error').length;
          
          processedNew += addedCount;
          errors += errorCount;
          
          console.log(`   ✅ バッチ完了: ${addedCount}件追加, ${errorCount}件エラー`);
          
          // メモリチェック
          this.processedBatches++;
          if (this.processedBatches % this.config.memoryCheckInterval === 0) {
            this.checkMemoryUsage();
          }
        }
      }

      // 6.2 既存ページの処理（最適化バッチ）
      if (existingPages.length > 0) {
        console.log(`🔄 既存ページの更新チェック中... (${existingPages.length}件)`);
        
        const existingPageBatches = [];
        for (let i = 0; i < existingPages.length; i += this.config.batchSize) {
          existingPageBatches.push(existingPages.slice(i, i + this.config.batchSize));
        }

        for (let batchIndex = 0; batchIndex < existingPageBatches.length; batchIndex++) {
          const batch = existingPageBatches[batchIndex];
          console.log(`   バッチ ${batchIndex + 1}/${existingPageBatches.length}: ${batch.length}ページをチェック中...`);
          
          // 並列処理で更新チェック
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
              console.error(`    ❌ 既存ページ処理エラー: ${page.id} - ${error}`);
              return { type: 'error', page, error };
            }
          });

          const batchResults = await Promise.all(batchPromises);
          const updatedCount = batchResults.filter(r => r.type === 'updated').length;
          const skippedCount = batchResults.filter(r => r.type === 'skipped').length;
          const errorCount = batchResults.filter(r => r.type === 'error').length;
          
          processedExisting += updatedCount;
          skipped += skippedCount;
          errors += errorCount;
          
          console.log(`   ✅ バッチ完了: ${updatedCount}件更新, ${skippedCount}件スキップ, ${errorCount}件エラー`);
          
          // メモリチェック
          this.processedBatches++;
          if (this.processedBatches % this.config.memoryCheckInterval === 0) {
            this.checkMemoryUsage();
          }
        }
      }

      const endTime = new Date();
      const processingTime = endTime.getTime() - startTime.getTime();
      const averageResponseTime = this.totalResponseTime / this.apiRequestCount;

      // 7. 結果サマリー
      const result: OptimizedSyncResult = {
        totalPages: allPages.length,
        newPages: processedNew,
        updatedPages: processedExisting,
        skippedPages: skipped,
        excludedPages: excludedPages.length,
        processingTime,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        apiRequests: this.apiRequestCount,
        averageResponseTime
      };

      console.log('\n' + '='.repeat(80));
      console.log('🎉 Confluence API制限を考慮した最適化同期が完了しました！');
      console.log('='.repeat(80));
      
      console.log('\n📊 同期結果サマリー:');
      console.log(`📅 開始時刻: ${startTime.toLocaleString()}`);
      console.log(`📅 終了時刻: ${endTime.toLocaleString()}`);
      console.log(`⏱️  処理時間: ${(processingTime / 1000).toFixed(2)}秒`);
      console.log(`📄 総ページ数: ${result.totalPages}`);
      console.log(`📝 新規追加: ${result.newPages}件`);
      console.log(`🔄 更新: ${result.updatedPages}件`);
      console.log(`⏭️  スキップ: ${result.skippedPages}件`);
      console.log(`🚫 除外: ${result.excludedPages}件`);
      console.log(`❌ エラー: ${errors}件`);
      
      console.log('\n🌐 API統計:');
      console.log(`📡 APIリクエスト数: ${result.apiRequests}回`);
      console.log(`⏱️ 平均応答時間: ${result.averageResponseTime.toFixed(2)}ms`);
      console.log(`📦 バッチサイズ: ${this.config.batchSize}ページ`);
      console.log(`🔄 並列度: ${this.config.concurrency}`);
      
      console.log('\n📈 パフォーマンス指標:');
      console.log(`⚡ 1ページあたり: ${(processingTime / result.totalPages).toFixed(2)}ms`);
      console.log(`📊 処理効率: ${((result.newPages + result.updatedPages) / result.totalPages * 100).toFixed(1)}%`);
      console.log(`🚫 除外率: ${((result.excludedPages / result.totalPages) * 100).toFixed(1)}%`);
      
      if (errors > 0) {
        console.log(`\n⚠️ エラーが ${errors}件発生しました`);
        console.log('🔍 エラーログを確認してください');
      } else {
        console.log('\n✅ エラーは発生しませんでした');
      }

      // 8. 品質チェック
      console.log('\n🔍 品質チェック:');
      const qualityChecks = {
        processingTime: processingTime < 300000, // 5分以内
        errorRate: (errors / result.totalPages) < 0.05, // エラー率5%未満
        exclusionRate: (result.excludedPages / result.totalPages) > 0.05 && (result.excludedPages / result.totalPages) < 0.30, // 除外率5-30%
        processingEfficiency: ((result.newPages + result.updatedPages) / result.totalPages) > 0.1, // 処理効率10%以上
        apiEfficiency: result.apiRequests < 10 // APIリクエスト数10回未満
      };

      console.log(`✅ 処理時間: ${qualityChecks.processingTime ? 'OK' : 'NG'} (${(processingTime / 1000).toFixed(2)}秒)`);
      console.log(`✅ エラー率: ${qualityChecks.errorRate ? 'OK' : 'NG'} (${(errors / result.totalPages * 100).toFixed(2)}%)`);
      console.log(`✅ 除外率: ${qualityChecks.exclusionRate ? 'OK' : 'NG'} (${((result.excludedPages / result.totalPages) * 100).toFixed(1)}%)`);
      console.log(`✅ 処理効率: ${qualityChecks.processingEfficiency ? 'OK' : 'NG'} (${((result.newPages + result.updatedPages) / result.totalPages * 100).toFixed(1)}%)`);
      console.log(`✅ API効率: ${qualityChecks.apiEfficiency ? 'OK' : 'NG'} (${result.apiRequests}回)`);

      const allQualityChecksPass = Object.values(qualityChecks).every(check => check);
      
      if (allQualityChecksPass) {
        console.log('\n🎉 全品質チェックが合格しました！');
      } else {
        console.log('\n⚠️ 一部の品質チェックで問題が検出されました');
      }

      // 9. 結果をJSONファイルに保存
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `optimized-sync-result-${timestamp}.json`;
      const fs = require('fs');
      fs.writeFileSync(filename, JSON.stringify(result, null, 2));
      console.log(`\n💾 同期結果は ${filename} に保存されました。`);

      return result;

    } catch (error) {
      console.error('❌ 同期処理中にエラーが発生しました:', error);
      throw error;
    }
  }

  // ヘルパーメソッド
  private async initializeCache(): Promise<void> {
    if (this.cacheInitialized) return;

    console.log('📦 既存ページIDキャッシュを初期化中...');
    const startTime = Date.now();

    try {
      const table = await this.lancedbClient.getTable();
      const dummyVector = new Array(768).fill(0);
      const allChunks = await table.search(dummyVector).limit(10000).toArray();
      
      allChunks.forEach((chunk: any) => {
        this.existingPageCache.add(chunk.pageId.toString());
      });

      const endTime = Date.now();
      console.log(`✅ キャッシュ初期化完了: ${this.existingPageCache.size}ページ (${endTime - startTime}ms)`);
      this.cacheInitialized = true;
    } catch (error) {
      console.error('❌ キャッシュ初期化エラー:', error);
      throw error;
    }
  }

  private async parallelFilterPages(pages: any[]): Promise<{
    included: any[];
    excluded: any[];
  }> {
    const chunkSize = Math.ceil(pages.length / this.config.concurrency);
    const chunks = [];
    
    for (let i = 0; i < pages.length; i += chunkSize) {
      chunks.push(pages.slice(i, i + chunkSize));
    }

    const filterPromises = chunks.map(async (chunk) => {
      const included: any[] = [];
      const excluded: any[] = [];
      
      for (const page of chunk) {
        if (this.shouldExcludePage(page)) {
          excluded.push(page);
        } else {
          included.push(page);
        }
      }
      
      return { included, excluded };
    });

    const results = await Promise.all(filterPromises);
    
    const included = results.flatMap(r => r.included);
    const excluded = results.flatMap(r => r.excluded);
    
    return { included, excluded };
  }

  private async batchCheckExistingPages(pageIds: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    // キャッシュベースの高速チェック
    pageIds.forEach(pageId => {
      results.set(pageId, this.existingPageCache.has(pageId));
    });

    return results;
  }

  private checkMemoryUsage(): void {
    const used = process.memoryUsage();
    const memoryMB = used.heapUsed / 1024 / 1024;
    
    if (memoryMB > 300) { // 300MBを超えたら警告
      console.log(`⚠️ メモリ使用量: ${memoryMB.toFixed(2)}MB`);
      if (global.gc) {
        global.gc();
        const afterGC = process.memoryUsage().heapUsed / 1024 / 1024;
        console.log(`🧹 GC実行後: ${afterGC.toFixed(2)}MB`);
      }
    }
  }
}

/**
 * Confluence API制限を考慮した最適化同期の実行
 */
async function runOptimizedSync(): Promise<void> {
  console.log('🚀 Confluence API制限を考慮した最適化同期を開始します...\n');

  try {
    const syncService = new OptimizedConfluenceSyncService();
    await syncService.lancedbClient.connect();

    // 全ページ同期の実行
    const result = await syncService.runOptimizedFullSync(1143);

    console.log('\n🎉 Confluence API制限を考慮した最適化同期が正常に完了しました！');
    console.log('='.repeat(80));
    console.log('📊 最終結果:');
    console.log(`⏱️  処理時間: ${(result.processingTime / 1000).toFixed(2)}秒`);
    console.log(`📄 総ページ数: ${result.totalPages}`);
    console.log(`📝 新規追加: ${result.newPages}件`);
    console.log(`🔄 更新: ${result.updatedPages}件`);
    console.log(`⏭️  スキップ: ${result.skippedPages}件`);
    console.log(`🚫 除外: ${result.excludedPages}件`);
    console.log(`📡 APIリクエスト: ${result.apiRequests}回`);
    console.log(`⏱️ 平均応答時間: ${result.averageResponseTime.toFixed(2)}ms`);

  } catch (error) {
    console.error('❌ 最適化同期中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// 実行
runOptimizedSync().catch(console.error);

