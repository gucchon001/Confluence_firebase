/**
 * クイックテスト - 現在の状態確認
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';

async function quickTest() {
  console.log('🔍 現在のデータベース状態を確認中...');
  
  try {
    const confluenceSyncService = new ConfluenceSyncService();
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    
    console.log(`📊 総チャンク数: ${allChunks.length}`);
    
    if (allChunks.length > 0) {
      const firstChunk = allChunks[0];
      console.log('\n📄 最初のチャンク:');
      console.log(`- ID: ${firstChunk.id}`);
      console.log(`- タイトル: ${firstChunk.title}`);
      console.log(`- ラベル: [${Array.from(firstChunk.labels).join(', ')}]`);
      console.log(`- ラベル型: ${typeof firstChunk.labels} (Array.isArray: ${Array.isArray(firstChunk.labels)})`);
      console.log(`- コンテンツ長: ${firstChunk.content?.length || 0}文字`);
    }
    
  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

quickTest().catch(console.error);
