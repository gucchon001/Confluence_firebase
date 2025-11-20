/**
 * Google DriveファイルインポートAPI
 * POST /api/admin/google-drive/import
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin-init';
import admin from 'firebase-admin';
import { GoogleDriveService } from '@/lib/google-drive-service';
import type { GoogleDriveDocument } from '@/lib/google-drive-service';

export async function POST(req: NextRequest) {
  try {
    // Firebase Admin SDK初期化（関数内で実行）
    initializeFirebaseAdmin();
    
    // 認証チェック
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      // getAuth()を関数内でインポート（ビルド時のエラー回避）
      const { getAuth } = await import('firebase-admin/auth');
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (error) {
      return NextResponse.json(
        { error: '無効なトークンです' },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;

    // リクエストボディを取得
    const body = await req.json();
    const { fileIds, accessToken, folderId, useServiceAccount } = body;

    // Google Driveサービスを初期化
    const driveService = new GoogleDriveService();
    
    if (useServiceAccount) {
      // サービスアカウントを使用（共有ドライブ対応）
      const serviceAccountPath = body.serviceAccountPath || 'config/boxwood-dynamo-384411-6dec80faabfc.json';
      await driveService.initializeWithServiceAccount(serviceAccountPath);
    } else if (accessToken) {
      // OAuth2アクセストークンを使用
      await driveService.initialize(accessToken);
    } else {
      return NextResponse.json(
        { error: 'Google Driveアクセストークンまたはサービスアカウントが必要です' },
        { status: 400 }
      );
    }

    const results: Array<{ fileId: string; success: boolean; error?: string }> = [];
    let filesToProcess: string[] = [];

    // ファイルIDが指定されている場合
    if (fileIds && Array.isArray(fileIds) && fileIds.length > 0) {
      filesToProcess = fileIds;
    }
    // フォルダIDが指定されている場合
    else if (folderId) {
      const files = await driveService.listFiles(folderId);
      filesToProcess = files.map(f => f.id);
    } else {
      return NextResponse.json(
        { error: 'fileIdsまたはfolderIdが必要です' },
        { status: 400 }
      );
    }

    // 各ファイルを処理
    const db = admin.firestore();
    for (const fileId of filesToProcess) {
      try {
        // ファイル情報と内容を取得
        const document = await driveService.getDocument(fileId);
        
        // Firestoreに保存（サーバーサイド用）
        const docRef = db.collection('google_drive_documents').doc(document.fileId);
        const now = admin.firestore.Timestamp.now();
        
        // 既存のドキュメントを確認
        const existingDoc = await docRef.get();
        const existingData = existingDoc.data();
        
        const record = {
          fileId: document.fileId,
          fileName: document.fileName,
          mimeType: document.mimeType,
          content: document.content,
          url: document.url,
          lastModified: document.lastModified,
          size: document.size,
          importedAt: existingData?.importedAt || now,
          importedBy: existingData?.importedBy || userId,
          lastSyncedAt: now,
          version: (existingData?.version || 0) + 1,
        };
        
        await docRef.set(record);
        console.log(`✅ Google Driveドキュメントを保存しました: ${document.fileId}`);
        
        results.push({
          fileId,
          success: true,
        });
      } catch (error: any) {
        console.error(`❌ ファイル処理エラー (${fileId}):`, error);
        results.push({
          fileId,
          success: false,
          error: error.message || 'ファイルの処理に失敗しました',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    // 成功したファイルをLanceDBにインデックス化
    const successfulFileIds = results
      .filter(r => r.success)
      .map(r => r.fileId);

    let indexResult = { indexed: 0, errors: 0 };
    if (successfulFileIds.length > 0) {
      try {
        console.log(`📊 LanceDBへのインデックス化を開始... (${successfulFileIds.length}件)`);
        // 動的インポート（ビルド時のエラー回避）
        const { indexGoogleDriveDocumentsToLanceDB } = await import('@/lib/google-drive-lancedb-service');
        indexResult = await indexGoogleDriveDocumentsToLanceDB(successfulFileIds);
        console.log(`✅ LanceDBへのインデックス化が完了: ${indexResult.indexed}件成功, ${indexResult.errors}件失敗`);
      } catch (error: any) {
        console.error('❌ LanceDBインデックス化エラー:', error);
        // インデックス化の失敗はインポート自体の失敗とはしない
      }
    }

    return NextResponse.json({
      success: true,
      message: `${successCount}件のファイルをインポートしました${failureCount > 0 ? `（${failureCount}件失敗）` : ''}。LanceDBへのインデックス化: ${indexResult.indexed}件成功${indexResult.errors > 0 ? `（${indexResult.errors}件失敗）` : ''}`,
      results,
      summary: {
        total: results.length,
        success: successCount,
        failure: failureCount,
      },
      indexing: {
        indexed: indexResult.indexed,
        errors: indexResult.errors,
      },
    });
  } catch (error: any) {
    console.error('❌ Google DriveインポートAPIエラー:', error);
    return NextResponse.json(
      { error: error.message || 'インポート処理中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

