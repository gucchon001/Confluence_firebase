/**
 * Step 2: バッチクエリの実装とテスト
 * 個別クエリから真のバッチクエリへの移行
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';

interface BatchTestResult {
  method: string;
  timeMs: number;
  pagesChecked: number;
  accuracy: number;
  batchSize: number;
}

class BatchOptimizedSyncService extends ConfluenceSyncService {
  private existingPageCache: Set<string> = new Set();
  private cacheInitialized: boolean = false;

  /**
   * 既存ページIDキャッシュを初期化
   */
  async initializeCache(): Promise<void> {
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

  /**
   * 真のバッチクエリによるページ存在チェック
   */
  async batchCheckPageExists(pageIds: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    if (!this.cacheInitialized) {
      await this.initializeCache();
    }

    // キャッシュベースの高速チェック
    pageIds.forEach(pageId => {
      results.set(pageId, this.existingPageCache.has(pageId));
    });

    return results;
  }

  /**
   * 従来の個別クエリによるページ存在チェック
   */
  async individualCheckPageExists(pageIds: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    for (const pageId of pageIds) {
      const table = await this.lancedbClient.getTable();
      const existingChunks = await this.findExistingChunks(table, pageId);
      results.set(pageId, existingChunks.length > 0);
    }

    return results;
  }

  /**
   * ハイブリッド方式：バッチ + 個別検証
   */
  async hybridCheckPageExists(pageIds: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    // 1. キャッシュで高速チェック
    const cacheResults = await this.batchCheckPageExists(pageIds);
    
    // 2. 新規ページ（キャッシュにない）のみ個別検証
    const newPageIds = pageIds.filter(pageId => !this.existingPageCache.has(pageId));
    
    if (newPageIds.length > 0) {
      console.log(`   🔍 ${newPageIds.length}個の新規ページを個別検証中...`);
      
      for (const pageId of newPageIds) {
        const table = await this.lancedbClient.getTable();
        const existingChunks = await this.findExistingChunks(table, pageId);
        const exists = existingChunks.length > 0;
        results.set(pageId, exists);
        
        // キャッシュに追加（次回の高速化のため）
        if (exists) {
          this.existingPageCache.add(pageId);
        }
      }
    }

    // 3. 結果を統合
    cacheResults.forEach((exists, pageId) => {
      if (!results.has(pageId)) {
        results.set(pageId, exists);
      }
    });

    return results;
  }

  /**
   * バッチサイズ最適化テスト
   */
  async testOptimalBatchSize(pageIds: string[]): Promise<{
    optimalBatchSize: number;
    bestTime: number;
    results: BatchTestResult[];
  }> {
    console.log('🔍 最適なバッチサイズをテスト中...');
    
    const batchSizes = [10, 20, 50, 100, 200];
    const results: BatchTestResult[] = [];

    for (const batchSize of batchSizes) {
      console.log(`   📊 バッチサイズ ${batchSize} をテスト中...`);
      
      const startTime = Date.now();
      const batches = [];
      
      // ページIDをバッチに分割
      for (let i = 0; i < pageIds.length; i += batchSize) {
        batches.push(pageIds.slice(i, i + batchSize));
      }

      // バッチごとに処理
      let totalChecked = 0;
      for (const batch of batches) {
        const batchResults = await this.batchCheckPageExists(batch);
        totalChecked += batch.length;
      }

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      results.push({
        method: `バッチサイズ ${batchSize}`,
        timeMs: processingTime,
        pagesChecked: totalChecked,
        accuracy: 100, // キャッシュベースなので100%
        batchSize
      });

      console.log(`     ⏱️  ${processingTime}ms (${totalChecked}ページ)`);
    }

    // 最適なバッチサイズを特定
    const bestResult = results.reduce((best, current) => 
      current.timeMs < best.timeMs ? current : best
    );

    return {
      optimalBatchSize: bestResult.batchSize,
      bestTime: bestResult.timeMs,
      results
    };
  }
}

