/**
 * 20ページの同期テスト
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';

async function sync20Pages() {
  console.log('🚀 20ページの同期を開始...');
  
  try {
    const confluenceSyncService = new ConfluenceSyncService();
    
    // 20ページの同期実行
    const syncResult = await confluenceSyncService.syncPagesByCount(20);
    
    console.log('\n📊 同期結果:');
    console.log(`- 追加されたチャンク数: ${syncResult.added}`);
    console.log(`- 更新されたチャンク数: ${syncResult.updated}`);
    console.log(`- 変更なしのチャンク数: ${syncResult.unchanged}`);
    console.log(`- 除外されたチャンク数: ${syncResult.excluded}`);
    console.log(`- エラー数: ${syncResult.errors.length}`);
    
    // データベースの状態確認
    console.log('\n📊 データベースの状態確認...');
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    
    console.log(`📊 総チャンク数: ${allChunks.length}`);
    
    if (allChunks.length > 0) {
      // ラベルの統計
      let labeledChunks = 0;
      let arrayFromSuccess = 0;
      
      allChunks.forEach((chunk: any) => {
        try {
          const labelsArray = Array.from(chunk.labels);
          arrayFromSuccess++;
          if (labelsArray.length > 0) {
            labeledChunks++;
          }
        } catch (e) {
          // エラーは無視
        }
      });
      
      console.log(`📊 ラベル統計:`);
      console.log(`- Array.from成功: ${arrayFromSuccess}/${allChunks.length}`);
      console.log(`- ラベル付きチャンク: ${labeledChunks}`);
      
      // 最初の3チャンクの詳細
      console.log('\n📄 最初の3チャンク:');
      allChunks.slice(0, 3).forEach((chunk: any, index: number) => {
        console.log(`\nチャンク ${index + 1}:`);
        console.log(`- ID: ${chunk.id}`);
        console.log(`- タイトル: ${chunk.title}`);
        console.log(`- ラベル: [${Array.from(chunk.labels).join(', ')}]`);
        console.log(`- コンテンツ長: ${chunk.content?.length || 0}文字`);
      });
    }
    
    console.log('\n✅ 20ページの同期完了');
    
  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

sync20Pages().catch(console.error);
