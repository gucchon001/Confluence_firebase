/**
 * Google Driveファイル一覧取得API
 * GET /api/admin/google-drive/list
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { GoogleDriveService } from '@/lib/google-drive-service';

// Firebase Admin SDK初期化
if (!getApps().length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccount) {
    try {
      const key = JSON.parse(serviceAccount);
      initializeApp({
        credential: cert(key),
      });
    } catch (error) {
      console.error('❌ Firebase Admin SDK初期化エラー:', error);
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    // 認証チェック
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
    try {
      await getAuth().verifyIdToken(idToken);
    } catch (error) {
      return NextResponse.json(
        { error: '無効なトークンです' },
        { status: 401 }
      );
    }

    // クエリパラメータを取得
    const searchParams = req.nextUrl.searchParams;
    const accessToken = searchParams.get('accessToken');
    const useServiceAccount = searchParams.get('useServiceAccount') === 'true';
    const serviceAccountPath = searchParams.get('serviceAccountPath') || undefined;
    const folderId = searchParams.get('folderId') || undefined;
    const mimeTypes = searchParams.get('mimeTypes')?.split(',').filter(Boolean) || undefined;

    // Google Driveサービスを初期化
    const driveService = new GoogleDriveService();
    
    if (useServiceAccount) {
      // サービスアカウントを使用（共有ドライブ対応）
      const defaultPath = serviceAccountPath || 'config/boxwood-dynamo-384411-6dec80faabfc.json';
      await driveService.initializeWithServiceAccount(defaultPath);
    } else if (accessToken) {
      // OAuth2アクセストークンを使用
      await driveService.initialize(accessToken);
    } else {
      return NextResponse.json(
        { error: 'Google Driveアクセストークンまたはサービスアカウントが必要です' },
        { status: 400 }
      );
    }

    // ファイル一覧を取得
    const files = await driveService.listFiles(folderId, mimeTypes);

    return NextResponse.json({
      success: true,
      files,
      count: files.length,
    });
  } catch (error: any) {
    console.error('❌ Google Driveファイル一覧取得APIエラー:', error);
    return NextResponse.json(
      { error: error.message || 'ファイル一覧の取得に失敗しました' },
      { status: 500 }
    );
  }
}

