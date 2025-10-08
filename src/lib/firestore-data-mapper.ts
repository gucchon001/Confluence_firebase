/**
 * Firestoreデータマッピングユーティリティ (クライアント側)
 * PostLogやその他のFirestoreドキュメントの変換ロジックを共通化
 */

import { Timestamp } from 'firebase/firestore';
import type { PostLog, ProcessingStep, ErrorLog } from '@/types';

/**
 * クライアント側: Date → Firestore Timestamp
 */
export function convertPostLogToFirestore(logData: Omit<PostLog, 'id'>): any {
  return {
    ...logData,
    timestamp: Timestamp.fromDate(logData.timestamp),
    processingSteps: logData.processingSteps.map(step => ({
      ...step,
      timestamp: Timestamp.fromDate(step.timestamp)
    })),
    errors: logData.errors?.map(error => ({
      ...error,
      timestamp: Timestamp.fromDate(error.timestamp),
      resolvedAt: error.resolvedAt ? Timestamp.fromDate(error.resolvedAt) : null
    })) || []
  };
}

/**
 * Firestore → PostLog (クライアント側)
 */
export function convertFirestoreToPostLog(docId: string, data: any): PostLog {
  // 🔍 デバッグ: Firestoreから取得したデータを確認
  console.log('🔍 [convertFirestoreToPostLog] Firestoreデータ確認:', {
    docId,
    serverStartupTime: data.serverStartupTime,
    searchTime: data.searchTime,
    aiGenerationTime: data.aiGenerationTime,
    totalTime: data.totalTime,
    referencesCount: data.referencesCount
  });
  
  const postLog = {
    id: docId,
    userId: data.userId,
    question: data.question,
    answer: data.answer,
    serverStartupTime: data.serverStartupTime || 0, // サーバー起動時間を追加（デフォルト0）
    searchTime: data.searchTime || 0, // デフォルト値0を追加
    aiGenerationTime: data.aiGenerationTime || 0, // デフォルト値0を追加
    totalTime: data.totalTime || 0, // デフォルト値0を追加
    referencesCount: data.referencesCount || 0, // デフォルト値0を追加
    references: data.references,
    answerLength: data.answerLength || 0, // デフォルト値0を追加
    qualityScore: data.qualityScore,
    timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp),
    processingSteps: data.processingSteps?.map((step: any) => ({
      ...step,
      timestamp: step.timestamp?.toDate ? step.timestamp.toDate() : new Date(step.timestamp)
    })) || [],
    errors: data.errors?.map((error: any) => ({
      ...error,
      timestamp: error.timestamp?.toDate ? error.timestamp.toDate() : new Date(error.timestamp),
      resolvedAt: error.resolvedAt?.toDate ? error.resolvedAt.toDate() : null
    })) || [],
    metadata: data.metadata || {
      sessionId: 'unknown',
      userAgent: 'unknown',
      ipAddress: 'unknown'
    }
  };
  
  // 🔍 デバッグ: 変換後のPostLogを確認
  console.log('🔍 [convertFirestoreToPostLog] 変換後PostLog確認:', {
    docId,
    serverStartupTime: postLog.serverStartupTime,
    searchTime: postLog.searchTime,
    aiGenerationTime: postLog.aiGenerationTime,
    totalTime: postLog.totalTime,
    referencesCount: postLog.referencesCount
  });
  
  return postLog;
}

