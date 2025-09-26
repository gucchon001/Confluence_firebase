/**
 * Step 1: 既存ページIDキャッシュの実装とテスト
 * 個別クエリからキャッシュベースの高速チェックへの移行
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';

interface CacheTestResult {
  method: string;
  timeMs: number;
  pagesChecked: number;
  accuracy: number;
  memoryUsage: number;
}

class CacheOptimizedSyncService extends ConfluenceSyncService {
  private existingPageCache: Set<string> = new Set();
  private cacheInitialized: boolean = false;
  private cacheInitTime: number = 0;

  /**
   * 既存ページIDキャッシュを初期化
   */
  async initializeCache(): Promise<void> {
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

      this.cacheInitTime = Date.now() - startTime;
      console.log(`✅ キャッシュ初期化完了: ${this.existingPageCache.size}ページ (${this.cacheInitTime}ms)`);
      this.cacheInitialized = true;
    } catch (error) {
      console.error('❌ キャッシュ初期化エラー:', error);
      throw error;
    }
  }

  /**
   * キャッシュベースの高速ページ存在チェック
   */
  async fastCheckPageExists(pageId: string): Promise<boolean> {
    if (!this.cacheInitialized) {
      throw new Error('キャッシュが初期化されていません');
    }
    return this.existingPageCache.has(pageId);
  }

  /**
   * 従来の個別クエリによるページ存在チェック
   */
  async slowCheckPageExists(pageId: string): Promise<boolean> {
    const table = await this.lancedbClient.getTable();
    const existingChunks = await this.findExistingChunks(table, pageId);
    return existingChunks.length > 0;
  }

  /**
   * キャッシュの整合性を検証
   */
  async validateCacheIntegrity(): Promise<{
    isValid: boolean;
    discrepancies: string[];
    accuracy: number;
  }> {
    console.log('🔍 キャッシュの整合性を検証中...');
    
    const discrepancies: string[] = [];
    let totalChecked = 0;
    let matches = 0;

    try {
      const table = await this.lancedbClient.getTable();
      const dummyVector = new Array(768).fill(0);
      const allChunks = await table.search(dummyVector).limit(10000).toArray();
      
      // 実際のDBから既存ページIDを取得
      const actualExistingPages = new Set(
        allChunks.map((chunk: any) => chunk.pageId.toString())
      );

      // キャッシュと実際のDBを比較
      for (const pageId of this.existingPageCache) {
        totalChecked++;
        if (actualExistingPages.has(pageId)) {
          matches++;
        } else {
          discrepancies.push(`キャッシュにあるがDBにない: ${pageId}`);
        }
      }

      // DBにあってキャッシュにないページもチェック
      for (const pageId of actualExistingPages) {
        if (!this.existingPageCache.has(pageId)) {
          discrepancies.push(`DBにあるがキャッシュにない: ${pageId}`);
        }
      }

      const accuracy = totalChecked > 0 ? (matches / totalChecked) * 100 : 100;
      const isValid = discrepancies.length === 0;

      console.log(`✅ キャッシュ整合性検証完了:`);
      console.log(`   - 総チェック数: ${totalChecked}`);
      console.log(`   - 一致数: ${matches}`);
      console.log(`   - 不一致数: ${discrepancies.length}`);
      console.log(`   - 精度: ${accuracy.toFixed(2)}%`);
      console.log(`   - 整合性: ${isValid ? 'OK' : 'NG'}`);

      return { isValid, discrepancies, accuracy };
    } catch (error) {
      console.error('❌ キャッシュ整合性検証エラー:', error);
      return { isValid: false, discrepancies: [`検証エラー: ${error}`], accuracy: 0 };
    }
  }

  /**
   * メモリ使用量を測定
   */
  getMemoryUsage(): number {
    // キャッシュサイズの概算（ページID文字列の平均長 × ページ数）
    const avgPageIdLength = 10; // 平均的なページIDの長さ
    const memoryUsageBytes = this.existingPageCache.size * avgPageIdLength;
    return memoryUsageBytes;
  }
}

/**
 * キャッシュ最適化のパフォーマンステスト
 */
