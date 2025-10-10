/**
 * メモリ効率を大幅に改善したConfluence同期
 * バッチ処理、ストリーミング、メモリ管理を最適化
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';

interface MemoryEfficientSyncResult {
  totalPages: number;
  newPages: number;
  updatedPages: number;
  skippedPages: number;
  excludedPages: number;
  processingTime: number;
  memoryPeak: number;
  batchesProcessed: number;
}

class MemoryEfficientConfluenceSyncService extends ConfluenceSyncService {
  private config = {
    // メモリ効率を最優先にした設定
    batchSize: 50, // 小さなバッチサイズ
    concurrency: 1, // 並列度を1に制限
    delayBetweenRequests: 300, // より長い間隔
    memoryCheckInterval: 1, // 毎バッチでメモリチェック
    maxMemoryMB: 200, // 最大メモリ使用量200MB
    enableGC: true, // ガベージコレクション有効
    streamProcessing: true // ストリーミング処理
  };
  
  private processedBatches = 0;
  private memoryPeak = 0;
  private startMemory = 0;

  constructor() {
    super();
    this.startMemory = this.getMemoryUsage();
  }

  /**
   * メモリ使用量を取得
   */
  private getMemoryUsage(): number {
    const used = process.memoryUsage();
    return used.heapUsed / 1024 / 1024; // MB
  }

  /**
   * メモリチェックとGC実行
   */
  private checkAndManageMemory(): void {
    const currentMemory = this.getMemoryUsage();
    this.memoryPeak = Math.max(this.memoryPeak, currentMemory);
    
    if (currentMemory > this.config.maxMemoryMB) {
      console.log(`⚠️ メモリ使用量が上限を超過: ${currentMemory.toFixed(2)}MB`);
      
      if (this.config.enableGC && global.gc) {
        console.log('🧹 ガベージコレクションを実行中...');
        global.gc();
        
        const afterGC = this.getMemoryUsage();
        console.log(`✅ GC完了: ${afterGC.toFixed(2)}MB (${(currentMemory - afterGC).toFixed(2)}MB削減)`);
      }
    }
  }

  /**
   * ストリーミング方式でページを取得・処理
   */
  async streamProcessPages(maxPages: number = 1143): Promise<MemoryEfficientSyncResult> {
    const startTime = Date.now();
    console.log('🚀 メモリ効率を最優先にした同期を開始します...');
    console.log(`📅 開始時刻: ${new Date().toLocaleString()}`);
    console.log(`🎯 対象ページ数: ${maxPages}ページ`);
    console.log(`💾 初期メモリ: ${this.startMemory.toFixed(2)}MB`);
    console.log(`📦 バッチサイズ: ${this.config.batchSize}ページ`);
    console.log(`⏱️ リクエスト間隔: ${this.config.delayBetweenRequests}ms`);
    console.log('='.repeat(80));

    let totalPages = 0;
    let newPages = 0;
    let updatedPages = 0;
    let skippedPages = 0;
    let excludedPages = 0;
    let errors = 0;

    try {
      // 1. キャッシュ初期化（軽量化）
      console.log('\n1️⃣ 軽量キャッシュ初期化:');
      await this.initializeLightweightCache();

      // 2. ストリーミング処理でページを順次取得・処理
      console.log('\n2️⃣ ストリーミング処理開始:');
      let start = 0;
      let hasMore = true;

      while (hasMore && totalPages < maxPages) {
        try {
          const remainingPages = maxPages - totalPages;
          const currentLimit = Math.min(this.config.batchSize, remainingPages);
          
          console.log(`\n📄 バッチ ${this.processedBatches + 1}: ページ ${start + 1}-${start + currentLimit} を取得中...`);
          
          // ページ取得
          const pages = await this.getConfluencePages(currentLimit, start);
          
          if (pages.length === 0) {
            hasMore = false;
            console.log('  これ以上ページがありません');
            break;
          }

          totalPages += pages.length;
          console.log(`  ✅ 取得完了: ${pages.length}ページ (累計: ${totalPages}ページ)`);

          // 3. 即座にフィルタリング
          console.log(`  🔍 フィルタリング中...`);
          const { included: filteredPages, excluded: batchExcluded } = 
            await this.filterPagesBatch(pages);
          
          excludedPages += batchExcluded.length;
          console.log(`  ✅ フィルタリング完了: 対象${filteredPages.length}件, 除外${batchExcluded.length}件`);

          // 4. 即座に同期処理
          if (filteredPages.length > 0) {
            console.log(`  🔄 同期処理中...`);
            const batchResult = await this.processBatchSync(filteredPages);
            
            newPages += batchResult.newPages;
            updatedPages += batchResult.updatedPages;
            skippedPages += batchResult.skippedPages;
            errors += batchResult.errors;
            
            console.log(`  ✅ 同期完了: 新規${batchResult.newPages}件, 更新${batchResult.updatedPages}件, スキップ${batchResult.skippedPages}件, エラー${batchResult.errors}件`);
          }

          // 5. メモリ管理
          this.processedBatches++;
          this.checkAndManageMemory();
          
          // 6. 次のバッチの準備
          start += currentLimit;
          
          // 取得したページ数がlimitより少ない場合は最後のページ
          if (pages.length < currentLimit) {
            hasMore = false;
            console.log('  最後のページに到達しました');
          }
          
          // API制限を遵守するための待機
          if (hasMore) {
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenRequests));
          }

        } catch (error) {
          console.error(`❌ バッチ処理エラー (start=${start}): ${error}`);
          errors++;
          hasMore = false;
        }
      }

      const endTime = Date.now();
      const processingTime = endTime - startTime;
      const finalMemory = this.getMemoryUsage();

      // 7. 結果サマリー
      const result: MemoryEfficientSyncResult = {
        totalPages,
        newPages,
        updatedPages,
        skippedPages,
        excludedPages,
        processingTime,
        memoryPeak: this.memoryPeak,
        batchesProcessed: this.processedBatches
      };

      console.log('\n' + '='.repeat(80));
      console.log('🎉 メモリ効率を最優先にした同期が完了しました！');
      console.log('='.repeat(80));
      
      console.log('\n📊 同期結果サマリー:');
      console.log(`📅 開始時刻: ${new Date(startTime).toLocaleString()}`);
      console.log(`📅 終了時刻: ${new Date(endTime).toLocaleString()}`);
      console.log(`⏱️  処理時間: ${(processingTime / 1000).toFixed(2)}秒`);
      console.log(`📄 総ページ数: ${result.totalPages}`);
      console.log(`📝 新規追加: ${result.newPages}件`);
      console.log(`🔄 更新: ${result.updatedPages}件`);
      console.log(`⏭️  スキップ: ${result.skippedPages}件`);
      console.log(`🚫 除外: ${result.excludedPages}件`);
      console.log(`❌ エラー: ${errors}件`);
      console.log(`📦 処理バッチ数: ${result.batchesProcessed}バッチ`);
      
      console.log('\n💾 メモリ統計:');
      console.log(`📊 初期メモリ: ${this.startMemory.toFixed(2)}MB`);
      console.log(`📊 最終メモリ: ${finalMemory.toFixed(2)}MB`);
      console.log(`📊 ピークメモリ: ${result.memoryPeak.toFixed(2)}MB`);
      console.log(`📊 メモリ増加: ${(finalMemory - this.startMemory).toFixed(2)}MB`);
      
      console.log('\n📈 パフォーマンス指標:');
      console.log(`⚡ 1ページあたり: ${(processingTime / result.totalPages).toFixed(2)}ms`);
      console.log(`⚡ 1バッチあたり: ${(processingTime / result.batchesProcessed).toFixed(2)}ms`);
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
        memoryEfficiency: result.memoryPeak < this.config.maxMemoryMB,
        errorRate: (errors / result.totalPages) < 0.05,
        exclusionRate: (result.excludedPages / result.totalPages) > 0.05 && (result.excludedPages / result.totalPages) < 0.30,
        processingEfficiency: ((result.newPages + result.updatedPages) / result.totalPages) > 0.1,
        batchEfficiency: result.batchesProcessed > 0
      };

      console.log(`✅ メモリ効率: ${qualityChecks.memoryEfficiency ? 'OK' : 'NG'} (ピーク: ${result.memoryPeak.toFixed(2)}MB)`);
      console.log(`✅ エラー率: ${qualityChecks.errorRate ? 'OK' : 'NG'} (${(errors / result.totalPages * 100).toFixed(2)}%)`);
      console.log(`✅ 除外率: ${qualityChecks.exclusionRate ? 'OK' : 'NG'} (${((result.excludedPages / result.totalPages) * 100).toFixed(1)}%)`);
      console.log(`✅ 処理効率: ${qualityChecks.processingEfficiency ? 'OK' : 'NG'} (${((result.newPages + result.updatedPages) / result.totalPages * 100).toFixed(1)}%)`);
      console.log(`✅ バッチ効率: ${qualityChecks.batchEfficiency ? 'OK' : 'NG'} (${result.batchesProcessed}バッチ)`);

      const allQualityChecksPass = Object.values(qualityChecks).every(check => check);
      
      if (allQualityChecksPass) {
        console.log('\n🎉 全品質チェックが合格しました！');
      } else {
        console.log('\n⚠️ 一部の品質チェックで問題が検出されました');
      }

      // 9. 結果をJSONファイルに保存
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `memory-efficient-sync-result-${timestamp}.json`;
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
  private async initializeLightweightCache(): Promise<void> {
    console.log('📦 軽量キャッシュを初期化中...');
    const startTime = Date.now();

    try {
      const table = await this.lancedbClient.getTable();
      // 軽量な方法でページIDのみを取得
      const dummyVector = new Array(768).fill(0);
      const sampleChunks = await table.search(dummyVector).limit(1000).toArray();
      
      const existingPageIds = new Set<string>();
      sampleChunks.forEach((chunk: any) => {
        existingPageIds.add(chunk.pageId.toString());
      });

      console.log(`✅ 軽量キャッシュ初期化完了: ${existingPageIds.size}ページ (${Date.now() - startTime}ms)`);
      
      // キャッシュをプロパティに保存
      (this as any).existingPageIds = existingPageIds;
      
    } catch (error) {
      console.error('❌ 軽量キャッシュ初期化エラー:', error);
      throw error;
    }
  }

  private async filterPagesBatch(pages: any[]): Promise<{
    included: any[];
    excluded: any[];
  }> {
    const included: any[] = [];
    const excluded: any[] = [];
    
    for (const page of pages) {
      if (this.shouldExcludePage(page)) {
        excluded.push(page);
      } else {
        included.push(page);
      }
    }
    
    return { included, excluded };
  }

  private async processBatchSync(pages: any[]): Promise<{
    newPages: number;
    updatedPages: number;
    skippedPages: number;
    errors: number;
  }> {
    let newPages = 0;
    let updatedPages = 0;
    let skippedPages = 0;
    let errors = 0;

    const table = await this.lancedbClient.getTable();
    const existingPageIds = (this as any).existingPageIds || new Set();

    for (const page of pages) {
      try {
        const pageId = page.id.toString();
        const isExisting = existingPageIds.has(pageId);

        if (!isExisting) {
          // 新規ページ
          await this.addNewPage(table, page);
          newPages++;
        } else {
          // 既存ページの更新チェック
          const existingChunks = await this.findExistingChunks(table, page.id);
          
          if (existingChunks.length === 0) {
            await this.addNewPage(table, page);
            newPages++;
          } else {
            const existingLastModified = existingChunks[0].lastUpdated;
            const confluenceLastModified = page.lastModified || new Date().toISOString();
            
            const existingDate = new Date(existingLastModified);
            const confluenceDate = new Date(confluenceLastModified);
            const timeDiff = confluenceDate.getTime() - existingDate.getTime();
            const isSignificantlyNewer = timeDiff > 1000;

            if (isSignificantlyNewer) {
              await this.updateExistingPage(table, page, existingChunks);
              updatedPages++;
            } else {
              skippedPages++;
            }
          }
        }
      } catch (error) {
        console.error(`    ❌ ページ処理エラー: ${page.id} - ${error}`);
        errors++;
      }
    }

    return { newPages, updatedPages, skippedPages, errors };
  }
}

