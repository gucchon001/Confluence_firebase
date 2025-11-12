import 'dotenv/config';

import admin from 'firebase-admin';
import { initializeFirebaseAdmin } from '../lib/firebase-admin-init';

initializeFirebaseAdmin();

const firestore = admin.firestore();

async function main() {
  console.log('🔍 FirestoreからJiraデータの全フィールドを確認します\n');

  try {
    // jiraIssuesコレクションから1件取得して全フィールドを表示
    const issuesSnapshot = await firestore
      .collection('jiraIssues')
      .limit(1)
      .get();

    if (issuesSnapshot.empty) {
      console.log('⚠️ jiraIssuesコレクションにデータがありません');
      return;
    }

    const doc = issuesSnapshot.docs[0];
    const data = doc.data();

    console.log(`📋 Issue Key: ${doc.id}\n`);
    console.log('=== 全フィールド一覧 ===\n');

    // 全てのフィールドをアルファベット順に表示
    const sortedFields = Object.keys(data).sort();
    
    for (const field of sortedFields) {
      const value = data[field];
      
      // 値の型と内容を表示
      if (value === null || value === undefined) {
        console.log(`${field}: null/undefined`);
      } else if (typeof value === 'object') {
        if (value instanceof admin.firestore.Timestamp) {
          console.log(`${field}: Timestamp(${value.toDate()})`);
        } else if (Array.isArray(value)) {
          console.log(`${field}: Array[${value.length}]`);
          if (value.length > 0) {
            console.log(`  ${JSON.stringify(value, null, 2).split('\n').slice(0, 5).join('\n  ')}${value.length > 5 ? '...' : ''}`);
          }
        } else {
          console.log(`${field}: Object`);
          console.log(`  ${JSON.stringify(value, null, 2).split('\n').slice(0, 10).join('\n  ')}${Object.keys(value).length > 10 ? '...' : ''}`);
        }
      } else if (typeof value === 'string' && value.length > 100) {
        console.log(`${field}: String(${value.length} chars)`);
        console.log(`  ${value.substring(0, 100)}...`);
      } else {
        console.log(`${field}: ${typeof value} = ${JSON.stringify(value)}`);
      }
      console.log('');
    }

    // カスタムフィールドの確認
    console.log('\n=== カスタムフィールド確認 ===\n');
    const customFields = [
      { key: 'month', label: '月 (customfield_10276)' },
      { key: 'customAssignee', label: '担当 (customfield_10277)' },
      { key: 'gigStatus', label: 'GIG状況 (customfield_10278)' },
      { key: 'devValidation', label: '開発検証 (customfield_10279)' },
      { key: 'prodValidation', label: '本番検証 (customfield_10280)' },
      { key: 'releaseDate', label: 'リリース予定日 (customfield_10281)' },
      { key: 'completedDate', label: '完了日 (customfield_10282)' },
      { key: 'desiredReleaseDate', label: '希望リリース日 (customfield_10283)' },
      { key: 'deadlineReleaseDate', label: '限界リリース日 (customfield_10284)' },
      { key: 'impactDomain', label: '影響業務 (customfield_10291)' },
      { key: 'impactLevel', label: '業務影響度 (customfield_10292)' }
    ];

    for (const field of customFields) {
      const value = data[field.key];
      if (value && value !== '') {
        console.log(`${field.label}: ${value}`);
      } else {
        console.log(`${field.label}: (not set)`);
      }
    }

    // 担当者・報告者情報の確認
    console.log('\n=== ユーザー情報確認 ===\n');
    console.log(`Assignee: ${data.assignee || '(unassigned)'}`);
    console.log(`Reporter: ${data.reporter || '(unknown)'}`);

    // 複数件でカスタムフィールドの分布を確認
    console.log('\n=== カスタムフィールド分布確認（10件サンプル） ===\n');
    const sampleSnapshot = await firestore
      .collection('jiraIssues')
      .limit(10)
      .get();

    const stats = {
      month: { set: 0, notSet: 0 },
      customAssignee: { set: 0, notSet: 0 },
      gigStatus: { set: 0, notSet: 0 },
      devValidation: { set: 0, notSet: 0 },
      prodValidation: { set: 0, notSet: 0 },
      releaseDate: { set: 0, notSet: 0 },
      completedDate: { set: 0, notSet: 0 },
      desiredReleaseDate: { set: 0, notSet: 0 },
      deadlineReleaseDate: { set: 0, notSet: 0 },
      impactDomain: { set: 0, notSet: 0 },
      impactLevel: { set: 0, notSet: 0 },
      assignee: { assigned: 0, unassigned: 0 }
    };

    sampleSnapshot.forEach((doc) => {
      const d = doc.data();
      
      // カスタムフィールドの統計
      if (d.month && d.month !== '') stats.month.set++; else stats.month.notSet++;
      if (d.customAssignee && d.customAssignee !== '') stats.customAssignee.set++; else stats.customAssignee.notSet++;
      if (d.gigStatus && d.gigStatus !== '') stats.gigStatus.set++; else stats.gigStatus.notSet++;
      if (d.devValidation && d.devValidation !== '') stats.devValidation.set++; else stats.devValidation.notSet++;
      if (d.prodValidation && d.prodValidation !== '') stats.prodValidation.set++; else stats.prodValidation.notSet++;
      if (d.releaseDate && d.releaseDate !== '') stats.releaseDate.set++; else stats.releaseDate.notSet++;
      if (d.completedDate && d.completedDate !== '') stats.completedDate.set++; else stats.completedDate.notSet++;
      if (d.desiredReleaseDate && d.desiredReleaseDate !== '') stats.desiredReleaseDate.set++; else stats.desiredReleaseDate.notSet++;
      if (d.deadlineReleaseDate && d.deadlineReleaseDate !== '') stats.deadlineReleaseDate.set++; else stats.deadlineReleaseDate.notSet++;
      if (d.impactDomain && d.impactDomain !== '') stats.impactDomain.set++; else stats.impactDomain.notSet++;
      if (d.impactLevel && d.impactLevel !== '') stats.impactLevel.set++; else stats.impactLevel.notSet++;
      
      // 担当者
      if (d.assignee && d.assignee !== '(unassigned)') stats.assignee.assigned++;
      else stats.assignee.unassigned++;
    });

    console.log(`月 (month): 設定=${stats.month.set}, 未設定=${stats.month.notSet}`);
    console.log(`担当 (customAssignee): 設定=${stats.customAssignee.set}, 未設定=${stats.customAssignee.notSet}`);
    console.log(`GIG状況 (gigStatus): 設定=${stats.gigStatus.set}, 未設定=${stats.gigStatus.notSet}`);
    console.log(`開発検証 (devValidation): 設定=${stats.devValidation.set}, 未設定=${stats.devValidation.notSet}`);
    console.log(`本番検証 (prodValidation): 設定=${stats.prodValidation.set}, 未設定=${stats.prodValidation.notSet}`);
    console.log(`リリース予定日 (releaseDate): 設定=${stats.releaseDate.set}, 未設定=${stats.releaseDate.notSet}`);
    console.log(`完了日 (completedDate): 設定=${stats.completedDate.set}, 未設定=${stats.completedDate.notSet}`);
    console.log(`希望リリース日 (desiredReleaseDate): 設定=${stats.desiredReleaseDate.set}, 未設定=${stats.desiredReleaseDate.notSet}`);
    console.log(`限界リリース日 (deadlineReleaseDate): 設定=${stats.deadlineReleaseDate.set}, 未設定=${stats.deadlineReleaseDate.notSet}`);
    console.log(`影響業務 (impactDomain): 設定=${stats.impactDomain.set}, 未設定=${stats.impactDomain.notSet}`);
    console.log(`業務影響度 (impactLevel): 設定=${stats.impactLevel.set}, 未設定=${stats.impactLevel.notSet}`);
    console.log(`担当者 (assignee): 割当済=${stats.assignee.assigned}, 未割当=${stats.assignee.unassigned}`);

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ 予期しないエラーが発生しました:', error);
  process.exit(1);
});

