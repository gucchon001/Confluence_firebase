'use server';

import { syncConfluenceData } from './sync-confluence-data';

/**
 * Cloud Schedulerから呼び出されるエンドポイント
 * 毎日深夜に実行される
 */
export async function scheduledSyncConfluenceData(req: Request) {
  try {
    // リクエストの検証（本番環境では適切な認証を実装する）
    // 例: Cloud Schedulerからのリクエストであることを確認する
    
    console.log('Scheduled Confluence data sync triggered');
    
    // データ同期処理を実行
    const result = await syncConfluenceData();
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error in scheduledSyncConfluenceData:', error);
    
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

/**
 * 手動でデータ同期を実行するためのエンドポイント
 * 管理者のみがアクセス可能
 */
export async function manualSyncConfluenceData(req: Request) {
  try {
    // リクエストの認証（管理者のみアクセス可能）
    // 例: Firebase Admin SDKを使用して認証する
    
    console.log('Manual Confluence data sync triggered');
    
    // データ同期処理を実行
    const result = await syncConfluenceData();
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error in manualSyncConfluenceData:', error);
    
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
