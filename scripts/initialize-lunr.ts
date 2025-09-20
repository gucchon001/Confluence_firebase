/**
 * Lunrインデックス初期化スクリプト
 * 手動でLunrインデックスを初期化するためのスクリプト
 */

import { lunrInitializer } from '../src/lib/lunr-initializer';

async function main() {
  console.log('🚀 Starting Lunr index initialization...');
  
  try {
    await lunrInitializer.initializeAsync();
    console.log('✅ Lunr index initialization completed successfully');
  } catch (error) {
    console.error('❌ Lunr index initialization failed:', error);
    process.exit(1);
  }
}

main();
