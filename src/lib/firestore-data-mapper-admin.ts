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
  
  // 🔍 デバッグ: 全タイムスタンプデータが正しく含まれているか確認
  console.log('🔍 [convertPostLogToAdminFirestore] 入力データ:', {
    serverStartupTime: logData.serverStartupTime,
    ttfbTime: logData.ttfbTime,
    searchTime: logData.searchTime,
    aiGenerationTime: logData.aiGenerationTime,
    totalTime: logData.totalTime
  });
  console.log('🔍 [convertPostLogToAdminFirestore] 出力データ:', {
    serverStartupTime: firestoreData.serverStartupTime,
    ttfbTime: firestoreData.ttfbTime,
    searchTime: firestoreData.searchTime,
    aiGenerationTime: firestoreData.aiGenerationTime,
    totalTime: firestoreData.totalTime
  });
  
  return firestoreData;
}

