/**
 * 管理画面用評価フィードバック取得API
 */

import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { SatisfactionRating } from '@/types';

// Firebase Admin SDKを初期化する関数
function initializeFirebaseAdmin() {
  if (getApps().length === 0) {
    try {
      const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS || '{}');
      initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID
      });
    } catch (error) {
      console.error('Firebase Admin SDK初期化エラー:', error);
      throw error;
    }
  }
  return admin.app();
}

export const GET = async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const postLogId = searchParams.get('postLogId');
    
    // Firebase Admin SDKを使用
    const adminApp = initializeFirebaseAdmin();
    const db = getFirestore();
    
    let query = db.collection('feedbackRatings').orderBy('timestamp', 'desc');
    
    if (postLogId) {
      query = query.where('postLogId', '==', postLogId);
    }
    
    if (limitParam) {
      const limitNum = parseInt(limitParam, 10);
      if (limitNum > 0 && limitNum <= 1000) {
        query = query.limit(limitNum);
      }
    } else {
      query = query.limit(100); // デフォルト100件
    }
    
    const snapshot = await query.get();
    const feedbacks: SatisfactionRating[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      feedbacks.push({
        id: doc.id,
        userId: data.userId,
        postLogId: data.postLogId,
        rating: data.rating,
        comment: data.comment || '',
        timestamp: data.timestamp?.toDate() || new Date(),
        metadata: data.metadata || {
          userAgent: '',
          ipAddress: '',
          sessionId: '',
          userDisplayName: ''
        }
      });
    });
    
    console.log(`📊 評価フィードバックを取得しました: ${feedbacks.length}件`);
    
    return NextResponse.json({
      success: true,
      data: feedbacks,
      count: feedbacks.length
    });
    
  } catch (error) {
    console.error('❌ 評価フィードバック取得エラー:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch feedback',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
};
