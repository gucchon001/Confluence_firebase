/**
 * Firestoreデータマッピングユーティリティ (サーバー側 Admin SDK用)
 * Firebase Admin SDKを使用したサーバー側専用の変換ロジック
 */

import * as admin from 'firebase-admin';
import type { PostLog } from '@/types';

/**
 * サーバー側 (Admin SDK): Date → Admin Firestore Timestamp
 */
export function convertPostLogToAdminFirestore(logData: Omit<PostLog, 'id'>): any {
  const firestoreData = {
    ...logData,
    timestamp: admin.firestore.Timestamp.fromDate(logData.timestamp),
    processingSteps: logData.processingSteps.map(step => ({
      ...step,
      timestamp: admin.firestore.Timestamp.fromDate(step.timestamp)
    })),
    errors: logData.errors?.map(error => ({
      ...error,
      timestamp: admin.firestore.Timestamp.fromDate(error.timestamp),
      resolvedAt: error.resolvedAt ? admin.firestore.Timestamp.fromDate(error.resolvedAt) : null
    })) || [],
    metadata: logData.metadata
  };
  
  // 🔍 デバッグ: serverStartupTimeが正しく含まれているか確認
  console.log('🔍 [convertPostLogToAdminFirestore] 入力データのserverStartupTime:', logData.serverStartupTime);
  console.log('🔍 [convertPostLogToAdminFirestore] 出力データのserverStartupTime:', firestoreData.serverStartupTime);
  
  return firestoreData;
}

