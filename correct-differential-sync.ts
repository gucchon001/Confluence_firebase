/**
 * 正しい差分同期: 全ページを取得して新規ページのみを特定・追加
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import * as fs from 'fs';

interface CorrectDifferentialSyncResult {
  totalConfluencePages: number;
  existingLanceDBPages: number;
  newPages: number;
  processedPages: number;
  excludedPages: number;
  errors: number;
  processingTime: number;
  memoryPeak: number;
}

class CorrectDifferentialConfluenceSyncService extends ConfluenceSyncService {
  private config = {
    batchSize: 50, // Confluence APIの実際の制限
    delayBetweenRequests: 200,
    memoryCheckInterval: 1,
    maxMemoryMB: 200,
    enableGC: true,
    progressFile: 'correct-differential-sync-progress.json'
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
    return used.heapUsed / 1024 / 1024;
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
   * Confluence APIから全ページを取得（正しいページネーション）
   */
  async getAllConfluencePages(maxPages: number = 1143): Promise<any[]> {
    console.log('🔍 Confluence APIから全ページを取得中...');
    const allPages: any[] = [];
    let start = 0;
    const limit = this.config.batchSize;
    let hasMore = true;
    
    while (hasMore && allPages.length < maxPages) {
      try {
        const remainingPages = maxPages - allPages.length;
        const currentLimit = Math.min(limit, remainingPages);
        
        console.log(`📄 ページ ${start + 1}-${start + currentLimit} を取得中...`);
        
        const pages = await this.getConfluencePages(currentLimit, start);
        
        if (pages.length === 0) {
          hasMore = false;
          console.log('  これ以上ページがありません');
          break;
        }

        allPages.push(...pages);
        console.log(`  ✅ 取得完了: ${pages.length}ページ (累計: ${allPages.length})`);

        start += pages.length;
        
        // 取得したページ数がlimitより少ない場合は最後のページ
        if (pages.length < currentLimit) {
          hasMore = false;
          console.log('  最後のページに到達しました');
        }
        
        // API制限を遵守
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenRequests));
        }
        
      } catch (error) {
        console.error(`❌ ページ取得エラー (start=${start}): ${error}`);
        hasMore = false;
      }
    }
    
    console.log(`✅ Confluence全ページ取得完了: ${allPages.length}ページ`);
    return allPages;
  }

  /**
   * LanceDBから既存ページIDを取得
   */
  async getExistingLanceDBPageIds(): Promise<Set<string>> {
    console.log('📦 LanceDBから既存ページIDを取得中...');
    const startTime = Date.now();

    try {
      const table = await this.lancedbClient.getTable();
      const dummyVector = new Array(768).fill(0);
      const sampleChunks = await table.search(dummyVector).limit(10000).toArray();
      
      const existingPageIds = new Set<string>();
      sampleChunks.forEach((chunk: any) => {
        existingPageIds.add(chunk.pageId.toString());
      });

      console.log(`✅ LanceDBページID取得完了: ${existingPageIds.size}ページ (${Date.now() - startTime}ms)`);
      return existingPageIds;
      
    } catch (error) {
      console.error('❌ LanceDBページID取得エラー:', error);
      throw error;
    }
  }

  /**
   * 新規ページのみをフィルタリング
   */
  filterNewPages(allPages: any[], existingPageIds: Set<string>): {
    newPages: any[];
    existingPages: any[];
  } {
    console.log('🔍 新規ページのフィルタリング中...');
    
    const newPages: any[] = [];
    const existingPages: any[] = [];
    
    allPages.forEach(page => {
      const pageId = page.id.toString();
      if (existingPageIds.has(pageId)) {
        existingPages.push(page);
      } else {
        newPages.push(page);
      }
    });
    
    console.log(`📊 フィルタリング結果:`);
    console.log(`  📄 総ページ数: ${allPages.length}`);
    console.log(`  🆕 新規ページ: ${newPages.length}`);
    console.log(`  🔄 既存ページ: ${existingPages.length}`);
    console.log(`  📈 新規率: ${((newPages.length / allPages.length) * 100).toFixed(1)}%`);
    
    return { newPages, existingPages };
  }

  /**
   * 新規ページを除外条件でフィルタリング
   */
  filterNewPagesByExclusion(newPages: any[]): {
    included: any[];
    excluded: any[];
  } {
    console.log('🔍 新規ページの除外フィルタリング中...');
    
    const included: any[] = [];
    const excluded: any[] = [];
    
    newPages.forEach(page => {
      if (this.shouldExcludePage(page)) {
        excluded.push(page);
      } else {
        included.push(page);
      }
    });
    
    console.log(`📊 除外フィルタリング結果:`);
    console.log(`  📄 新規ページ数: ${newPages.length}`);
    console.log(`  ✅ 対象ページ: ${included.length}`);
    console.log(`  🚫 除外ページ: ${excluded.length}`);
    console.log(`  📈 除外率: ${((excluded.length / newPages.length) * 100).toFixed(1)}%`);
    
    return { included, excluded };
  }

  /**
   * 新規ページをバッチで同期
   */
  async syncNewPages(newPages: any[]): Promise<{
    processedPages: number;
    errors: number;
  }> {
    console.log(`🔄 新規ページの同期開始: ${newPages.length}ページ`);
    
    let processedPages = 0;
    let errors = 0;
    
    const table = await this.lancedbClient.getTable();
    
    // バッチで処理
    for (let i = 0; i < newPages.length; i += this.config.batchSize) {
      const batch = newPages.slice(i, i + this.config.batchSize);
      const batchNumber = Math.floor(i / this.config.batchSize) + 1;
      const totalBatches = Math.ceil(newPages.length / this.config.batchSize);
      
      console.log(`\n📄 バッチ ${batchNumber}/${totalBatches}: ${batch.length}ページを処理中...`);
      
      for (const page of batch) {
        try {
          await this.addNewPage(table, page);
          processedPages++;
          console.log(`  ✅ 新規ページ追加: ${page.title} (${page.id})`);
        } catch (error) {
          console.error(`  ❌ ページ処理エラー: ${page.id} - ${error}`);
          errors++;
        }
      }
      
      // メモリ管理
      this.processedBatches++;
      this.checkAndManageMemory();
      
      // API制限を遵守
      if (i + this.config.batchSize < newPages.length) {
        await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenRequests));
      }
    }
    
    return { processedPages, errors };
  }

  /**
   * 正しい差分同期実行
   */
  async runCorrectDifferentialSync(maxPages: number = 1143): Promise<CorrectDifferentialSyncResult> {
    const startTime = Date.now();
    console.log('🚀 正しい差分同期を開始します...');
    console.log(`📅 開始時刻: ${new Date().toLocaleString()}`);
    console.log(`🎯 対象ページ数: ${maxPages}ページ`);
    console.log(`💾 初期メモリ: ${this.startMemory.toFixed(2)}MB`);
    console.log('='.repeat(80));

    try {
      // 1. Confluence APIから全ページを取得
      console.log('\n1️⃣ Confluence APIから全ページを取得:');
      const allConfluencePages = await this.getAllConfluencePages(maxPages);

      // 2. LanceDBから既存ページIDを取得
      console.log('\n2️⃣ LanceDBから既存ページIDを取得:');
      const existingPageIds = await this.getExistingLanceDBPageIds();

      // 3. 新規ページのみをフィルタリング
      console.log('\n3️⃣ 新規ページのフィルタリング:');
      const { newPages, existingPages } = this.filterNewPages(allConfluencePages, existingPageIds);

      // 4. 新規ページを除外条件でフィルタリング
      console.log('\n4️⃣ 新規ページの除外フィルタリング:');
      const { included: targetPages, excluded: excludedPages } = this.filterNewPagesByExclusion(newPages);

      // 5. 新規ページを同期
      let processedPages = 0;
      let errors = 0;

      if (targetPages.length > 0) {
        console.log('\n5️⃣ 新規ページの同期:');
        const syncResult = await this.syncNewPages(targetPages);
        processedPages = syncResult.processedPages;
        errors = syncResult.errors;
      } else {
        console.log('\n5️⃣ 新規ページの同期: 対象ページなし');
      }

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // 6. 結果サマリー
      const result: CorrectDifferentialSyncResult = {
        totalConfluencePages: allConfluencePages.length,
        existingLanceDBPages: existingPageIds.size,
        newPages: newPages.length,
        processedPages,
        excludedPages: excludedPages.length,
        errors,
        processingTime,
        memoryPeak: this.memoryPeak
      };

      console.log('\n' + '='.repeat(80));
      console.log('🎉 正しい差分同期が完了しました！');
      console.log('='.repeat(80));
      
      console.log('\n📊 同期結果サマリー:');
      console.log(`📅 開始時刻: ${new Date(startTime).toLocaleString()}`);
      console.log(`📅 終了時刻: ${new Date(endTime).toLocaleString()}`);
      console.log(`⏱️  処理時間: ${(processingTime / 1000).toFixed(2)}秒`);
      console.log(`📄 Confluence総ページ数: ${result.totalConfluencePages}`);
      console.log(`📦 LanceDB既存ページ数: ${result.existingLanceDBPages}`);
      console.log(`🆕 新規ページ数: ${result.newPages}`);
      console.log(`📝 処理済みページ: ${result.processedPages}`);
      console.log(`🚫 除外ページ: ${result.excludedPages}`);
      console.log(`❌ エラー: ${result.errors}`);
      
      console.log('\n💾 メモリ統計:');
      console.log(`📊 ピークメモリ: ${result.memoryPeak.toFixed(2)}MB`);
      
      console.log('\n📈 パフォーマンス指標:');
      console.log(`⚡ 1ページあたり: ${(processingTime / result.processedPages).toFixed(2)}ms`);
      console.log(`📊 処理効率: ${((result.processedPages / result.newPages) * 100).toFixed(1)}%`);
      console.log(`🚫 除外率: ${((result.excludedPages / result.newPages) * 100).toFixed(1)}%`);
      
      if (result.errors > 0) {
        console.log(`\n⚠️ エラーが ${result.errors}件発生しました`);
        console.log('🔍 エラーログを確認してください');
      } else {
        console.log('\n✅ エラーは発生しませんでした');
      }

      // 7. 結果をJSONファイルに保存
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `correct-differential-sync-result-${timestamp}.json`;
      fs.writeFileSync(filename, JSON.stringify(result, null, 2));
      console.log(`\n💾 同期結果は ${filename} に保存されました。`);

      return result;

    } catch (error) {
      console.error('❌ 差分同期中にエラーが発生しました:', error);
      throw error;
    }
  }
}