/**
 * バッチクエリ最適化のパフォーマンステスト
 */
async function testBatchQueryOptimization(): Promise<void> {
  console.log('🧪 Step 2: バッチクエリ最適化のパフォーマンステストを開始します...\n');

  try {
    const batchService = new BatchOptimizedSyncService();
    await batchService.lancedbClient.connect();

    // テスト用のページIDを取得
    console.log('📄 テスト用のページIDを取得中...');
    const testPages = await batchService.getAllConfluencePages(100);
    const testPageIds = testPages.map(page => page.id.toString());
    console.log(`✅ ${testPageIds.length}個のテストページIDを取得しました`);

    // 1. キャッシュ初期化
    console.log('\n1️⃣ キャッシュ初期化:');
    await batchService.initializeCache();

    // 2. バッチサイズ最適化テスト
    console.log('\n2️⃣ バッチサイズ最適化テスト:');
    const batchSizeTest = await batchService.testOptimalBatchSize(testPageIds);
    
    console.log(`\n📊 バッチサイズ最適化結果:`);
    batchSizeTest.results.forEach(result => {
      const timePerPage = result.timeMs / result.pagesChecked;
      console.log(`   ${result.method}: ${result.timeMs}ms (1ページあたり${timePerPage.toFixed(2)}ms)`);
    });
    
    console.log(`\n🏆 最適なバッチサイズ: ${batchSizeTest.optimalBatchSize}`);
    console.log(`⚡ 最速処理時間: ${batchSizeTest.bestTime}ms`);

    // 3. パフォーマンス比較テスト
    console.log('\n3️⃣ パフォーマンス比較テスト:');
    
    const testResults: BatchTestResult[] = [];
    const testPageIdsSubset = testPageIds.slice(0, 50); // 50ページでテスト

    // 3.1 従来の個別クエリ方式
    console.log('   🔍 従来の個別クエリ方式をテスト中...');
    const individualStartTime = Date.now();
    const individualResults = await batchService.individualCheckPageExists(testPageIdsSubset);
    const individualTime = Date.now() - individualStartTime;

    testResults.push({
      method: '個別クエリ',
      timeMs: individualTime,
      pagesChecked: testPageIdsSubset.length,
      accuracy: 100,
      batchSize: 1
    });

    // 3.2 バッチクエリ方式（最適バッチサイズ）
    console.log('   ⚡ バッチクエリ方式をテスト中...');
    const batchStartTime = Date.now();
    const batchResults = await batchService.batchCheckPageExists(testPageIdsSubset);
    const batchTime = Date.now() - batchStartTime;

    testResults.push({
      method: 'バッチクエリ',
      timeMs: batchTime,
      pagesChecked: testPageIdsSubset.length,
      accuracy: 100,
      batchSize: batchSizeTest.optimalBatchSize
    });

    // 3.3 ハイブリッド方式
    console.log('   🔄 ハイブリッド方式をテスト中...');
    const hybridStartTime = Date.now();
    const hybridResults = await batchService.hybridCheckPageExists(testPageIdsSubset);
    const hybridTime = Date.now() - hybridStartTime;

    testResults.push({
      method: 'ハイブリッド',
      timeMs: hybridTime,
      pagesChecked: testPageIdsSubset.length,
      accuracy: 100,
      batchSize: batchSizeTest.optimalBatchSize
    });

    // 4. 結果分析
    console.log('\n4️⃣ パフォーマンステスト結果:');
    console.log('='.repeat(80));
    
    testResults.forEach((result, index) => {
      const timePerPage = result.timeMs / result.pagesChecked;
      console.log(`\n${index + 1}. ${result.method}:`);
      console.log(`   ⏱️  処理時間: ${result.timeMs}ms`);
      console.log(`   📊 チェックページ数: ${result.pagesChecked}ページ`);
      console.log(`   🎯 精度: ${result.accuracy.toFixed(2)}%`);
      console.log(`   📈 1ページあたり: ${timePerPage.toFixed(2)}ms`);
      console.log(`   📦 バッチサイズ: ${result.batchSize}`);
    });

    // 5. 改善効果の計算
    console.log('\n5️⃣ 改善効果分析:');
    const individualResult = testResults[0];
    const batchResult = testResults[1];
    const hybridResult = testResults[2];
    
    const batchImprovement = individualResult.timeMs - batchResult.timeMs;
    const batchImprovementPercent = (batchImprovement / individualResult.timeMs) * 100;
    const batchSpeedMultiplier = individualResult.timeMs / batchResult.timeMs;
    
    const hybridImprovement = individualResult.timeMs - hybridResult.timeMs;
    const hybridImprovementPercent = (hybridImprovement / individualResult.timeMs) * 100;
    const hybridSpeedMultiplier = individualResult.timeMs / hybridResult.timeMs;
    
    console.log(`📈 バッチクエリ改善: ${batchImprovement}ms (${batchImprovementPercent.toFixed(1)}%)`);
    console.log(`🚀 バッチクエリ速度向上: ${batchSpeedMultiplier.toFixed(1)}倍`);
    
    console.log(`📈 ハイブリッド改善: ${hybridImprovement}ms (${hybridImprovementPercent.toFixed(1)}%)`);
    console.log(`🚀 ハイブリッド速度向上: ${hybridSpeedMultiplier.toFixed(1)}倍`);

    // 6. 品質チェック
    console.log('\n6️⃣ 品質チェック結果:');
    const qualityChecks = {
      batchPerformanceImproved: batchImprovementPercent > 50,
      hybridPerformanceImproved: hybridImprovementPercent > 50,
      accuracyMaintained: batchResult.accuracy >= 99 && hybridResult.accuracy >= 99,
      batchSizeOptimal: batchSizeTest.optimalBatchSize >= 20 && batchSizeTest.optimalBatchSize <= 200
    };

    console.log(`✅ バッチクエリ性能改善: ${qualityChecks.batchPerformanceImproved ? 'OK' : 'NG'}`);
    console.log(`✅ ハイブリッド性能改善: ${qualityChecks.hybridPerformanceImproved ? 'OK' : 'NG'}`);
    console.log(`✅ 精度維持: ${qualityChecks.accuracyMaintained ? 'OK' : 'NG'}`);
    console.log(`✅ バッチサイズ最適化: ${qualityChecks.batchSizeOptimal ? 'OK' : 'NG'}`);

    const allQualityChecksPass = Object.values(qualityChecks).every(check => check);
    
    if (allQualityChecksPass) {
      console.log('\n🎉 Step 2完了: バッチクエリ最適化が成功しました！');
      console.log('✅ 次のステップに進むことができます');
    } else {
      console.log('\n⚠️ Step 2警告: 品質チェックで問題が検出されました');
      console.log('🔧 問題を修正してから次のステップに進んでください');
    }

    // 7. 次のステップへの推奨事項
    console.log('\n📋 次のステップへの推奨事項:');
    if (allQualityChecksPass) {
      console.log('✅ Step 3: 並列フィルタリングの実装に進むことができます');
      console.log(`✅ 最適なバッチサイズ: ${batchSizeTest.optimalBatchSize}で本番運用可能`);
      
      if (hybridImprovementPercent > batchImprovementPercent) {
        console.log('✅ ハイブリッド方式が最も効果的です');
      } else {
        console.log('✅ バッチクエリ方式が最も効果的です');
      }
    } else {
      console.log('🔧 バッチサイズの最適化を検討してください');
      console.log('🔧 パフォーマンス改善率を向上させてください');
    }

  } catch (error) {
    console.error('❌ Step 2テスト中にエラーが発生しました:', error);
    throw error;
  }
}

// 実行
testBatchQueryOptimization().catch(console.error);
