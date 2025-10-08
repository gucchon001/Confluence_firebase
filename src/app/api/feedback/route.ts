/**
 * 評価フィードバックAPI
 * 5段階評価とコメントをFirestoreに保存
 */

import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin-init';
import type { SatisfactionRating } from '@/types';

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { postLogId, rating, comment } = body;

    // バリデーション
    if (!postLogId || !rating) {
      return NextResponse.json(
        { error: 'postLogId and rating are required' },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    // ユーザー情報の取得
    const userId = req.headers.get('x-user-id') || 'anonymous';
    const userAgent = req.headers.get('user-agent') || '';
    const ipAddress = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    const sessionId = req.headers.get('x-session-id') || 
                     `session_${Date.now()}`;

    // ユーザー表示名の取得（必要に応じて）
    let userDisplayName = 'anonymous';
    try {
      // ここでFirebase Authからユーザー情報を取得する処理を追加可能
      // 現在は匿名ユーザーとして処理
    } catch (error) {
      console.warn('ユーザー情報の取得に失敗:', error);
    }

    // Firebase Admin SDKを使用してFirestoreに保存
    const adminApp = initializeFirebaseAdmin();
    const db = getFirestore();
    
    const feedbackData: Omit<SatisfactionRating, 'id'> = {
      userId,
      postLogId,
      rating,
      comment: comment || '',
      timestamp: new Date(),
      metadata: {
        userAgent,
        ipAddress,
        sessionId,
        userDisplayName
      }
    };

    const docRef = await db.collection('feedbackRatings').add({
      ...feedbackData,
      timestamp: admin.firestore.Timestamp.fromDate(feedbackData.timestamp)
    });

    console.log('✅ 評価フィードバックを保存しました:', {
      id: docRef.id,
      postLogId,
      rating,
      commentLength: comment?.length || 0
    });

    return NextResponse.json({
      success: true,
      id: docRef.id,
      message: '評価を保存しました'
    });

  } catch (error) {
    console.error('❌ 評価フィードバック保存エラー:', error);
    return NextResponse.json(
      { 
        error: 'Failed to save feedback',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
};
