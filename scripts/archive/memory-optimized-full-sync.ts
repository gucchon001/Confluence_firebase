/**
 * メモリ最適化された全ページ同期実行
 * メモリ使用量を削減した効率的な同期処理
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';

interface SyncResult {
  totalPages: number;
  newPages: number;
  updatedPages: number;
  skippedPages: number;
  excludedPages: number;
  processingTime: number;
  startTime: string;
  endTime: string;
  memoryPeak: number;
}

class MemoryOptimizedSyncService extends ConfluenceSyncService {
  private existingPageCache: Set<string> = new Set();
  private cacheInitialized: boolean = false;
  private config = {
    batchSize: 20, // バッチサイズを小さく
    concurrency: 4, // 並列度を下げる
    enableCache: true,
    enableParallelFiltering: true,
    enablePreFiltering: true,
    memoryCheckInterval: 10 // 10バッチごとにメモリチェック
  };
  private processedBatches = 0;

  /**
   * メモリ使用量を監視
   */
  private checkMemoryUsage(): number {
    const used = process.memoryUsage();
    const memoryMB = used.heapUsed / 1024 / 1024;
    
    if (memoryMB > 400) { // 400MBを超えたら警告
      console.log(`⚠️ メモリ使用量: ${memoryMB.toFixed(2)}MB`);
      if (global.gc) {
        global.gc();
        const afterGC = process.memoryUsage().heapUsed / 1024 / 1024;
        console.log(`🧹 GC実行後: ${afterGC.toFixed(2)}MB`);
      }
    }
    
    return memoryMB;
  }

  /**
   * メモリ最適化された全ページ同期実行
   */
  async runMemoryOptimizedSync(maxPages: number = 1143): Promise<SyncResult> {
    const startTime = new Date();
    const startMemory = this.checkMemoryUsage();
    console.log('🚀 メモリ最適化された全ページ同期を開始します...');
    console.log(`📅 開始時刻: ${startTime.toLocaleString()}`);
    console.log(`🎯 対象ページ数: ${maxPages}ページ`);
    console.log(`💾 開始メモリ使用量: ${startMemory.toFixed(2)}MB`);
    console.log('='.repeat(80));

    try {
      // 1. キャッシュ初期化
      console.log('\n1️⃣ キャッシュ初期化:');
      await this.initializeCache();
      this.checkMemoryUsage();

      // 2. 全ページ取得（ページネーション対応）
      console.log('\n2️⃣ 全ページ取得:');
      const allPages = await this.getAllConfluencePages(maxPages);
      console.log(`✅ ${allPages.length}ページを取得しました`);
      this.checkMemoryUsage();

      // 3. 並列フィルタリング（小バッチで実行）
      console.log('\n3️⃣ 並列フィルタリング:');
      const { included: filteredPages, excluded: excludedPages } = 
        await this.parallelFilterPagesWithMemoryCheck(allPages);
      
      console.log(`✅ 対象ページ: ${filteredPages.length}件`);
      console.log(`🚫 除外ページ: ${excludedPages.length}件`);
      console.log(`📊 除外率: ${((excludedPages.length / allPages.length) * 100).toFixed(1)}%`);
      this.checkMemoryUsage();

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
      this.checkMemoryUsage();

      // 6. メモリ効率的な同期処理
      console.log('\n5️⃣ メモリ効率的な同期処理:');
      const table = await this.lancedbClient.getTable();
      
      let processedNew = 0;
      let processedExisting = 0;
      let skipped = 0;
      let errors = 0;
      let peakMemory = startMemory;

      // 6.1 新規ページの処理（小バッチ）
      if (newPages.length > 0) {
        console.log(`📝 新規ページの同期中... (${newPages.length}件)`);
        const newPageBatches = [];
        for (let i = 0; i < newPages.length; i += this.config.batchSize) {
          newPageBatches.push(newPages.slice(i, i + this.config.batchSize));
        }

        for (let batchIndex = 0; batchIndex < newPageBatches.length; batchIndex++) {
          const batch = newPageBatches[batchIndex];
          console.log(`   バッチ ${batchIndex + 1}/${newPageBatches.length}: ${batch.length}ページを処理中...`);
          
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
            const currentMemory = this.checkMemoryUsage();
            peakMemory = Math.max(peakMemory, currentMemory);
          }
        }
      }

      // 6.2 既存ページの処理（小バッチ）
      if (existingPages.length > 0) {
        console.log(`🔄 既存ページの更新チェック中... (${existingPages.length}件)`);
        
        const existingPageBatches = [];
        for (let i = 0; i < existingPages.length; i += this.config.batchSize) {
          existingPageBatches.push(existingPages.slice(i, i + this.config.batchSize));
        }

        for (let batchIndex = 0; batchIndex < existingPageBatches.length; batchIndex++) {
          const batch = existingPageBatches[batchIndex];
          console.log(`   バッチ ${batchIndex + 1}/${existingPageBatches.length}: ${batch.length}ページをチェック中...`);
          
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
            const currentMemory = this.checkMemoryUsage();
            peakMemory = Math.max(peakMemory, currentMemory);
          }
        }
      }

      const endTime = new Date();
      const endMemory = this.checkMemoryUsage();
      const processingTime = endTime.getTime() - startTime.getTime();

      // 7. 結果サマリー
      const result: SyncResult = {
        totalPages: allPages.length,
        newPages: processedNew,
        updatedPages: processedExisting,
        skippedPages: skipped,
        excludedPages: excludedPages.length,
        processingTime,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        memoryPeak: peakMemory
      };

      console.log('\n' + '='.repeat(80));
      console.log('🎉 メモリ最適化された全ページ同期が完了しました！');
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
      
      console.log('\n💾 メモリ使用量:');
      console.log(`📊 開始メモリ: ${startMemory.toFixed(2)}MB`);
      console.log(`📊 終了メモリ: ${endMemory.toFixed(2)}MB`);
      console.log(`📊 ピークメモリ: ${peakMemory.toFixed(2)}MB`);
      console.log(`📊 メモリ増加: ${(endMemory - startMemory).toFixed(2)}MB`);
      
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
        processingTime: processingTime < 600000, // 10分以内
        errorRate: (errors / result.totalPages) < 0.05, // エラー率5%未満
        exclusionRate: (result.excludedPages / result.totalPages) > 0.05 && (result.excludedPages / result.totalPages) < 0.30, // 除外率5-30%
        processingEfficiency: ((result.newPages + result.updatedPages) / result.totalPages) > 0.1, // 処理効率10%以上
        memoryUsage: peakMemory < 500 // ピークメモリ500MB未満
      };

      console.log(`✅ 処理時間: ${qualityChecks.processingTime ? 'OK' : 'NG'} (${(processingTime / 1000).toFixed(2)}秒)`);
      console.log(`✅ エラー率: ${qualityChecks.errorRate ? 'OK' : 'NG'} (${(errors / result.totalPages * 100).toFixed(2)}%)`);
      console.log(`✅ 除外率: ${qualityChecks.exclusionRate ? 'OK' : 'NG'} (${((result.excludedPages / result.totalPages) * 100).toFixed(1)}%)`);
      console.log(`✅ 処理効率: ${qualityChecks.processingEfficiency ? 'OK' : 'NG'} (${((result.newPages + result.updatedPages) / result.totalPages * 100).toFixed(1)}%)`);
      console.log(`✅ メモリ使用量: ${qualityChecks.memoryUsage ? 'OK' : 'NG'} (${peakMemory.toFixed(2)}MB)`);

      const allQualityChecksPass = Object.values(qualityChecks).every(check => check);
      
      if (allQualityChecksPass) {
        console.log('\n🎉 全品質チェックが合格しました！');
      } else {
        console.log('\n⚠️ 一部の品質チェックで問題が検出されました');
      }

      // 9. 結果をJSONファイルに保存
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `memory-optimized-sync-result-${timestamp}.json`;
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

  private async parallelFilterPagesWithMemoryCheck(pages: any[]): Promise<{
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
}

/**
 * メモリ最適化された全ページ同期の実行
 */
async function runMemoryOptimizedSync(): Promise<void> {
  console.log('🚀 メモリ最適化された全ページ同期を開始します...\n');

  try {
    const syncService = new MemoryOptimizedSyncService();
    await syncService.lancedbClient.connect();

    // 全ページ同期の実行
    const result = await syncService.runMemoryOptimizedSync(1143);

    console.log('\n🎉 メモリ最適化された全ページ同期が正常に完了しました！');
    console.log('='.repeat(80));
    console.log('📊 最終結果:');
    console.log(`⏱️  処理時間: ${(result.processingTime / 1000).toFixed(2)}秒`);
    console.log(`📄 総ページ数: ${result.totalPages}`);
    console.log(`📝 新規追加: ${result.newPages}件`);
    console.log(`🔄 更新: ${result.updatedPages}件`);
    console.log(`⏭️  スキップ: ${result.skippedPages}件`);
    console.log(`🚫 除外: ${result.excludedPages}件`);
    console.log(`💾 ピークメモリ: ${result.memoryPeak.toFixed(2)}MB`);

  } catch (error) {
    console.error('❌ 全ページ同期中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// 実行
runMemoryOptimizedSync().catch(console.error);
