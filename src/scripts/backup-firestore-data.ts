/**
 * Firestoreデータの自動バックアップスクリプト
 * 定期的に重要なデータをローカルにバックアップ
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Firebase Admin SDKの初期化
if (!getApps().length) {
  initializeApp({
    credential: undefined, // 環境変数から自動取得
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  });
}

const db = getFirestore();

interface BackupData {
  users: any[];
  conversations: any[];
  messages: any[];
  postLogs: any[];
  adminLogs: any[];
  backupDate: string;
  backupVersion: string;
}

class FirestoreBackupManager {
  private backupDir = 'backups';
  private maxBackups = 30; // 30日分のバックアップを保持

  constructor() {
    this.ensureBackupDirectory();
  }

  private ensureBackupDirectory() {
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * 全コレクションのバックアップを実行
   */
  async createFullBackup(): Promise<string> {
    console.log('🔄 フルバックアップを開始...');
    
    try {
      const backupData: BackupData = {
        users: [],
        conversations: [],
        messages: [],
        postLogs: [],
        adminLogs: [],
        backupDate: new Date().toISOString(),
        backupVersion: '1.0.0'
      };

      // 各コレクションのデータを取得
      console.log('📊 ユーザーデータをバックアップ中...');
      const usersSnapshot = await db.collection('users').get();
      backupData.users = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log('💬 会話データをバックアップ中...');
      const conversationsSnapshot = await db.collection('conversations').limit(1000).get();
      backupData.conversations = conversationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log('📝 メッセージデータをバックアップ中...');
      const messagesSnapshot = await db.collection('messages').limit(5000).get();
      backupData.messages = messagesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log('📊 投稿ログをバックアップ中...');
      const postLogsSnapshot = await db.collection('postLogs').limit(1000).get();
      backupData.postLogs = postLogsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log('🔐 管理者ログをバックアップ中...');
      const adminLogsSnapshot = await db.collection('adminLogs').limit(1000).get();
      backupData.adminLogs = adminLogsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // バックアップファイルを保存
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `firestore-backup-${timestamp}.json`;
      const backupFilePath = join(this.backupDir, backupFileName);
      
      writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2));
      
      console.log(`✅ バックアップが完了しました: ${backupFilePath}`);
      
      // 古いバックアップを削除
      await this.cleanupOldBackups();
      
      return backupFilePath;
      
    } catch (error) {
      console.error('❌ バックアップ中にエラーが発生しました:', error);
      throw error;
    }
  }

  /**
   * 管理者データのみの緊急バックアップ
   */
  async createEmergencyBackup(): Promise<string> {
    console.log('🚨 緊急バックアップを開始...');
    
    try {
      const emergencyData = {
        users: [],
        adminLogs: [],
        backupDate: new Date().toISOString(),
        backupType: 'emergency'
      };

      // 管理者関連データのみバックアップ
      const usersSnapshot = await db.collection('users').get();
      emergencyData.users = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const adminLogsSnapshot = await db.collection('adminLogs').get();
      emergencyData.adminLogs = adminLogsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `emergency-backup-${timestamp}.json`;
      const backupFilePath = join(this.backupDir, backupFileName);
      
      writeFileSync(backupFilePath, JSON.stringify(emergencyData, null, 2));
      
      console.log(`✅ 緊急バックアップが完了しました: ${backupFilePath}`);
      
      return backupFilePath;
      
    } catch (error) {
      console.error('❌ 緊急バックアップ中にエラーが発生しました:', error);
      throw error;
    }
  }

  /**
   * 古いバックアップファイルを削除
   */
  private async cleanupOldBackups() {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const files = fs.readdirSync(this.backupDir);
      const backupFiles = files
        .filter(file => file.startsWith('firestore-backup-') && file.endsWith('.json'))
        .map(file => ({
          name: file,
          path: join(this.backupDir, file),
          stats: fs.statSync(join(this.backupDir, file))
        }))
        .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());

      // 古いバックアップを削除
      if (backupFiles.length > this.maxBackups) {
        const filesToDelete = backupFiles.slice(this.maxBackups);
        for (const file of filesToDelete) {
          fs.unlinkSync(file.path);
          console.log(`🗑️ 古いバックアップを削除: ${file.name}`);
        }
      }
      
    } catch (error) {
      console.error('❌ バックアップクリーンアップ中にエラーが発生しました:', error);
    }
  }

  /**
   * バックアップから復元
   */
  async restoreFromBackup(backupFilePath: string): Promise<void> {
    console.log(`🔄 バックアップから復元中: ${backupFilePath}`);
    
    try {
      const fs = await import('fs');
      const backupData: BackupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
      
      // ユーザーデータの復元
      if (backupData.users.length > 0) {
        console.log('👥 ユーザーデータを復元中...');
        const batch = db.batch();
        
        for (const userData of backupData.users) {
          const { id, ...data } = userData;
          const userRef = db.collection('users').doc(id);
          batch.set(userRef, data);
        }
        
        await batch.commit();
        console.log(`✅ ${backupData.users.length}件のユーザーデータを復元しました`);
      }

      // 管理者ログの復元
      if (backupData.adminLogs.length > 0) {
        console.log('🔐 管理者ログを復元中...');
        const batch = db.batch();
        
        for (const logData of backupData.adminLogs) {
          const { id, ...data } = logData;
          const logRef = db.collection('adminLogs').doc(id);
          batch.set(logRef, data);
        }
        
        await batch.commit();
        console.log(`✅ ${backupData.adminLogs.length}件の管理者ログを復元しました`);
      }
      
      console.log('✅ バックアップからの復元が完了しました');
      
    } catch (error) {
      console.error('❌ 復元中にエラーが発生しました:', error);
      throw error;
    }
  }
}

// スクリプトとして直接実行された場合
if (require.main === module) {
  const backupManager = new FirestoreBackupManager();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'full':
      backupManager.createFullBackup()
        .then(() => process.exit(0))
        .catch(error => {
          console.error('バックアップ失敗:', error);
          process.exit(1);
        });
      break;
      
    case 'emergency':
      backupManager.createEmergencyBackup()
        .then(() => process.exit(0))
        .catch(error => {
          console.error('緊急バックアップ失敗:', error);
          process.exit(1);
        });
      break;
      
    case 'restore':
      const backupFile = process.argv[3];
      if (!backupFile) {
        console.error('復元するバックアップファイルを指定してください');
        process.exit(1);
      }
      backupManager.restoreFromBackup(backupFile)
        .then(() => process.exit(0))
        .catch(error => {
          console.error('復元失敗:', error);
          process.exit(1);
        });
      break;
      
    default:
      console.log('使用方法:');
      console.log('  npm run backup full          # フルバックアップ');
      console.log('  npm run backup emergency     # 緊急バックアップ');
      console.log('  npm run backup restore <file> # バックアップから復元');
      process.exit(0);
  }
}

export { FirestoreBackupManager };