/**
 * メモリ効率を最優先にした同期の実行
 */
async function runMemoryEfficientSync(): Promise<void> {
  console.log('🚀 メモリ効率を最優先にした同期を開始します...\n');

  try {
    const syncService = new MemoryEfficientConfluenceSyncService();
    await syncService.lancedbClient.connect();

    // 全ページ同期の実行
    const result = await syncService.streamProcessPages(1143);

    console.log('\n🎉 メモリ効率を最優先にした同期が正常に完了しました！');
    console.log('='.repeat(80));
    console.log('📊 最終結果:');
    console.log(`⏱️  処理時間: ${(result.processingTime / 1000).toFixed(2)}秒`);
    console.log(`📄 総ページ数: ${result.totalPages}`);
    console.log(`📝 新規追加: ${result.newPages}件`);
    console.log(`🔄 更新: ${result.updatedPages}件`);
    console.log(`⏭️  スキップ: ${result.skippedPages}件`);
    console.log(`🚫 除外: ${result.excludedPages}件`);
    console.log(`📦 処理バッチ数: ${result.batchesProcessed}バッチ`);
    console.log(`💾 ピークメモリ: ${result.memoryPeak.toFixed(2)}MB`);

  } catch (error) {
    console.error('❌ メモリ効率同期中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// 実行
runMemoryEfficientSync().catch(console.error);
