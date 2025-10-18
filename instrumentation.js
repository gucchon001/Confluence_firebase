/**
 * Next.js Instrumentation
 * サーバー起動時に1回だけ実行される
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // サーバーサイドでのみ実行
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🚀 [Instrumentation] サーバー起動検知 - バックグラウンド初期化開始');
    
    const startTime = Date.now();
    
    try {
      // Phase 6最適化: サーバー起動時にバックグラウンドで事前ロード
      const { initializeStartupOptimizations } = await import('./src/lib/startup-optimizer.ts');
      
      // 非同期でバックグラウンド初期化（ブロックしない）
      initializeStartupOptimizations()
        .then(() => {
          const totalTime = Date.now() - startTime;
          console.log(`✅ [Instrumentation] バックグラウンド初期化完了: ${totalTime}ms`);
          console.log(`   - Kuromoji: ✅`);
          console.log(`   - Lunr Index: ✅ (MessagePack)`);
          console.log(`🎯 検索API準備完了 - ユーザーリクエスト受付可能`);
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
}