async function testCacheOptimization(): Promise<void> {
  console.log('🧪 Step 1: キャッシュ最適化のパフォーマンステストを開始します...\n');

  try {
    const cacheService = new CacheOptimizedSyncService();
    await cacheService.lancedbClient.connect();

    // テスト用のページIDを取得
    console.log('📄 テスト用のページIDを取得中...');
    const testPages = await cacheService.getAllConfluencePages(50);
    const testPageIds = testPages.map(page => page.id.toString());
    console.log(`✅ ${testPageIds.length}個のテストページIDを取得しました`);

    // 1. キャッシュ初期化
    console.log('\n1️⃣ キャッシュ初期化テスト:');
    await cacheService.initializeCache();
    
    const memoryUsage = cacheService.getMemoryUsage();
    console.log(`📊 メモリ使用量: ${(memoryUsage / 1024).toFixed(2)}KB`);

    // 2. キャッシュ整合性検証
    console.log('\n2️⃣ キャッシュ整合性検証:');
    const integrityResult = await cacheService.validateCacheIntegrity();
    
    if (!integrityResult.isValid) {
      console.log('⚠️ キャッシュに不一致が検出されました:');
      integrityResult.discrepancies.slice(0, 5).forEach(discrepancy => {
        console.log(`   - ${discrepancy}`);
      });
      if (integrityResult.discrepancies.length > 5) {
        console.log(`   ... 他${integrityResult.discrepancies.length - 5}件`);
      }
    }

    // 3. パフォーマンス比較テスト
    console.log('\n3️⃣ パフォーマンス比較テスト:');
    
    const testResults: CacheTestResult[] = [];

    // 3.1 従来の個別クエリ方式
    console.log('   🔍 従来の個別クエリ方式をテスト中...');
    const slowStartTime = Date.now();
    let slowAccuracy = 0;
    
    for (let i = 0; i < Math.min(20, testPageIds.length); i++) {
      const pageId = testPageIds[i];
      const exists = await cacheService.slowCheckPageExists(pageId);
      // 精度チェック（実際のDBと比較）
      const actualExists = await cacheService.slowCheckPageExists(pageId);
      if (exists === actualExists) slowAccuracy++;
    }
    
    const slowTime = Date.now() - slowStartTime;
    const slowAccuracyPercent = (slowAccuracy / Math.min(20, testPageIds.length)) * 100;

    testResults.push({
      method: '従来の個別クエリ',
      timeMs: slowTime,
      pagesChecked: Math.min(20, testPageIds.length),
      accuracy: slowAccuracyPercent,
      memoryUsage: 0
    });

    // 3.2 キャッシュベース方式
    console.log('   ⚡ キャッシュベース方式をテスト中...');
    const fastStartTime = Date.now();
    let fastAccuracy = 0;
    
    for (let i = 0; i < testPageIds.length; i++) {
      const pageId = testPageIds[i];
      const exists = await cacheService.fastCheckPageExists(pageId);
      // 精度チェック（実際のDBと比較）
      const actualExists = await cacheService.slowCheckPageExists(pageId);
      if (exists === actualExists) fastAccuracy++;
    }
    
    const fastTime = Date.now() - fastStartTime;
    const fastAccuracyPercent = (fastAccuracy / testPageIds.length) * 100;

    testResults.push({
      method: 'キャッシュベース',
      timeMs: fastTime,
      pagesChecked: testPageIds.length,
      accuracy: fastAccuracyPercent,
      memoryUsage: memoryUsage
    });

    // 4. 結果分析
    console.log('\n4️⃣ パフォーマンステスト結果:');
    console.log('='.repeat(80));
    
    testResults.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.method}:`);
      console.log(`   ⏱️  処理時間: ${result.timeMs}ms`);
      console.log(`   📊 チェックページ数: ${result.pagesChecked}ページ`);
      console.log(`   🎯 精度: ${result.accuracy.toFixed(2)}%`);
      console.log(`   💾 メモリ使用量: ${(result.memoryUsage / 1024).toFixed(2)}KB`);
      
      if (result.pagesChecked > 0) {
        console.log(`   📈 1ページあたり: ${(result.timeMs / result.pagesChecked).toFixed(2)}ms`);
      }
    });

    // 5. 改善効果の計算
    console.log('\n5️⃣ 改善効果分析:');
    const slowResult = testResults[0];
    const fastResult = testResults[1];
    
    const timeImprovement = slowResult.timeMs - fastResult.timeMs;
    const timeImprovementPercent = (timeImprovement / slowResult.timeMs) * 100;
    const speedMultiplier = slowResult.timeMs / fastResult.timeMs;
    
    console.log(`📈 時間改善: ${timeImprovement}ms (${timeImprovementPercent.toFixed(1)}%)`);
    console.log(`🚀 速度向上: ${speedMultiplier.toFixed(1)}倍`);
    console.log(`🎯 精度比較: 従来${slowResult.accuracy.toFixed(1)}% vs キャッシュ${fastResult.accuracy.toFixed(1)}%`);
    
    // 6. 品質チェック
    console.log('\n6️⃣ 品質チェック結果:');
    const qualityChecks = {
      cacheIntegrity: integrityResult.isValid,
      accuracyMaintained: fastResult.accuracy >= slowResult.accuracy * 0.95, // 5%以内の精度低下は許容
      memoryReasonable: fastResult.memoryUsage < 1024 * 1024, // 1MB以下
      performanceImproved: timeImprovementPercent > 50 // 50%以上の改善
    };

    console.log(`✅ キャッシュ整合性: ${qualityChecks.cacheIntegrity ? 'OK' : 'NG'}`);
    console.log(`✅ 精度維持: ${qualityChecks.accuracyMaintained ? 'OK' : 'NG'}`);
    console.log(`✅ メモリ使用量: ${qualityChecks.memoryReasonable ? 'OK' : 'NG'}`);
    console.log(`✅ パフォーマンス改善: ${qualityChecks.performanceImproved ? 'OK' : 'NG'}`);

    const allQualityChecksPass = Object.values(qualityChecks).every(check => check);
    
    if (allQualityChecksPass) {
      console.log('\n🎉 Step 1完了: キャッシュ最適化が成功しました！');
      console.log('✅ 次のステップに進むことができます');
    } else {
      console.log('\n⚠️ Step 1警告: 品質チェックで問題が検出されました');
      console.log('🔧 問題を修正してから次のステップに進んでください');
    }

    // 7. 次のステップへの推奨事項
    console.log('\n📋 次のステップへの推奨事項:');
    if (allQualityChecksPass) {
      console.log('✅ Step 2: バッチクエリの実装に進むことができます');
      console.log('✅ キャッシュ機能は本番環境で使用可能です');
    } else {
      console.log('🔧 キャッシュの精度問題を修正してください');
      console.log('🔧 メモリ使用量の最適化を検討してください');
    }

  } catch (error) {
    console.error('❌ Step 1テスト中にエラーが発生しました:', error);
    throw error;
  }
}

// 実行
testCacheOptimization().catch(console.error);
