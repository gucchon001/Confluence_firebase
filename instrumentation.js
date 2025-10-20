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
    
    // Phase 0A-4 FIX: Cloud Run Gen2 + インメモリファイルシステム対応
    const fs = require('fs');
    const path = require('path');
    
    // Phase 0A-4: Cloud Run Gen2環境検知
    const isCloudRun = process.env.K_SERVICE !== undefined;
    const useInMemoryFS = process.env.USE_INMEMORY_FS === 'true' && isCloudRun;
    
    if (useInMemoryFS) {
      console.log('🔥 [Instrumentation] Cloud Run Gen2モード: インメモリファイルシステムを使用');
      
      // GCSからデータをダウンロードして /dev/shm にコピー
      try {
        // Phase 0A-4 FIX: await import() を使用（require()ではなく）
        // startup-optimizer.ts と同じパターンに統一
        const { loadDataToMemory } = await import('./src/lib/inmemory-data-loader.js');
        await loadDataToMemory();
        console.log('✅ [Instrumentation] データをメモリにロード完了');
      } catch (error) {
        console.error('❌ [Instrumentation] メモリロード失敗:', error);
        console.error('   詳細:', error.stack);
        console.error('   フォールバック: 通常のファイルシステムを使用します');
      }
    }
    
    console.log('📦 [Instrumentation] データ存在確認中...');
    const lancedbPath = useInMemoryFS 
      ? '/dev/shm/.lancedb' 
      : path.resolve(process.cwd(), '.lancedb');
    const dataPath = useInMemoryFS
      ? '/dev/shm/data'
      : path.resolve(process.cwd(), 'data');
    const kuromojiDictPath = path.resolve(process.cwd(), 'node_modules/kuromoji/dict');
    const kuromojiStandalonePath = path.resolve(process.cwd(), '.next/standalone/node_modules/kuromoji/dict');
    
    const lancedbExists = fs.existsSync(lancedbPath);
    const dataExists = fs.existsSync(dataPath);
    const kuromojiDictExists = fs.existsSync(kuromojiDictPath);
    const kuromojiStandaloneExists = fs.existsSync(kuromojiStandalonePath);
    
    console.log(`📊 [Instrumentation] データチェック結果:`);
    console.log(`   - モード: ${useInMemoryFS ? 'InMemory (/dev/shm)' : 'FileSystem'}`);
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

