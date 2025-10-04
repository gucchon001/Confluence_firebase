import { NextRequest, NextResponse } from 'next/server';
import { FirestoreBackupManager } from '@/scripts/backup-firestore-data';

export async function POST(request: NextRequest) {
  try {
    const { type = 'full' } = await request.json();
    
    console.log(`🔄 管理者バックアップAPI: ${type}バックアップを開始`);
    
    const backupManager = new FirestoreBackupManager();
    
    let backupPath: string;
    
    if (type === 'emergency') {
      backupPath = await backupManager.createEmergencyBackup();
    } else {
      backupPath = await backupManager.createFullBackup();
    }
    
    console.log(`✅ 管理者バックアップAPI: バックアップ完了 - ${backupPath}`);
    
    return NextResponse.json({
      success: true,
      message: `${type === 'emergency' ? '緊急' : 'フル'}バックアップが完了しました`,
      backupPath,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 管理者バックアップAPI: エラーが発生しました:', error);
    
    return NextResponse.json({
      success: false,
      message: 'バックアップ中にエラーが発生しました',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    return NextResponse.json({
      message: 'バックアップAPIエンドポイント',
      endpoints: {
        'POST /': 'バックアップを実行',
        'GET /': 'この情報を表示'
      },
      usage: {
        full: 'フルバックアップ（全データ）',
        emergency: '緊急バックアップ（管理者データのみ）'
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'API情報の取得中にエラーが発生しました',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
