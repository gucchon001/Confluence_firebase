import 'dotenv/config';

import admin from 'firebase-admin';
import { initializeFirebaseAdmin } from '../lib/firebase-admin-init';

initializeFirebaseAdmin();

const firestore = admin.firestore();

async function main() {
  console.log('🔍 FirestoreからJiraデータを取得します\n');

  try {
    // jiraIssuesコレクションからサンプルを取得
    const issuesSnapshot = await firestore
      .collection('jiraIssues')
      .limit(5)
      .get();

    console.log(`📊 取得件数: ${issuesSnapshot.size}件\n`);

    if (issuesSnapshot.empty) {
      console.log('⚠️ jiraIssuesコレクションにデータがありません');
      return;
    }

    let index = 0;
    issuesSnapshot.forEach((doc) => {
      const data = doc.data();
      index++;
      console.log(`--- Issue ${index} ---`);
      console.log(`Key: ${doc.id}`);
      console.log(`Summary: ${data.summary || '(no summary)'}`);
      console.log(`Status: ${data.status || '(no status)'}`);
      console.log(`Status Category: ${data.statusCategory || '(no category)'}`);
      console.log(`Priority: ${data.priority || '(no priority)'}`);
      console.log(`Assignee: ${data.assignee || '(unassigned)'}`);
      console.log(`Issue Type: ${data.issueType || '(no type)'}`);
      console.log(`Project: ${data.projectKey || '(no project)'}`);
      console.log(`Impact Domain: ${data.impactDomain || '(not set)'}`);
      console.log(`Impact Level: ${data.impactLevel || '(not set)'}`);
      console.log(`Created: ${data.created || '(unknown)'}`);
      console.log(`Updated: ${data.updated || '(unknown)'}`);
      console.log(`Synced At: ${data.syncedAt?.toDate?.() || data.syncedAt || '(unknown)'}`);
      console.log(`URL: ${data.url || '(no url)'}`);
      console.log(`Description length: ${data.description?.length || 0} chars`);
      console.log(`Latest Comment: ${data.latestComment ? 'Yes' : 'No'}`);
      console.log(`Labels: ${data.labels?.join(', ') || '(no labels)'}`);
      console.log('');
    });

    // 統計情報を取得
    const totalSnapshot = await firestore.collection('jiraIssues').count().get();
    console.log(`📈 総件数: ${totalSnapshot.data().count}件`);

    // jiraSyncJobsから最新の同期ジョブを取得
    const syncJobsSnapshot = await firestore
      .collection('jiraSyncJobs')
      .orderBy('startedAt', 'desc')
      .limit(1)
      .get();

    if (!syncJobsSnapshot.empty) {
      const latestJob = syncJobsSnapshot.docs[0].data();
      console.log('\n📋 最新の同期ジョブ:');
      console.log(`  Started: ${latestJob.startedAt?.toDate?.() || latestJob.startedAt}`);
      console.log(`  Finished: ${latestJob.finishedAt?.toDate?.() || latestJob.finishedAt}`);
      console.log(`  Total Issues: ${latestJob.totalIssues || 0}`);
      console.log(`  Stored Issues: ${latestJob.storedIssues || 0}`);
      console.log(`  Skipped Issues: ${latestJob.skippedIssues || 0}`);
      console.log(`  LanceDB Records: ${latestJob.lanceDbRecords || 0}`);
      console.log(`  Status: ${latestJob.status || 'unknown'}`);
    }

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ 予期しないエラーが発生しました:', error);
  process.exit(1);
});

