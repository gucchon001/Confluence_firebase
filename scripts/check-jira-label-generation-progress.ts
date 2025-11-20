/**
 * Jira課題用StructuredLabel生成の進捗を確認するスクリプト
 */

import 'dotenv/config';
import * as admin from 'firebase-admin';
import { loadTestEnv } from '../src/tests/test-helpers/env-loader';

loadTestEnv();

// Firebase Admin SDK初期化
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();
const COLLECTION_NAME = 'structured_labels';

/**
 * Jira課題のissue_keyかどうかを判定
 */
function isJiraIssueKey(id: string): boolean {
  return /^[A-Z]+-\d+$/.test(id);
}

async function main() {
  console.log('\n📊 Jira課題用StructuredLabel生成の進捗確認\n');
  
  try {
    // Firestoreから全StructuredLabelを取得
    const snapshot = await db.collection(COLLECTION_NAME).get();
    
    let jiraLabelCount = 0;
    let confluenceLabelCount = 0;
    
    // 統計情報
    const byCategory: Record<string, number> = {};
    const byDomain: Record<string, number> = {};
    let totalConfidence = 0;
    let confidentCount = 0;
    
    for (const doc of snapshot.docs) {
      const docId = doc.id;
      const data = doc.data();
      
      if (isJiraIssueKey(docId)) {
        jiraLabelCount++;
        
        // 統計情報を収集
        const label = data.structuredLabel;
        if (label) {
          if (label.category) {
            byCategory[label.category] = (byCategory[label.category] || 0) + 1;
          }
          if (label.domain) {
            byDomain[label.domain] = (byDomain[label.domain] || 0) + 1;
          }
          if (typeof label.confidence === 'number') {
            totalConfidence += label.confidence;
            confidentCount++;
          }
        }
      } else {
        confluenceLabelCount++;
      }
    }
    
    const avgConfidence = confidentCount > 0 ? (totalConfidence / confidentCount) : 0;
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 進捗状況\n');
    console.log(`✅ Jira課題のStructuredLabel: ${jiraLabelCount}件`);
    console.log(`   ConfluenceのStructuredLabel: ${confluenceLabelCount}件`);
    console.log(`   合計: ${snapshot.size}件\n`);
    
    if (jiraLabelCount > 0) {
      console.log('📊 Jira課題のStructuredLabel統計:\n');
      console.log(`   平均信頼度: ${(avgConfidence * 100).toFixed(1)}%`);
      console.log(`\n   カテゴリ別:`);
      Object.entries(byCategory)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5)
        .forEach(([category, count]) => {
          console.log(`      - ${category}: ${count}件`);
        });
      
      console.log(`\n   ドメイン別（上位5件）:`);
      Object.entries(byDomain)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5)
        .forEach(([domain, count]) => {
          console.log(`      - ${domain}: ${count}件`);
        });
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 期待される件数との比較
    const expectedCount = 5430; // LanceDBのレコード数
    const progressPercent = expectedCount > 0 ? (jiraLabelCount / expectedCount * 100).toFixed(1) : '0.0';
    
    console.log(`📈 進捗率: ${progressPercent}% (${jiraLabelCount} / ${expectedCount}件)`);
    
    if (jiraLabelCount >= expectedCount) {
      console.log('✅ 全件の生成が完了しました！\n');
    } else {
      console.log(`⏳ 残り: ${expectedCount - jiraLabelCount}件\n`);
    }
    
  } catch (error: any) {
    console.error(`❌ エラー: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

