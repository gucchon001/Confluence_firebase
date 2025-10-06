/**
 * 定期バックアップスケジューラー
 * 毎日自動的にバックアップを実行
 */

import { FirestoreBackupManager } from './backup-firestore-data';

class BackupScheduler {
  private backupManager: FirestoreBackupManager;
  private isRunning = false;

  constructor() {
    this.backupManager = new FirestoreBackupManager();
  }

  /**
   * 毎日の自動バックアップを開始
   */
  startDailyBackup() {
    if (this.isRunning) {
      console.log('⚠️ バックアップスケジューラーは既に実行中です');
      return;
    }

    console.log('📅 毎日の自動バックアップスケジューラーを開始します');
    this.isRunning = true;

    // 毎日午前2時にバックアップを実行
    const scheduleBackup = () => {
      const now = new Date();
      const nextBackup = new Date();
      nextBackup.setHours(2, 0, 0, 0); // 午前2時
      
      // 今日の2時が過ぎている場合は明日の2時に設定
      if (now > nextBackup) {
        nextBackup.setDate(nextBackup.getDate() + 1);
      }

      const timeUntilBackup = nextBackup.getTime() - now.getTime();
      
      console.log(`⏰ 次のバックアップ予定: ${nextBackup.toLocaleString('ja-JP')}`);
      console.log(`⏱️ 残り時間: ${Math.round(timeUntilBackup / 1000 / 60)}分`);

      setTimeout(async () => {
        try {
          console.log('🔄 定期バックアップを開始します...');
          await this.backupManager.createFullBackup();
          console.log('✅ 定期バックアップが完了しました');
        } catch (error) {
          console.error('❌ 定期バックアップ中にエラーが発生しました:', error);
          
          // エラー時は緊急バックアップを試行
          try {
            console.log('🚨 緊急バックアップを実行します...');
            await this.backupManager.createEmergencyBackup();
            console.log('✅ 緊急バックアップが完了しました');
          } catch (emergencyError) {
            console.error('❌ 緊急バックアップも失敗しました:', emergencyError);
          }
        }
        
        // 次のバックアップをスケジュール
        scheduleBackup();
      }, timeUntilBackup);
    };

    // 初回実行
    scheduleBackup();
  }

  /**
   * 即座にバックアップを実行
   */
  async runImmediateBackup(type: 'full' | 'emergency' = 'full') {
    try {
      console.log(`🔄 即座の${type === 'full' ? 'フル' : '緊急'}バックアップを実行します...`);
      
      if (type === 'full') {
        await this.backupManager.createFullBackup();
      } else {
        await this.backupManager.createEmergencyBackup();
      }
      
      console.log('✅ 即座のバックアップが完了しました');
    } catch (error) {
      console.error('❌ 即座のバックアップ中にエラーが発生しました:', error);
      throw error;
    }
  }

  /**
   * スケジューラーを停止
   */
  stop() {
    this.isRunning = false;
    console.log('⏹️ バックアップスケジューラーを停止しました');
  }
}

// スクリプトとして直接実行された場合
if (require.main === module) {
  const scheduler = new BackupScheduler();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'start':
      scheduler.startDailyBackup();
      // プロセスを終了させない
      process.on('SIGINT', () => {
        scheduler.stop();
        process.exit(0);
      });
      break;
      
    case 'backup-now':
      scheduler.runImmediateBackup('full')
        .then(() => process.exit(0))
        .catch(error => {
          console.error('即座のバックアップ失敗:', error);
          process.exit(1);
        });
      break;
      
    case 'emergency':
      scheduler.runImmediateBackup('emergency')
        .then(() => process.exit(0))
        .catch(error => {
          console.error('緊急バックアップ失敗:', error);
          process.exit(1);
        });
      break;
      
    default:
      console.log('使用方法:');
      console.log('  npm run backup-schedule start     # 定期バックアップを開始');
      console.log('  npm run backup-schedule backup-now # 即座にバックアップ実行');
      console.log('  npm run backup-schedule emergency  # 緊急バックアップ実行');
      process.exit(0);
  }
}

export { BackupScheduler };
