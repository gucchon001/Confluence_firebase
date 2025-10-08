'use client';

import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, where, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { app } from './firebase';
import { convertPostLogToFirestore, convertFirestoreToPostLog } from './firestore-data-mapper';
import { createQueryBuilder } from './firestore-query-builder';
import type { PostLog, ProcessingStep, ErrorLog } from '@/types';

const db = getFirestore(app);

/**
 * 投稿ログサービス
 * 投稿データの収集、保存、取得を行う
 */
export class PostLogService {
  private static instance: PostLogService;
  private queryBuilder = createQueryBuilder<PostLog>('postLogs', db);

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
      const firestoreData = convertPostLogToFirestore(logData);
      const docRef = await addDoc(postLogsRef, firestoreData);
      
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
      
      // Timestamp変換を共通化（部分更新の場合は個別に変換）
      const updateData: any = { ...updates };
      
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
      console.log('📝 PostLogService: 最近の投稿ログを取得開始', { count });
      
      const q = this.queryBuilder.recent(count);
      const querySnapshot = await getDocs(q);
      
      console.log('📝 PostLogService: 投稿ログ取得完了', { 
        totalCount: querySnapshot.size,
        empty: querySnapshot.empty 
      });
      
      return querySnapshot.docs.map(doc => convertFirestoreToPostLog(doc.id, doc.data()));
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
      const q = this.queryBuilder.byDateRange(startDate, endDate);
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => convertFirestoreToPostLog(doc.id, doc.data()));
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
      const q = this.queryBuilder.byUser(userId, count);
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => convertFirestoreToPostLog(doc.id, doc.data()));
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
        .map(doc => convertFirestoreToPostLog(doc.id, doc.data()))
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
