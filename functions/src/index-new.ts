/**
 * Cloud Functions エントリーポイント
 */
import * as admin from 'firebase-admin';
import { syncConfluenceData, manualSyncConfluenceData } from './sync-functions';

// Firebase初期化
admin.initializeApp();

// Cloud Functions をエクスポート
export {
  syncConfluenceData,
  manualSyncConfluenceData
};
