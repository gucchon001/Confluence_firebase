/**
 * 差分同期: Confluence APIとLanceDBのページIDを比較して新規ページのみを処理
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import * as fs from 'fs';

interface DifferentialSyncResult {
  confluencePages: number;
  lancedbPages: number;
  newPages: number;
  processedPages: number;
  excludedPages: number;
  errors: number;
  processingTime: number;
  startIndex: number;
  endIndex: number;
}

class DifferentialConfluenceSyncService extends ConfluenceSyncService {
  private config = {
    batchSize: 50,
    delayBetweenRequests: 300,
    memoryCheckInterval: 1,
    maxMemoryMB: 200,
    enableGC: true,
    progressFile: 'differential-sync-progress.json'
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
   * Confluence APIから全ページIDを取得（軽量）
   */
  async getAllConfluencePageIds(maxPages: number = 1143): Promise<string[]> {
    console.log('🔍 Confluence APIから全ページIDを取得中...');
    const allPageIds: string[] = [];
    let start = 0;
    const limit = 50; // Confluence APIの実際の制限に合わせる
    let hasMore = true;
    
    while (hasMore && allPageIds.length < maxPages) {
      try {
        const remainingPages = maxPages - allPageIds.length;
        const currentLimit = Math.min(limit, remainingPages);
        
        console.log(`📄 ページID ${start + 1}-${start + currentLimit} を取得中...`);
        
        const pages = await this.getConfluencePages(currentLimit, start);
        
        if (pages.length === 0) {
          hasMore = false;
          console.log('  これ以上ページがありません');
          break;
        }

        // ページIDのみを抽出
        const pageIds = pages.map(page => page.id.toString());
        allPageIds.push(...pageIds);
        
        console.log(`  ✅ 取得完了: ${pages.length}ページID (累計: ${allPageIds.length})`);

        start += pages.length;
        
        // 取得したページ数がlimitより少ない場合は最後のページ
        if (pages.length < currentLimit) {
          hasMore = false;
          console.log('  最後のページに到達しました');
        }
        
        // API制限を遵守
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
      } catch (error) {
        console.error(`❌ ページID取得エラー (start=${start}): ${error}`);
        hasMore = false;
      }
    }
    
    console.log(`✅ ConfluenceページID取得完了: ${allPageIds.length}ページ`);
    return allPageIds;
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
   * 差分抽出: Confluence - LanceDB
   */
  async findNewPages(confluencePageIds: string[], existingPageIds: Set<string>): Promise<string[]> {
    console.log('🔍 新規ページの差分抽出中...');
    
    const newPageIds = confluencePageIds.filter(pageId => !existingPageIds.has(pageId));
    
    console.log(`📊 差分抽出結果:`);
    console.log(`  📄 Confluenceページ数: ${confluencePageIds.length}`);
    console.log(`  📦 LanceDBページ数: ${existingPageIds.size}`);
    console.log(`  🆕 新規ページ数: ${newPageIds.length}`);
    console.log(`  📈 新規率: ${((newPageIds.length / confluencePageIds.length) * 100).toFixed(1)}%`);
    
    return newPageIds;
  }

  /**
   * 進捗ファイルを読み込み
   */
  private loadProgress(): any {
    try {
      if (fs.existsSync(this.config.progressFile)) {
        const data = fs.readFileSync(this.config.progressFile, 'utf8');
        const progress = JSON.parse(data);
        console.log(`📂 進捗ファイルを読み込みました: ${progress.processedPages}/${progress.newPages}新規ページ処理済み`);
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
  private saveProgress(progress: any): void {
    try {
      fs.writeFileSync(this.config.progressFile, JSON.stringify(progress, null, 2));
    } catch (error) {
      console.error('❌ 進捗ファイルの保存エラー:', error);
    }
  }

  /**
   * 差分同期実行
   */
  async runDifferentialSync(maxPages: number = 1143): Promise<DifferentialSyncResult> {
    const startTime = Date.now();
    console.log('🚀 差分同期を開始します...');
    console.log(`📅 開始時刻: ${new Date().toLocaleString()}`);
    console.log(`🎯 対象ページ数: ${maxPages}ページ`);
    console.log(`💾 初期メモリ: ${this.startMemory.toFixed(2)}MB`);
    console.log('='.repeat(80));

    try {
      // 1. 進捗ファイルの確認
      console.log('\n1️⃣ 進捗ファイルの確認:');
      let progress = this.loadProgress();
      let startIndex = 0;
      let newPageIds: string[] = [];

      if (progress && progress.newPageIds && progress.processedPages < progress.newPages) {
        console.log(`✅ 前回の処理を再開します: ${progress.processedPages}/${progress.newPages}新規ページ処理済み`);
        newPageIds = progress.newPageIds;
        startIndex = progress.processedPages;
      } else {
        console.log('🆕 新規差分同期を開始します');
        
        // 2. Confluence APIから全ページIDを取得
        console.log('\n2️⃣ Confluence APIから全ページIDを取得:');
        const confluencePageIds = await this.getAllConfluencePageIds(maxPages);

        // 3. LanceDBから既存ページIDを取得
        console.log('\n3️⃣ LanceDBから既存ページIDを取得:');
        const existingPageIds = await this.getExistingLanceDBPageIds();

        // 4. 差分抽出
        console.log('\n4️⃣ 新規ページの差分抽出:');
        newPageIds = await this.findNewPages(confluencePageIds, existingPageIds);

        // 進捗ファイルに新規ページIDを保存
        progress = {
          newPageIds,
          newPages: newPageIds.length,
          processedPages: 0,
          excludedPages: 0,
          errors: 0,
          startTime: new Date().toISOString(),
          lastUpdateTime: new Date().toISOString(),
          batchesProcessed: 0
        };
        this.saveProgress(progress);
      }

      if (newPageIds.length === 0) {
        console.log('✅ 新規ページはありません。同期完了です。');
        return {
          confluencePages: 0,
          lancedbPages: 0,
          newPages: 0,
          processedPages: 0,
          excludedPages: 0,
          errors: 0,
          processingTime: Date.now() - startTime,
          startIndex: 0,
          endIndex: 0
        };
      }

      // 5. 新規ページをバッチで処理
      console.log('\n5️⃣ 新規ページのバッチ処理:');
      let processedPages = startIndex;
      let excludedPages = progress.excludedPages;
      let errors = progress.errors;

      const table = await this.lancedbClient.getTable();

      while (processedPages < newPageIds.length) {
        try {
          const remainingPages = newPageIds.length - processedPages;
          const currentBatchSize = Math.min(this.config.batchSize, remainingPages);
          const batchPageIds = newPageIds.slice(processedPages, processedPages + currentBatchSize);
          
          console.log(`\n📄 バッチ ${this.processedBatches + 1}: ページ ${processedPages + 1}-${processedPages + currentBatchSize} を処理中...`);
          console.log(`🆔 処理対象ページID: ${batchPageIds.slice(0, 5).join(', ')}${batchPageIds.length > 5 ? '...' : ''}`);
          
          // バッチでページを取得
          const pages = [];
          for (const pageId of batchPageIds) {
            try {
              const page = await this.getConfluencePageById(pageId);
              if (page) {
                pages.push(page);
              }
            } catch (error) {
              console.error(`    ❌ ページ取得エラー: ${pageId} - ${error}`);
              errors++;
            }
          }

          console.log(`  ✅ ページ取得完了: ${pages.length}ページ`);

          // フィルタリング
          const { included: filteredPages, excluded: batchExcluded } = 
            await this.filterPagesBatch(pages);
          
          excludedPages += batchExcluded.length;
          console.log(`  🔍 フィルタリング完了: 対象${filteredPages.length}件, 除外${batchExcluded.length}件`);

          // 同期処理
          if (filteredPages.length > 0) {
            console.log(`  🔄 同期処理中...`);
            const batchResult = await this.processBatchSync(filteredPages);
            
            console.log(`  ✅ 同期完了: 新規${batchResult.newPages}件, エラー${batchResult.errors}件`);
            errors += batchResult.errors;
          }

          // 進捗更新
          processedPages += batchPageIds.length;
          progress.processedPages = processedPages;
          progress.excludedPages = excludedPages;
          progress.errors = errors;
          progress.lastUpdateTime = new Date().toISOString();
          progress.batchesProcessed = this.processedBatches + 1;

          this.saveProgress(progress);

          // メモリ管理
          this.processedBatches++;
          this.checkAndManageMemory();
          
          // API制限を遵守
          if (processedPages < newPageIds.length) {
            await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenRequests));
          }

        } catch (error) {
          console.error(`❌ バッチ処理エラー (processedPages=${processedPages}): ${error}`);
          errors++;
          this.saveProgress(progress);
          break;
        }
      }

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // 6. 結果サマリー
      const result: DifferentialSyncResult = {
        confluencePages: newPageIds.length + (await this.getExistingLanceDBPageIds()).size,
        lancedbPages: (await this.getExistingLanceDBPageIds()).size,
        newPages: newPageIds.length,
        processedPages,
        excludedPages,
        errors,
        processingTime,
        startIndex,
        endIndex: processedPages
      };

      console.log('\n' + '='.repeat(80));
      console.log('🎉 差分同期が完了しました！');
      console.log('='.repeat(80));
      
      console.log('\n📊 同期結果サマリー:');
      console.log(`📅 開始時刻: ${new Date(startTime).toLocaleString()}`);
      console.log(`📅 終了時刻: ${new Date(endTime).toLocaleString()}`);
      console.log(`⏱️  処理時間: ${(processingTime / 1000).toFixed(2)}秒`);
      console.log(`📄 Confluenceページ数: ${result.confluencePages}`);
      console.log(`📦 LanceDBページ数: ${result.lancedbPages}`);
      console.log(`🆕 新規ページ数: ${result.newPages}`);
      console.log(`📝 処理済みページ: ${result.processedPages}`);
      console.log(`🚫 除外ページ: ${result.excludedPages}`);
      console.log(`❌ エラー: ${result.errors}`);
      console.log(`📦 処理バッチ数: ${this.processedBatches}バッチ`);
      
      console.log('\n💾 メモリ統計:');
      console.log(`📊 ピークメモリ: ${this.memoryPeak.toFixed(2)}MB`);
      
      console.log('\n📈 パフォーマンス指標:');
      console.log(`⚡ 1ページあたり: ${(processingTime / result.processedPages).toFixed(2)}ms`);
      console.log(`📊 処理効率: ${((result.processedPages / result.newPages) * 100).toFixed(1)}%`);
      console.log(`🚫 除外率: ${((result.excludedPages / result.processedPages) * 100).toFixed(1)}%`);
      
      if (result.errors > 0) {
        console.log(`\n⚠️ エラーが ${result.errors}件発生しました`);
        console.log('🔍 エラーログを確認してください');
      } else {
        console.log('\n✅ エラーは発生しませんでした');
      }

      // 7. 進捗ファイルのクリーンアップ
      if (result.errors === 0 && result.processedPages >= result.newPages) {
        fs.unlinkSync(this.config.progressFile);
        console.log('\n✅ 差分同期が正常に完了したため、進捗ファイルを削除しました');
      } else {
        console.log(`\n💾 進捗ファイルは保持されています: ${this.config.progressFile}`);
        console.log('🔄 エラーを修正後、同じコマンドで再開できます');
      }

      // 8. 結果をJSONファイルに保存
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `differential-sync-result-${timestamp}.json`;
      fs.writeFileSync(filename, JSON.stringify(result, null, 2));
      console.log(`\n💾 同期結果は ${filename} に保存されました。`);

      return result;

    } catch (error) {
      console.error('❌ 差分同期中にエラーが発生しました:', error);
      if (progress) {
        this.saveProgress(progress);
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
    errors: number;
  }> {
    let newPages = 0;
    let errors = 0;

    const table = await this.lancedbClient.getTable();

    for (const page of pages) {
      try {
        await this.addNewPage(table, page);
        newPages++;
        console.log(`    ✅ 新規ページ追加: ${page.title} (${page.id})`);
      } catch (error) {
        console.error(`    ❌ ページ処理エラー: ${page.id} - ${error}`);
        errors++;
      }
    }

    return { newPages, errors };
  }
}

/**
 * 差分同期の実行
 */
async function runDifferentialSync(): Promise<void> {
  console.log('🚀 差分同期を開始します...\n');

  try {
    const syncService = new DifferentialConfluenceSyncService();
    await syncService.lancedbClient.connect();

    // 差分同期の実行
    const result = await syncService.runDifferentialSync(1143);

    console.log('\n🎉 差分同期が正常に完了しました！');
    console.log('='.repeat(80));
    console.log('📊 最終結果:');
    console.log(`⏱️  処理時間: ${(result.processingTime / 1000).toFixed(2)}秒`);
    console.log(`📄 Confluenceページ数: ${result.confluencePages}`);
    console.log(`📦 LanceDBページ数: ${result.lancedbPages}`);
    console.log(`🆕 新規ページ数: ${result.newPages}`);
    console.log(`📝 処理済みページ: ${result.processedPages}`);
    console.log(`🚫 除外ページ: ${result.excludedPages}`);
    console.log(`❌ エラー: ${result.errors}`);

    if (result.errors > 0) {
      console.log(`\n⚠️ エラーが ${result.errors}件発生しました`);
      console.log('🔄 同じコマンドで再開できます');
    }

  } catch (error) {
    console.error('❌ 差分同期中にエラーが発生しました:', error);
    console.log('🔄 同じコマンドで再開できます');
    process.exit(1);
  }
}

// 実行
runDifferentialSync().catch(console.error);
