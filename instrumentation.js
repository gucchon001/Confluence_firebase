/**
 * Next.js Instrumentation
 * サーバー起動時に1回だけ実行される
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  console.log('🚀 [Instrumentation] register() 呼び出し検知');
  
  // メモリ使用量の監視: サーバー起動時
  try {
    const { logMemoryUsage, startMemoryMonitoring } = await import('./src/lib/memory-monitor.ts');
    logMemoryUsage('Server startup - instrumentation.register()');
    
    // 定期的なメモリ監視を開始（1分ごと）
    startMemoryMonitoring(60000);
    console.log('📊 [Memory] Periodic memory monitoring started (every 60s)');
  } catch (error) {
    console.warn('⚠️ [Memory] Failed to initialize memory monitoring:', error);
  }
  
  // サーバーサイドでのみ実行
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🚀 [Instrumentation] サーバー起動検知 - バックグラウンド初期化開始 (NEXT_RUNTIME=nodejs)');
  } else {
    console.log(`⚠️  [Instrumentation] NEXT_RUNTIME=${process.env.NEXT_RUNTIME} - 初期化スキップ`);
    return;
  }
  
  // 🔍 デプロイ時刻を記録（BOM検出ログで使用）
  const deploymentTime = new Date().toISOString();
  const deploymentTimestamp = Date.now();
  
  // グローバル変数として保持（すべてのモジュールからアクセス可能）
  if (typeof globalThis !== 'undefined') {
    globalThis.__DEPLOYMENT_TIME__ = deploymentTime;
    globalThis.__DEPLOYMENT_TIMESTAMP__ = deploymentTimestamp;
  }
  
  // デプロイ時刻をログに出力
  console.log(`📅 [DEPLOYMENT] デプロイ時刻: ${deploymentTime} (${deploymentTimestamp})`);
  console.log(`📅 [DEPLOYMENT] このインスタンスは ${deploymentTime} にデプロイされました`);
    
  const startTime = Date.now();
  
  const fs = require('fs');
  const path = require('path');
  
  console.log('📦 [Instrumentation] データ存在確認中...');
  const lancedbPath = path.resolve(process.cwd(), '.lancedb');
  const dataPath = path.resolve(process.cwd(), 'data');
  const kuromojiDictPath = path.resolve(process.cwd(), 'node_modules/kuromoji/dict');
  const kuromojiStandalonePath = path.resolve(process.cwd(), '.next/standalone/node_modules/kuromoji/dict');
  
  const lancedbExists = fs.existsSync(lancedbPath);
  const dataExists = fs.existsSync(dataPath);
  const kuromojiDictExists = fs.existsSync(kuromojiDictPath);
  const kuromojiStandaloneExists = fs.existsSync(kuromojiStandalonePath);
  
  console.log('📊 [Instrumentation] データチェック結果:');
  console.log(`   - LanceDB: ${lancedbExists ? '✅' : '❌'} (${lancedbPath})`);
  console.log(`   - Domain Knowledge: ${dataExists ? '✅' : '❌'} (${dataPath})`);
  console.log(`   - Kuromoji Dict (node_modules): ${kuromojiDictExists ? '✅' : '❌'}`);
  console.log(`   - Kuromoji Dict (standalone): ${kuromojiStandaloneExists ? '✅' : '❌'}`);
  
  if (!lancedbExists || !dataExists) {
    console.warn('⚠️  [Instrumentation] データが見つかりません！実行時にCloud Storageからダウンロードします...');
  }
  
  if (!kuromojiDictExists && !kuromojiStandaloneExists) {
    console.error('❌ [Instrumentation] Kuromoji辞書ファイルが見つかりません！');
    console.error('   BM25検索が機能しない可能性があります。');
  }
  
  try {
    const { initializeStartupOptimizations } = await import('./src/lib/startup-optimizer.ts');
    
    initializeStartupOptimizations()
      .then(() => {
        const totalTime = Date.now() - startTime;
        console.log(`✅ [Instrumentation] バックグラウンド初期化完了: ${totalTime}ms`);
        console.log('   - Kuromoji: ✅');
        console.log('   - LanceDB: ✅ (ウォームアップ済み)');
        console.log('   - Lunr Index: ✅ (MessagePack)');
        console.log('🎯 検索API準備完了 - ユーザーリクエスト受付可能');
      })
      .catch((error) => {
        console.error('❌ [Instrumentation] バックグラウンド初期化失敗:', error);
        console.log('⚠️  初回検索時に遅延初期化を試みます');
      });
    
    console.log('🏁 [Instrumentation] バックグラウンド初期化をキックオフ（非同期）');
    
  } catch (error) {
    console.error('❌ [Instrumentation] 初期化モジュールのインポート失敗:', error);
  }
}