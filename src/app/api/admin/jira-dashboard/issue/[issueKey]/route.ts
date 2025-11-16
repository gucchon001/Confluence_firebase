/**
 * Jira個別案件詳細取得API
 * GET /api/admin/jira-dashboard/issue/[issueKey]
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin-init';
import admin from 'firebase-admin';

initializeFirebaseAdmin();
const firestore = admin.firestore();

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ issueKey: string }> }
) {
  try {
    const { issueKey } = await params;

    if (!issueKey) {
      return NextResponse.json(
        { success: false, error: 'Issue Keyが必要です' },
        { status: 400 }
      );
    }

    // Firestoreから詳細情報を取得
    const docRef = firestore.collection('jiraIssues').doc(issueKey);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { success: false, error: '案件が見つかりませんでした' },
        { status: 404 }
      );
    }

    const data = docSnap.data();
    
    // コメント履歴を取得
    const comments = data?.comments || [];

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        comments
      }
    });
  } catch (error) {
    console.error('[API] Jira案件詳細取得エラー:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '案件詳細取得に失敗しました'
      },
      { status: 500 }
    );
  }
}

