/**
 * 差分更新機能のE2Eテスト
 * 
 * このテストでは、実際のConfluence APIとFirestoreを使用して差分更新機能をテストします。
 * 注意: このテストを実行するには、.envファイルに適切な認証情報が設定されている必要があります。
 * また、実際のデータに対して実行されるため、テスト環境でのみ実行してください。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// 環境変数のロード
dotenv.config();

// Firebase Adminの初期化
let firestore: admin.firestore.Firestore;

describe('差分更新機能のE2Eテスト', () => {
  beforeAll(() => {
    // Firebase Adminの初期化
    if (!admin.apps.length) {
      const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (!serviceAccountPath || !fs.existsSync(serviceAccountPath)) {
        throw new Error('GOOGLE_APPLICATION_CREDENTIALS環境変数が設定されていないか、ファイルが存在しません。');
      }
      
      try {
        const serviceAccount = require(path.resolve(serviceAccountPath));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      } catch (error) {
        throw new Error(`Firebase Admin SDK初期化エラー: ${error}`);
      }
    }
    
    firestore = admin.firestore();
  });

  afterAll(async () => {
    // テスト後のクリーンアップ
    await Promise.all(admin.apps.map(app => app?.delete()));
  });

  it('差分更新モードで実行すると前回の同期以降に更新されたページのみを処理すること', async () => {
    // 1. 最初に全同期を実行して基準を作成
    console.log('全同期を実行中...');
    execSync('npm run sync:confluence:batch -- --all', { stdio: 'inherit' });
    
    // 2. 最初の同期ログを取得
    const initialSyncQuery = await firestore.collection('syncLogs')
      .where('type', '==', 'complete')
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();
    
    if (initialSyncQuery.empty) {
      throw new Error('初期同期ログが見つかりません');
    }
    
    const initialSync = initialSyncQuery.docs[0].data();
    const initialTotalPages = initialSync.totalPages || 0;
    console.log(`初期同期: ${initialTotalPages}ページ処理`);
    
    // 3. 少し待機（Confluenceでページを更新する時間を確保）
    console.log('30秒待機中... この間にConfluenceで1〜2ページを更新してください');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // 4. 差分更新を実行
    console.log('差分更新を実行中...');
    execSync('npm run sync:confluence:differential', { stdio: 'inherit' });
    
    // 5. 差分更新のログを取得
    const diffSyncQuery = await firestore.collection('syncLogs')
      .where('type', '==', 'complete')
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();
    
    if (diffSyncQuery.empty) {
      throw new Error('差分同期ログが見つかりません');
    }
    
    const diffSync = diffSyncQuery.docs[0].data();
    const diffTotalPages = diffSync.totalPages || 0;
    console.log(`差分同期: ${diffTotalPages}ページ処理`);
    
    // 6. 差分更新で処理されたページ数が全同期より少ないことを確認
    expect(diffTotalPages).toBeLessThan(initialTotalPages);
    expect(diffTotalPages).toBeGreaterThanOrEqual(0);
    
    // 7. 差分更新のログに前回の同期時刻が含まれていることを確認
    const startLogQuery = await firestore.collection('syncLogs')
      .where('type', '==', 'start')
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();
    
    if (!startLogQuery.empty) {
      const startLog = startLogQuery.docs[0].data();
      expect(startLog).toHaveProperty('lastSyncTime');
      expect(typeof startLog.lastSyncTime).toBe('string');
    }
  }, 180000); // 3分のタイムアウト
});
