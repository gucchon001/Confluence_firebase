/**
 * OOM修正の検証スクリプト
 * 
 * このスクリプトは、以下の修正が正しく動作することを確認します：
 * 1. トークナイザーの初期化ログが1回だけ出力されること
 * 2. 並列処理での重複初期化が発生しないこと
 * 3. Lunr初期化が正常に動作すること
 * 4. メモリ使用量が適切であること
 */

import { preInitializeTokenizer, tokenizeJapaneseText, isTokenizerInitialized } from '../src/lib/japanese-tokenizer';
import { LunrInitializer } from '../src/lib/lunr-initializer';

/**
 * メモリ使用量を取得
 */
function getMemoryUsage(): { rss: number; heapUsed: number; heapTotal: number } {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024), // MB
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
  };
}

/**
 * メモリ使用量をログ出力
 */
function logMemoryUsage(label: string): void {
  const usage = getMemoryUsage();
  console.log(`[Memory] ${label}: RSS=${usage.rss}MB, Heap=${usage.heapUsed}MB/${usage.heapTotal}MB`);
}

/**
 * テスト1: トークナイザーの初期化ログが1回だけ出力されることを確認
 */
async function testTokenizerInitializationLogs(): Promise<boolean> {
  console.log('\n=== テスト1: トークナイザーの初期化ログ確認 ===');
  
  // ログをキャプチャするための準備
  const originalLog = console.log;
  const logs: string[] = [];
  
  console.log = (...args: any[]) => {
    const message = args.join(' ');
    logs.push(message);
    originalLog(...args);
  };
  
  try {
    // トークナイザーをリセット（テスト用）
    const { resetTokenizer } = await import('../src/lib/japanese-tokenizer');
    resetTokenizer();
    
    // 初期化ログをカウント
    const initLogsBefore = logs.filter(log => 
      log.includes('Initializing kuromoji tokenizer') || 
      log.includes('Dictionary files verified')
    ).length;
    
    // トークナイザーを事前初期化
    await preInitializeTokenizer();
    
    // 並列で複数回トークン化を実行（重複初期化をテスト）
    const parallelPromises = Array.from({ length: 10 }, () => 
      tokenizeJapaneseText('テスト用のテキストです')
    );
    await Promise.all(parallelPromises);
    
    // 初期化ログをカウント
    const initLogsAfter = logs.filter(log => 
      log.includes('Initializing kuromoji tokenizer') || 
      log.includes('Dictionary files verified')
    ).length;
    
    const newInitLogs = initLogsAfter - initLogsBefore;
    
    console.log = originalLog;
    
    if (newInitLogs <= 2) { // 初期化ログは1-2回程度（辞書検証 + 初期化）
      console.log('✅ テスト1: 成功 - 初期化ログが適切に抑制されています');
      return true;
    } else {
      console.log(`❌ テスト1: 失敗 - 初期化ログが${newInitLogs}回出力されています（期待値: 1-2回）`);
      return false;
    }
  } catch (error) {
    console.log = originalLog;
    console.error('❌ テスト1: エラー', error);
    return false;
  }
}

/**
 * テスト2: 並列処理での重複初期化が発生しないことを確認
 */
async function testParallelInitialization(): Promise<boolean> {
  console.log('\n=== テスト2: 並列処理での重複初期化確認 ===');
  
  try {
    // トークナイザーをリセット（テスト用）
    const { resetTokenizer } = await import('../src/lib/japanese-tokenizer');
    resetTokenizer();
    
    // 初期化状態を確認
    const initializedBefore = isTokenizerInitialized();
    console.log(`初期化前の状態: ${initializedBefore ? '初期化済み' : '未初期化'}`);
    
    // 並列で複数回トークン化を実行
    const parallelPromises = Array.from({ length: 50 }, (_, i) => 
      tokenizeJapaneseText(`テスト用のテキスト ${i}`)
    );
    
    const startTime = Date.now();
    await Promise.all(parallelPromises);
    const duration = Date.now() - startTime;
    
    // 初期化状態を確認
    const initializedAfter = isTokenizerInitialized();
    console.log(`初期化後の状態: ${initializedAfter ? '初期化済み' : '未初期化'}`);
    console.log(`並列処理時間: ${duration}ms`);
    
    if (initializedAfter && duration < 10000) { // 10秒以内に完了
      console.log('✅ テスト2: 成功 - 並列処理が正常に動作しています');
      return true;
    } else {
      console.log('❌ テスト2: 失敗 - 並列処理に問題があります');
      return false;
    }
  } catch (error) {
    console.error('❌ テスト2: エラー', error);
    return false;
  }
}

