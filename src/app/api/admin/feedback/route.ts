/**
 * 管理画面用評価フィードバック取得API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseFirestore } from '@/lib/firebase-unified';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import type { SatisfactionRating } from '@/types';

export const GET = async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const postLogId = searchParams.get('postLogId');
    
    const db = getFirebaseFirestore();
    let q = query(collection(db, 'feedbackRatings'), orderBy('timestamp', 'desc'));
    
    if (postLogId) {
      q = query(q, where('postLogId', '==', postLogId));
    }
    
    if (limitParam) {
      const limitNum = parseInt(limitParam, 10);
      if (limitNum > 0 && limitNum <= 1000) {
        q = query(q, limit(limitNum));
      }
    } else {
      q = query(q, limit(100)); // デフォルト100件
    }
    
    const snapshot = await getDocs(q);
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
