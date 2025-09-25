/**
 * 全データを削除するスクリプト
 */

import 'dotenv/config';
import { LanceDBClient } from '../lib/lancedb-client';

async function clearAllData() {
  console.log('🗑️ 全データを削除します...');
  
  try {
    const client = LanceDBClient.getInstance();
    await client.connect();
    const table = await client.getTable();
    
    // 全データを削除
    await table.delete('"pageId" > 0');
    
    console.log('✅ 全データを削除しました');
    
    // 削除後の状態を確認
    const dummyVector = new Array(768).fill(0);
    const remainingData = await table.search(dummyVector).limit(5).toArray();
    console.log(`📊 残存データ数: ${remainingData.length}件`);
    
  } catch (error) {
    console.error('❌ データ削除エラー:', error);
  }
}

clearAllData().catch(console.error);
