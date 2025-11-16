import 'dotenv/config';
import admin from 'firebase-admin';
import { initializeFirebaseAdmin } from '../lib/firebase-admin-init';
import { connect } from '@lancedb/lancedb';
import * as path from 'path';

initializeFirebaseAdmin();
const firestore = admin.firestore();

async function main() {
  console.log('📊 同期進捗を確認中...\n');
  
  // Firestoreの最新の同期ジョブを確認
  try {
    const syncJobsRef = firestore.collection('jiraSyncJobs');
    const snapshot = await syncJobsRef.orderBy('startedAt', 'desc').limit(1).get();
    
    if (snapshot.empty) {
      console.log('❌ 同期ジョブが見つかりませんでした');
    } else {
      const latestJob = snapshot.docs[0].data();
      const startedAt = latestJob.startedAt?.toDate();
      const finishedAt = latestJob.finishedAt?.toDate();
      const now = new Date();
      
      console.log('📋 最新の同期ジョブ:');
      console.log(`  開始時刻: ${startedAt?.toLocaleString('ja-JP')}`);
      if (finishedAt) {
        console.log(`  完了時刻: ${finishedAt.toLocaleString('ja-JP')}`);
        const duration = Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000);
        console.log(`  所要時間: ${duration}秒`);
      } else {
        const elapsed = Math.round((now.getTime() - startedAt.getTime()) / 1000);
        console.log(`  経過時間: ${elapsed}秒 (実行中)`);
      }
      console.log(`  ステータス: ${latestJob.status || 'unknown'}`);
      console.log(`  取得件数: ${latestJob.totalIssues || 0}件`);
      console.log(`  保存件数: ${latestJob.storedIssues || 0}件`);
      console.log(`  スキップ件数: ${latestJob.skippedIssues || 0}件`);
      console.log(`  LanceDBレコード: ${latestJob.lanceDbRecords || 0}件`);
    }
  } catch (error) {
    console.error('❌ Firestore確認エラー:', error);
  }
  
  // LanceDBテーブルの確認
  console.log('\n🗃️ LanceDBテーブル確認:');
  try {
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    const db = await connect(dbPath);
    const tableNames = await db.tableNames();
    
    if (tableNames.includes('jira_issues')) {
      console.log('✅ jira_issues テーブルが見つかりました');
      const table = await db.openTable('jira_issues');
      const count = await table.countRows();
      console.log(`   レコード数: ${count}件`);
    } else {
      console.log('❌ jira_issues テーブルが見つかりませんでした');
      console.log(`   存在するテーブル: ${tableNames.join(', ')}`);
    }
  } catch (error) {
    console.error('❌ LanceDB確認エラー:', error);
  }
  
  // Firestoreのissue件数も確認
  console.log('\n📦 Firestoreデータ確認:');
  try {
    const issuesRef = firestore.collection('jiraIssues');
    const countSnapshot = await issuesRef.count().get();
    const count = countSnapshot.data().count;
    console.log(`  保存されているissue数: ${count}件`);
  } catch (error) {
    console.error('❌ Firestore件数確認エラー:', error);
  }
}

main().catch((error) => {
  console.error('❌ 予期しないエラーが発生しました:', error);
  process.exit(1);
});

