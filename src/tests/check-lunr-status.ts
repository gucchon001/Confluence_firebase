/*
 * Lunr Index状態の詳細確認
 */

import { lunrInitializer } from '../lib/lunr-initializer';
import { lunrSearchClient } from '../lib/lunr-search-client';
import { promises as fs } from 'fs';
import path from 'path';

async function checkLunrStatus() {
  console.log('=== Lunr Index状態の詳細確認 ===');
  
  // 初期化状態の確認
  const status = lunrInitializer.getStatus();
  console.log('初期化状態:', JSON.stringify(status, null, 2));
  
  // Lunr検索クライアントの状態確認
  const isReady = lunrSearchClient.isReady();
  console.log('Lunr検索クライアント準備完了:', isReady);
  
  // キャッシュファイルの存在確認
  const cachePath = path.join('.cache', 'lunr-index.json');
  
  try {
    const stats = await fs.stat(cachePath);
    console.log('キャッシュファイル存在:', true);
    console.log('キャッシュファイルサイズ:', stats.size, 'bytes');
    console.log('キャッシュファイル更新日時:', stats.mtime);
  } catch (error) {
    console.log('キャッシュファイル存在:', false);
    console.log('エラー:', (error as Error).message);
  }
  
  // LanceDBの状態確認
  try {
    const lancedb = await import('@lancedb/lancedb');
    const db = await lancedb.connect('.lancedb');
    const tbl = await db.openTable('confluence');
    const count = await tbl.countRows();
    console.log('LanceDBドキュメント数:', count);
  } catch (error) {
    console.log('LanceDB接続エラー:', (error as Error).message);
  }
  
  // アプリケーション起動時の初期化呼び出し確認
  console.log('\n=== アプリケーション起動時の初期化確認 ===');
  
  // Next.jsアプリケーションでの初期化呼び出しを確認
  try {
    const { initializeStartupOptimizations } = await import('../lib/startup-optimizer');
    console.log('startup-optimizer モジュール:', '存在');
    
    // 手動で初期化を実行してみる
    console.log('\n--- 手動初期化の実行 ---');
    await initializeStartupOptimizations();
    
    // Lunrインデックスの初期化
    await lunrInitializer.initializeAsync();
    
    // 初期化後の状態確認
    const finalStatus = lunrInitializer.getStatus();
    console.log('手動初期化後の状態:', JSON.stringify(finalStatus, null, 2));
    
  } catch (error) {
    console.log('startup-optimizer エラー:', (error as Error).message);
  }
}

checkLunrStatus().catch(console.error);
