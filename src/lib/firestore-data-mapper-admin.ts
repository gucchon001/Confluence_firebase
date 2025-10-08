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
  return {
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
}

