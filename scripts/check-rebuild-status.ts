/**
 * 完全再構築スクリプトの実行ステータスを確認するスクリプト
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { initializeFirebaseAdmin } from '../src/lib/firebase-admin-init';
import admin from 'firebase-admin';

// Firebase Admin SDKを初期化
initializeFirebaseAdmin();
const firestore = admin.firestore();

async function checkConfluenceSyncStatus() {
  console.log('='.repeat(80));
  console.log('Confluence同期ステータス確認');
  console.log('='.repeat(80));
  console.log('');

  try {
    // 最新の同期ジョブを取得
    const syncJobsRef = firestore.collection('confluenceSyncJobs');
    const snapshot = await syncJobsRef.orderBy('startedAt', 'desc').limit(1).get();
    
    if (snapshot.empty) {
      console.log('⚠️ 同期ジョブの記録が見つかりません');
      return;
    }

    const latestJob = snapshot.docs[0].data();
    const startedAt = latestJob.startedAt?.toDate();
    const finishedAt = latestJob.finishedAt?.toDate();
    
    console.log('📊 最新の同期ジョブ:');
    console.log(`  開始時刻: ${startedAt?.toLocaleString() || 'N/A'}`);
    console.log(`  終了時刻: ${finishedAt?.toLocaleString() || 'N/A'}`);
    console.log(`  ステータス: ${latestJob.status || 'N/A'}`);
    console.log(`  取得ページ数: ${latestJob.fetchedPages || 0}`);
    console.log(`  追加: ${latestJob.added || 0}ページ`);
    console.log(`  更新: ${latestJob.updated || 0}ページ`);
    console.log(`  変更なし: ${latestJob.unchanged || 0}ページ`);
    console.log(`  除外: ${latestJob.excluded || 0}ページ`);
    console.log(`  エラー: ${latestJob.errors || 0}件`);
    console.log('');
  } catch (error) {
    console.error('❌ 同期ステータスの取得に失敗しました:', error);
  }
}

async function checkLanceDBStatus() {
  console.log('='.repeat(80));
  console.log('LanceDBテーブルステータス確認');
  console.log('='.repeat(80));
  console.log('');

  try {
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tableNames = await db.tableNames();
    
    console.log('📊 テーブル一覧:', tableNames);
    console.log('');

    if (tableNames.includes('confluence')) {
      const table = await db.openTable('confluence');
      const rowCount = await table.countRows();
      
      console.log('=== confluence テーブル ===');
      console.log(`  総レコード数: ${rowCount}`);
      
      // サンプルレコードでスキーマを確認
      const sample = await table.query().limit(1).toArray();
      if (sample.length > 0) {
        const fields = Object.keys(sample[0]);
        console.log(`  フィールド数: ${fields.length}`);
        console.log(`  space_key存在: ${'space_key' in sample[0] ? '✅' : '❌'}`);
        console.log(`  spaceKey存在: ${'spaceKey' in sample[0] ? '✅' : '❌'}`);
        console.log(`  url存在: ${'url' in sample[0] ? '✅' : '❌'}`);
        console.log(`  isChunked存在: ${'isChunked' in sample[0] ? '✅' : '❌'}`);
        console.log(`  totalChunks存在: ${'totalChunks' in sample[0] ? '✅' : '❌'}`);
      }
      console.log('');
    }
  } catch (error) {
    console.error('❌ LanceDBステータスの取得に失敗しました:', error);
  }
}

async function main() {
  console.log('');
  console.log('🚀 完全再構築スクリプトの実行ステータス確認');
  console.log('');

  await checkConfluenceSyncStatus();
  await checkLanceDBStatus();

  console.log('='.repeat(80));
  console.log('✅ ステータス確認完了');
  console.log('='.repeat(80));
}

main().catch((error) => {
  console.error('❌ 予期しないエラーが発生しました:', error);
  process.exit(1);
});

