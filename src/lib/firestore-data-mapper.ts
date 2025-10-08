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
  return {
    id: docId,
    userId: data.userId,
    question: data.question,
    answer: data.answer,
    searchTime: data.searchTime,
    aiGenerationTime: data.aiGenerationTime,
    totalTime: data.totalTime,
    referencesCount: data.referencesCount,
    references: data.references,
    answerLength: data.answerLength,
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
}