/**
 * 正しい差分同期の実行
 */
async function runCorrectDifferentialSync(): Promise<void> {
  console.log('🚀 正しい差分同期を開始します...\n');

  try {
    const syncService = new CorrectDifferentialConfluenceSyncService();
    await syncService.lancedbClient.connect();

    // 差分同期の実行
    const result = await syncService.runCorrectDifferentialSync(1143);

    console.log('\n🎉 正しい差分同期が正常に完了しました！');
    console.log('='.repeat(80));
    console.log('📊 最終結果:');
    console.log(`⏱️  処理時間: ${(result.processingTime / 1000).toFixed(2)}秒`);
    console.log(`📄 Confluence総ページ数: ${result.totalConfluencePages}`);
    console.log(`📦 LanceDB既存ページ数: ${result.existingLanceDBPages}`);
    console.log(`🆕 新規ページ数: ${result.newPages}`);
    console.log(`📝 処理済みページ: ${result.processedPages}`);
    console.log(`🚫 除外ページ: ${result.excludedPages}`);
    console.log(`❌ エラー: ${result.errors}`);

    if (result.errors > 0) {
      console.log(`\n⚠️ エラーが ${result.errors}件発生しました`);
    }

  } catch (error) {
    console.error('❌ 差分同期中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// 実行
runCorrectDifferentialSync().catch(console.error);
