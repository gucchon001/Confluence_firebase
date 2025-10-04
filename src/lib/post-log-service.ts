'use client';

import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, where, Timestamp } from 'firebase/firestore';
import { app } from './firebase';
import type { PostLog, ProcessingStep, ErrorLog } from '@/types';

const db = getFirestore(app);

/**
 * 投稿ログサービス
 * 投稿データの収集、保存、取得を行う
 */
export class PostLogService {
  private static instance: PostLogService;

  public static getInstance(): PostLogService {
    if (!PostLogService.instance) {
      PostLogService.instance = new PostLogService();
    }
    return PostLogService.instance;
  }

  /**
   * 投稿ログを作成・保存
   */
  async createPostLog(logData: Omit<PostLog, 'id'>): Promise<string> {
    try {
      const postLogsRef = collection(db, 'postLogs');
      const docRef = await addDoc(postLogsRef, {
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
        }))
      });
      
      console.log('Post log created with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error creating post log:', error);
      throw error;
    }
  }

  /**
   * 投稿ログを更新
   */
  async updatePostLog(logId: string, updates: Partial<PostLog>): Promise<void> {
    try {
      const postLogsRef = collection(db, 'postLogs');
      const docRef = doc(postLogsRef, logId);
      
      const updateData: any = { ...updates };
      
      // タイムスタンプを適切に変換
      if (updates.timestamp) {
        updateData.timestamp = Timestamp.fromDate(updates.timestamp);
      }
      
      if (updates.processingSteps) {
        updateData.processingSteps = updates.processingSteps.map(step => ({
          ...step,
          timestamp: Timestamp.fromDate(step.timestamp)
        }));
      }
      
      if (updates.errors) {
        updateData.errors = updates.errors.map(error => ({
          ...error,
          timestamp: Timestamp.fromDate(error.timestamp),
          resolvedAt: error.resolvedAt ? Timestamp.fromDate(error.resolvedAt) : null
        }));
      }
      
      await updateDoc(docRef, updateData);
      console.log('Post log updated:', logId);
    } catch (error) {
      console.error('Error updating post log:', error);
      throw error;
    }
  }

  /**
   * 最近の投稿ログを取得
   */
  async getRecentPostLogs(count: number = 50): Promise<PostLog[]> {
    try {
      const postLogsRef = collection(db, 'postLogs');
      const q = query(
        postLogsRef,
        orderBy('timestamp', 'desc'),
        limit(count)
      );
      
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          question: data.question,
          answer: data.answer,
          searchTime: data.searchTime,
          aiGenerationTime: data.aiGenerationTime,
          totalTime: data.totalTime,
          referencesCount: data.referencesCount,
          answerLength: data.answerLength,
          qualityScore: data.qualityScore,
          timestamp: data.timestamp.toDate(),
          processingSteps: data.processingSteps.map((step: any) => ({
            ...step,
            timestamp: step.timestamp.toDate()
          })),
          errors: data.errors?.map((error: any) => ({
            ...error,
            timestamp: error.timestamp.toDate(),
            resolvedAt: error.resolvedAt?.toDate()
          })),
          metadata: data.metadata
        } as PostLog;
      });
    } catch (error) {
      console.error('Error getting recent post logs:', error);
      throw error;
    }
  }

  /**
   * 指定期間の投稿ログを取得
   */
  async getPostLogsByDateRange(startDate: Date, endDate: Date): Promise<PostLog[]> {
    try {
      const postLogsRef = collection(db, 'postLogs');
      const q = query(
        postLogsRef,
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        where('timestamp', '<=', Timestamp.fromDate(endDate)),
        orderBy('timestamp', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          question: data.question,
          answer: data.answer,
          searchTime: data.searchTime,
          aiGenerationTime: data.aiGenerationTime,
          totalTime: data.totalTime,
          referencesCount: data.referencesCount,
          answerLength: data.answerLength,
          qualityScore: data.qualityScore,
          timestamp: data.timestamp.toDate(),
          processingSteps: data.processingSteps.map((step: any) => ({
            ...step,
            timestamp: step.timestamp.toDate()
          })),
          errors: data.errors?.map((error: any) => ({
            ...error,
            timestamp: error.timestamp.toDate(),
            resolvedAt: error.resolvedAt?.toDate()
          })),
          metadata: data.metadata
        } as PostLog;
      });
    } catch (error) {
      console.error('Error getting post logs by date range:', error);
      throw error;
    }
  }

  /**
   * ユーザー別の投稿ログを取得
   */
  async getPostLogsByUser(userId: string, count: number = 20): Promise<PostLog[]> {
    try {
      const postLogsRef = collection(db, 'postLogs');
      const q = query(
        postLogsRef,
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(count)
      );
      
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          question: data.question,
          answer: data.answer,
          searchTime: data.searchTime,
          aiGenerationTime: data.aiGenerationTime,
          totalTime: data.totalTime,
          referencesCount: data.referencesCount,
          answerLength: data.answerLength,
          qualityScore: data.qualityScore,
          timestamp: data.timestamp.toDate(),
          processingSteps: data.processingSteps.map((step: any) => ({
            ...step,
            timestamp: step.timestamp.toDate()
          })),
          errors: data.errors?.map((error: any) => ({
            ...error,
            timestamp: error.timestamp.toDate(),
            resolvedAt: error.resolvedAt?.toDate()
          })),
          metadata: data.metadata
        } as PostLog;
      });
    } catch (error) {
      console.error('Error getting post logs by user:', error);
      throw error;
    }
  }

  /**
   * エラーが発生した投稿ログを取得
   */
  async getErrorPostLogs(): Promise<PostLog[]> {
    try {
      const postLogsRef = collection(db, 'postLogs');
      const q = query(
        postLogsRef,
        orderBy('timestamp', 'desc'),
        limit(100)
      );
      
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            userId: data.userId,
            question: data.question,
            answer: data.answer,
            searchTime: data.searchTime,
            aiGenerationTime: data.aiGenerationTime,
            totalTime: data.totalTime,
            referencesCount: data.referencesCount,
            answerLength: data.answerLength,
            qualityScore: data.qualityScore,
            timestamp: data.timestamp.toDate(),
            processingSteps: data.processingSteps.map((step: any) => ({
              ...step,
              timestamp: step.timestamp.toDate()
            })),
            errors: data.errors?.map((error: any) => ({
              ...error,
              timestamp: error.timestamp.toDate(),
              resolvedAt: error.resolvedAt?.toDate()
            })),
            metadata: data.metadata
          } as PostLog;
        })
        .filter(log => log.errors && log.errors.length > 0);
    } catch (error) {
      console.error('Error getting error post logs:', error);
      throw error;
    }
  }

  /**
   * パフォーマンス統計を計算
   */
  async getPerformanceStats(): Promise<{
    avgSearchTime: number;
    avgAiTime: number;
    avgTotalTime: number;
    totalPosts: number;
    errorRate: number;
  }> {
    try {
      const postLogs = await this.getRecentPostLogs(100);
      
      if (postLogs.length === 0) {
        return {
          avgSearchTime: 0,
          avgAiTime: 0,
          avgTotalTime: 0,
          totalPosts: 0,
          errorRate: 0
        };
      }

      const totalSearchTime = postLogs.reduce((sum, log) => sum + log.searchTime, 0);
      const totalAiTime = postLogs.reduce((sum, log) => sum + log.aiGenerationTime, 0);
      const totalTime = postLogs.reduce((sum, log) => sum + log.totalTime, 0);
      const errorCount = postLogs.filter(log => log.errors && log.errors.length > 0).length;

      return {
        avgSearchTime: totalSearchTime / postLogs.length,
        avgAiTime: totalAiTime / postLogs.length,
        avgTotalTime: totalTime / postLogs.length,
        totalPosts: postLogs.length,
        errorRate: (errorCount / postLogs.length) * 100
      };
    } catch (error) {
      console.error('Error getting performance stats:', error);
      throw error;
    }
  }
}

// シングルトンインスタンスをエクスポート
export const postLogService = PostLogService.getInstance();
