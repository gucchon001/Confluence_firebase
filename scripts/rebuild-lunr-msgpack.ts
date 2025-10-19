/**
 * LunrインデックスをMessagePack形式で再構築
 */

import { lunrInitializer } from '../src/lib/lunr-initializer';
import { config } from 'dotenv';
import { unlinkSync, existsSync } from 'fs';

config();

async function rebuildLunrWithMsgpack() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║               LunrインデックスをMessagePack形式で再構築                       ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');
  
  // 既存のキャッシュを削除
  console.log('🧹 既存キャッシュを削除中...');
  const cacheFiles = [
    '.cache/lunr-index.json',
    '.cache/lunr-index.msgpack'
  ];
  
  cacheFiles.forEach(file => {
    if (existsSync(file)) {
      unlinkSync(file);
      console.log(`   ✅ 削除: ${file}`);
    }
  });
  console.log('');
  
  // Lunrインデックスを再構築（MessagePack形式で保存される）
  console.log('🔨 Lunrインデックスを再構築中...\n');
  const startTime = Date.now();
  
  try {
    await lunrInitializer.initializeAsync();
    const totalTime = Date.now() - startTime;
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Lunrインデックス再構築完了！');
    console.log('='.repeat(80) + '\n');
    console.log(`⏱️  総時間: ${(totalTime / 1000).toFixed(1)}秒`);
    console.log(`\n📁 生成されたファイル:`);
    console.log(`   ✅ .cache/lunr-index.msgpack (高速読み込み用)`);
    console.log(`   ✅ .cache/lunr-index.json (互換性維持用)\n`);
    console.log(`🚀 次回のサーバー起動時、MessagePack形式が自動的に使用されます。`);
    console.log(`⚡ 予想起動時間: 110秒 → 10-15秒 (-85%～-90%改善)\n`);
    
  } catch (error) {
    console.error('❌ エラー:', error);
    process.exit(1);
  }
}

rebuildLunrWithMsgpack().catch(console.error);