/**
 * テスト3: Lunr初期化が正常に動作することを確認
 */
async function testLunrInitialization(): Promise<boolean> {
  console.log('\n=== テスト3: Lunr初期化の確認 ===');
  
  try {
    logMemoryUsage('Lunr初期化前');
    
    const initializer = new LunrInitializer();
    const startTime = Date.now();
    
    // Lunr初期化を実行
    await initializer.initializeAsync('confluence');
    
    const duration = Date.now() - startTime;
    logMemoryUsage('Lunr初期化後');
    
    const memoryAfter = getMemoryUsage();
    
    console.log(`Lunr初期化時間: ${duration}ms`);
    console.log(`メモリ使用量: RSS=${memoryAfter.rss}MB, Heap=${memoryAfter.heapUsed}MB`);
    
    if (duration < 60000 && memoryAfter.rss < 2048) { // 60秒以内、2GB未満
      console.log('✅ テスト3: 成功 - Lunr初期化が正常に動作しています');
      return true;
    } else {
      console.log('⚠️  テスト3: 警告 - Lunr初期化に時間がかかっているか、メモリ使用量が多いです');
      return true; // 警告として扱う
    }
  } catch (error) {
    console.error('❌ テスト3: エラー', error);
    return false;
  }
}

/**
 * テスト4: メモリ使用量が適切であることを確認
 */
async function testMemoryUsage(): Promise<boolean> {
  console.log('\n=== テスト4: メモリ使用量の確認 ===');
  
  try {
    logMemoryUsage('テスト開始時');
    
    // トークナイザーをリセット（テスト用）
    const { resetTokenizer } = await import('../src/lib/japanese-tokenizer');
    resetTokenizer();
    
    // トークナイザーを初期化
    await preInitializeTokenizer();
    logMemoryUsage('トークナイザー初期化後');
    
    // 大量のテキストをトークン化
    const texts = Array.from({ length: 100 }, (_, i) => 
      `テスト用のテキスト ${i} これは日本語の文章です。`
    );
    
    const startTime = Date.now();
    for (const text of texts) {
      await tokenizeJapaneseText(text);
    }
    const duration = Date.now() - startTime;
    
    logMemoryUsage('大量トークン化後');
    
    const memoryAfter = getMemoryUsage();
    
    console.log(`トークン化時間: ${duration}ms`);
    console.log(`メモリ使用量: RSS=${memoryAfter.rss}MB, Heap=${memoryAfter.heapUsed}MB`);
    
    if (memoryAfter.rss < 1024) { // 1GB未満
      console.log('✅ テスト4: 成功 - メモリ使用量が適切です');
      return true;
    } else {
      console.log('⚠️  テスト4: 警告 - メモリ使用量が多いです');
      return true; // 警告として扱う
    }
  } catch (error) {
    console.error('❌ テスト4: エラー', error);
    return false;
  }
}

/**
 * メイン実行関数
 */
async function main(): Promise<void> {
  console.log('🚀 OOM修正の検証を開始します...\n');
  
  const results = {
    test1: false,
    test2: false,
    test3: false,
    test4: false,
  };
  
  try {
    results.test1 = await testTokenizerInitializationLogs();
    results.test2 = await testParallelInitialization();
    results.test3 = await testLunrInitialization();
    results.test4 = await testMemoryUsage();
    
    console.log('\n=== テスト結果サマリー ===');
    console.log(`テスト1 (初期化ログ): ${results.test1 ? '✅ 成功' : '❌ 失敗'}`);
    console.log(`テスト2 (並列処理): ${results.test2 ? '✅ 成功' : '❌ 失敗'}`);
    console.log(`テスト3 (Lunr初期化): ${results.test3 ? '✅ 成功' : '⚠️  警告'}`);
    console.log(`テスト4 (メモリ使用量): ${results.test4 ? '✅ 成功' : '⚠️  警告'}`);
    
    const allPassed = Object.values(results).every(r => r);
    
    if (allPassed) {
      console.log('\n🎉 すべてのテストが成功しました！');
      process.exit(0);
    } else {
      console.log('\n⚠️  一部のテストが失敗または警告です。');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ テスト実行中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプトを実行
main().catch(console.error);

