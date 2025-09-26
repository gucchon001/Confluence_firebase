/**
 * 再開可能なストリーミング同期
 * 途中終了時も既存ページをスキップして新規ページのみを処理
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import * as fs from 'fs';
import * as path from 'path';

interface SyncProgress {
  lastProcessedPageId: string;
  lastProcessedIndex: number;
  totalPages: number;
  processedPages: number;
  newPages: number;
  updatedPages: number;
  skippedPages: number;
  excludedPages: number;
  errors: number;
  startTime: string;
  lastUpdateTime: string;
  batchesProcessed: number;
}

interface ResumableSyncResult {
  totalPages: number;
  newPages: number;
  updatedPages: number;
  skippedPages: number;
  excludedPages: number;
  errors: number;
  processingTime: number;
  memoryPeak: number;
  batchesProcessed: number;
  resumed: boolean;
  progressFile: string;
}

class ResumableConfluenceSyncService extends ConfluenceSyncService {
  private config = {
    batchSize: 50,
    concurrency: 1,
    delayBetweenRequests: 300,
    memoryCheckInterval: 1,
    maxMemoryMB: 200,
    enableGC: true,
    progressFile: 'sync-progress.json'
  };
  
  private processedBatches = 0;
  private memoryPeak = 0;
  private startMemory = 0;
  private progress: SyncProgress | null = null;
  private existingPageIds: Set<string> = new Set();

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
   * 進捗ファイルを読み込み
   */
  private loadProgress(): SyncProgress | null {
    try {
      if (fs.existsSync(this.config.progressFile)) {
        const data = fs.readFileSync(this.config.progressFile, 'utf8');
        const progress = JSON.parse(data) as SyncProgress;
        console.log(`📂 進捗ファイルを読み込みました: ${progress.processedPages}/${progress.totalPages}ページ処理済み`);
        return progress;
      }
    } catch (error) {
      console.error('❌ 進捗ファイルの読み込みエラー:', error);
    }
    return null;
  }

  /**
   * 進捗ファイルを保存
   */
  private saveProgress(progress: SyncProgress): void {
    try {
      fs.writeFileSync(this.config.progressFile, JSON.stringify(progress, null, 2));
    } catch (error) {
      console.error('❌ 進捗ファイルの保存エラー:', error);
    }
  }

  /**
   * 進捗ファイルを削除
   */
  private deleteProgress(): void {
    try {
      if (fs.existsSync(this.config.progressFile)) {
        fs.unlinkSync(this.config.progressFile);
        console.log('🗑️ 進捗ファイルを削除しました');
      }
    } catch (error) {
      console.error('❌ 進捗ファイルの削除エラー:', error);
    }
  }

  /**
   * 既存ページIDを効率的に取得
   */
  private async loadExistingPageIds(): Promise<void> {
    console.log('📦 既存ページIDを取得中...');
    const startTime = Date.now();

    try {
      const table = await this.lancedbClient.getTable();
      // 軽量な方法でページIDのみを取得
      const dummyVector = new Array(768).fill(0);
      const sampleChunks = await table.search(dummyVector).limit(10000).toArray();
      
      this.existingPageIds.clear();
      sampleChunks.forEach((chunk: any) => {
        this.existingPageIds.add(chunk.pageId.toString());
      });

      console.log(`✅ 既存ページID取得完了: ${this.existingPageIds.size}ページ (${Date.now() - startTime}ms)`);
      
    } catch (error) {
      console.error('❌ 既存ページID取得エラー:', error);
      throw error;
    }
  }

  /**
   * 再開可能なストリーミング同期実行
   */
  async runResumableSync(maxPages: number = 1143): Promise<ResumableSyncResult> {
    const startTime = Date.now();
    console.log('🚀 再開可能なストリーミング同期を開始します...');
    console.log(`📅 開始時刻: ${new Date().toLocaleString()}`);
    console.log(`🎯 対象ページ数: ${maxPages}ページ`);
    console.log(`💾 初期メモリ: ${this.startMemory.toFixed(2)}MB`);
    console.log(`📦 バッチサイズ: ${this.config.batchSize}ページ`);
    console.log(`⏱️ リクエスト間隔: ${this.config.delayBetweenRequests}ms`);
    console.log('='.repeat(80));

    // 1. 進捗ファイルの読み込み
    console.log('\n1️⃣ 進捗ファイルの確認:');
    this.progress = this.loadProgress();
    const isResumed = this.progress !== null;

    if (isResumed) {
      console.log(`✅ 前回の処理を再開します: ${this.progress.processedPages}/${this.progress.totalPages}ページ処理済み`);
      console.log(`📊 前回の結果: 新規${this.progress.newPages}件, 更新${this.progress.updatedPages}件, スキップ${this.progress.skippedPages}件, 除外${this.progress.excludedPages}件`);
    } else {
      console.log('🆕 新規同期を開始します');
      this.progress = {
        lastProcessedPageId: '',
        lastProcessedIndex: 0,
        totalPages: maxPages,
        processedPages: 0,
        newPages: 0,
        updatedPages: 0,
        skippedPages: 0,
        excludedPages: 0,
        errors: 0,
        startTime: new Date().toISOString(),
        lastUpdateTime: new Date().toISOString(),
        batchesProcessed: 0
      };
    }

    try {
      // 2. 既存ページIDの取得
      console.log('\n2️⃣ 既存ページIDの取得:');
      await this.loadExistingPageIds();

      // 3. ストリーミング処理でページを順次取得・処理
      console.log('\n3️⃣ ストリーミング処理開始:');
      let start = this.progress.lastProcessedIndex;
      let hasMore = true;

      while (hasMore && this.progress.processedPages < this.progress.totalPages) {
        try {
          const remainingPages = this.progress.totalPages - this.progress.processedPages;
          const currentLimit = Math.min(this.config.batchSize, remainingPages);
          
          console.log(`\n📄 バッチ ${this.processedBatches + 1}: ページ ${start + 1}-${start + currentLimit} を取得中...`);
          
          // ページ取得
          const pages = await this.getConfluencePages(currentLimit, start);
          
          if (pages.length === 0) {
            hasMore = false;
            console.log('  これ以上ページがありません');
            break;
          }

          console.log(`  ✅ 取得完了: ${pages.length}ページ`);

          // 4. 即座にフィルタリング
          console.log(`  🔍 フィルタリング中...`);
          const { included: filteredPages, excluded: batchExcluded } = 
            await this.filterPagesBatch(pages);
          
          this.progress.excludedPages += batchExcluded.length;
          console.log(`  ✅ フィルタリング完了: 対象${filteredPages.length}件, 除外${batchExcluded.length}件`);

          // 5. 即座に同期処理（既存ページはスキップ）
          if (filteredPages.length > 0) {
            console.log(`  🔄 同期処理中...`);
            const batchResult = await this.processBatchSync(filteredPages);
            
            this.progress.newPages += batchResult.newPages;
            this.progress.updatedPages += batchResult.updatedPages;
            this.progress.skippedPages += batchResult.skippedPages;
            this.progress.errors += batchResult.errors;
            
            console.log(`  ✅ 同期完了: 新規${batchResult.newPages}件, 更新${batchResult.updatedPages}件, スキップ${batchResult.skippedPages}件, エラー${batchResult.errors}件`);
          }

          // 6. 進捗更新
          this.progress.processedPages += pages.length;
          this.progress.lastProcessedIndex = start + pages.length;
          this.progress.lastProcessedPageId = pages[pages.length - 1]?.id || '';
          this.progress.lastUpdateTime = new Date().toISOString();
          this.progress.batchesProcessed = this.processedBatches + 1;

          // 7. 進捗ファイル保存
          this.saveProgress(this.progress);

          // 8. メモリ管理
          this.processedBatches++;
          this.checkAndManageMemory();
          
          // 9. 次のバッチの準備
          start += pages.length;
          
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
          this.progress.errors++;
          this.saveProgress(this.progress);
          hasMore = false;
        }
      }

      const endTime = Date.now();
      const processingTime = endTime - startTime;
      const finalMemory = this.getMemoryUsage();

      // 10. 結果サマリー
      const result: ResumableSyncResult = {
        totalPages: this.progress.totalPages,
        newPages: this.progress.newPages,
        updatedPages: this.progress.updatedPages,
        skippedPages: this.progress.skippedPages,
        excludedPages: this.progress.excludedPages,
        errors: this.progress.errors,
        processingTime,
        memoryPeak: this.memoryPeak,
        batchesProcessed: this.progress.batchesProcessed,
        resumed: isResumed,
        progressFile: this.config.progressFile
      };

      console.log('\n' + '='.repeat(80));
      console.log('🎉 再開可能なストリーミング同期が完了しました！');
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
      console.log(`❌ エラー: ${result.errors}件`);
      console.log(`📦 処理バッチ数: ${result.batchesProcessed}バッチ`);
      console.log(`🔄 再開フラグ: ${result.resumed ? 'Yes' : 'No'}`);
      
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
      
      if (result.errors > 0) {
        console.log(`\n⚠️ エラーが ${result.errors}件発生しました`);
        console.log('🔍 エラーログを確認してください');
      } else {
        console.log('\n✅ エラーは発生しませんでした');
      }

      // 11. 進捗ファイルのクリーンアップ
      if (result.errors === 0) {
        this.deleteProgress();
        console.log('\n✅ 同期が正常に完了したため、進捗ファイルを削除しました');
      } else {
        console.log(`\n💾 進捗ファイルは保持されています: ${this.config.progressFile}`);
        console.log('🔄 エラーを修正後、同じコマンドで再開できます');
      }

      // 12. 結果をJSONファイルに保存
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `resumable-sync-result-${timestamp}.json`;
      fs.writeFileSync(filename, JSON.stringify(result, null, 2));
      console.log(`\n💾 同期結果は ${filename} に保存されました。`);

      return result;

    } catch (error) {
      console.error('❌ 同期処理中にエラーが発生しました:', error);
      if (this.progress) {
        this.saveProgress(this.progress);
        console.log(`💾 進捗は ${this.config.progressFile} に保存されました`);
        console.log('🔄 エラーを修正後、同じコマンドで再開できます');
      }
      throw error;
    }
  }

  // ヘルパーメソッド
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

    for (const page of pages) {
      try {
        const pageId = page.id.toString();
        const isExisting = this.existingPageIds.has(pageId);

        if (!isExisting) {
          // 新規ページのみを処理
          await this.addNewPage(table, page);
          newPages++;
          console.log(`    ✅ 新規ページ追加: ${page.title} (${pageId})`);
        } else {
          // 既存ページはスキップ
          skippedPages++;
          console.log(`    ⏭️ 既存ページスキップ: ${page.title} (${pageId})`);
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
 * 再開可能なストリーミング同期の実行
 */
async function runResumableSync(): Promise<void> {
  console.log('🚀 再開可能なストリーミング同期を開始します...\n');

  try {
    const syncService = new ResumableConfluenceSyncService();
    await syncService.lancedbClient.connect();

    // 全ページ同期の実行
    const result = await syncService.runResumableSync(1143);

    console.log('\n🎉 再開可能なストリーミング同期が正常に完了しました！');
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
    console.log(`🔄 再開フラグ: ${result.resumed ? 'Yes' : 'No'}`);

    if (result.errors > 0) {
      console.log(`\n⚠️ エラーが ${result.errors}件発生しました`);
      console.log('🔄 同じコマンドで再開できます');
    }

  } catch (error) {
    console.error('❌ 再開可能同期中にエラーが発生しました:', error);
    console.log('🔄 同じコマンドで再開できます');
    process.exit(1);
  }
}

// 実行
runResumableSync().catch(console.error);
