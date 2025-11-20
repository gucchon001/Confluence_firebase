/**
 * Firestore Jira StructuredLabels → LanceDB 同期スクリプト
 * Phase 3: Jira課題のStructuredLabel統合
 * 
 * 機能:
 * 1. Firestoreから`structured_labels`コレクションを読み込み（Jira課題のみ）
 * 2. LanceDBの`jira_issues`テーブルの既存レコードに`StructuredLabel`を追加
 * 3. バッチ処理でパフォーマンス最適化
 */

import * as lancedb from '@lancedb/lancedb';
import * as arrow from 'apache-arrow';
import * as admin from 'firebase-admin';
import { config } from 'dotenv';
import { flattenStructuredLabel } from '../src/lib/lancedb-schema-extended';

config(); // .envファイルをロード

// Firebase Admin SDK初期化
if (!admin.apps.length) {
  try {
    // 本番環境では環境変数から認証情報を取得
    if (process.env.NODE_ENV === 'production') {
      // Cloud RunやApp Engineでは自動的に認証情報が提供される
      admin.initializeApp();
    } else {
      // 開発環境ではローカルキーファイルを使用
      admin.initializeApp({
        credential: admin.credential.cert(
          require('../keys/firebase-adminsdk-key.json')
        )
      });
    }
  } catch (error) {
    console.error('[SyncScript] Firebase Admin SDK初期化エラー:', error);
    // 本番環境での認証情報取得に失敗した場合は、デフォルト認証を試行
    admin.initializeApp();
  }
}

const db = admin.firestore();
const COLLECTION_NAME = 'structured_labels';

interface StructuredLabelDocument {
  pageId: string;
  structuredLabel: any;
  generatedAt: admin.firestore.Timestamp;
  generatedBy: 'rule-based' | 'llm-based';
}

/**
 * Jira課題のissue_keyかどうかを判定
 * Jira課題のIDは "CTJ-1234" のような形式
 */
function isJiraIssueKey(id: string): boolean {
  // Jira課題のキーは "PROJECT-123" の形式（英字-数字）
  return /^[A-Z]+-\d+$/.test(id);
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║   Firestore Jira StructuredLabels → LanceDB 同期                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  try {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Step 1: FirestoreからJira課題のStructuredLabelsを取得
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log('📥 Firestoreから Jira課題の StructuredLabels を取得中...\n');
    
    const snapshot = await db.collection(COLLECTION_NAME).get();
    
    console.log(`✅ 取得完了: ${snapshot.size}件（全体）\n`);
    
    // issue_key → StructuredLabel のマップを作成（Jira課題のみ）
    const labelMap = new Map<string, any>();
    let jiraLabelCount = 0;
    let confluenceLabelCount = 0;
    
    for (const doc of snapshot.docs) {
      const docId = doc.id;
      const data = doc.data() as StructuredLabelDocument;
      
      // Jira課題のissue_keyかどうかを判定
      if (isJiraIssueKey(docId)) {
        labelMap.set(docId, data.structuredLabel);
        jiraLabelCount++;
      } else {
        confluenceLabelCount++;
      }
    }
    
    console.log(`📊 ラベルマップ作成完了:`);
    console.log(`   - Jira課題: ${jiraLabelCount}件`);
    console.log(`   - Confluence: ${confluenceLabelCount}件`);
    console.log(`   - 合計: ${labelMap.size}件（Jira課題のみ）\n`);
    
    if (jiraLabelCount === 0) {
      console.log('⚠️ Jira課題のStructuredLabelが見つかりませんでした。');
      console.log('   先にStructuredLabelを生成してください:');
      console.log('   npx tsx scripts/generate-jira-structured-labels.ts\n');
      return;
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Step 2: LanceDBに接続（jira_issuesテーブル）
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log('🔌 LanceDBに接続中（jira_issuesテーブル）...\n');
    
    const lanceDb = await lancedb.connect('.lancedb');
    let table: any;
    
    try {
      table = await lanceDb.openTable('jira_issues');
    } catch (error: any) {
      console.error(`❌ jira_issuesテーブルが見つかりません: ${error.message}`);
      console.error('   先にJiraデータを同期してください: npm run sync:jira\n');
      return;
    }
    
    const totalRecords = await table.countRows();
    console.log(`✅ 接続完了: ${totalRecords}レコード\n`);
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Step 3: 既存レコードを読み込み、ラベルを統合
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log('🔄 既存レコードにラベルを統合中...\n');
    
    const allRecords = await table.query().limit(totalRecords).toArray();
    
    let withLabel = 0;
    let withoutLabel = 0;
    
    const updatedRecords = allRecords.map((record: any) => {
      // issue_keyを抽出（Jira課題のID）
      const issueKey = record.issue_key || record.id;
      if (!issueKey) {
        console.warn(`  ⚠️ issue_keyが見つかりません: ${JSON.stringify(record).substring(0, 100)}`);
        withoutLabel++;
        return null;
      }
      
      // Firestoreからラベルを取得
      const structuredLabel = labelMap.get(issueKey);
      
      if (structuredLabel) {
        // StructuredLabelをフラット化
        const structuredLabelFlat = flattenStructuredLabel(structuredLabel);
        
        // 既存レコードにStructuredLabelを統合
        const updatedRecord = {
          ...record,
          ...structuredLabelFlat
        };
        
        withLabel++;
        return updatedRecord;
      } else {
        withoutLabel++;
        // ラベルがない場合は既存レコードをそのまま返す（更新不要）
        return null;
      }
    }).filter((record: any) => record !== null);
    
    console.log(`📊 統合結果:`);
    console.log(`   - ラベルあり: ${withLabel}件`);
    console.log(`   - ラベルなし: ${withoutLabel}件`);
    console.log(`   - 更新対象: ${updatedRecords.length}件\n`);
    
    if (updatedRecords.length === 0) {
      console.log('⚠️ 更新対象のレコードがありません。\n');
      return;
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Step 4: LanceDBテーブルを再作成（統合データで）
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log('🔄 LanceDBテーブルを再作成中...\n');
    
    // 既存テーブルを削除
    try {
      await lanceDb.dropTable('jira_issues');
      console.log('   ✅ 既存テーブルを削除\n');
    } catch (error: any) {
      console.warn(`   ⚠️ テーブル削除エラー（既に存在しない可能性）: ${error.message}\n`);
    }
    
    // 新しいテーブルを作成
    // 注意: Jira課題のレコードには`structured_*`フィールドが含まれるため、
    // 既存のレコードと新しいレコードをマージする必要がある
    const recordsToCreate = allRecords.map((record: any) => {
      const issueKey = record.issue_key || record.id;
      const structuredLabel = labelMap.get(issueKey);
      
      // 一時的なフィールドを削除（LanceDBスキーマ推論エラーを防ぐ）
      const cleanedRecord: any = { ...record };
      delete cleanedRecord._vectorText;
      delete cleanedRecord.isValid;
      
      if (structuredLabel) {
        const structuredLabelFlat = flattenStructuredLabel(structuredLabel);
        return {
          ...cleanedRecord,
          ...structuredLabelFlat
        };
      } else {
        return cleanedRecord;
      }
    });
    
    // 空のレコードを除外（安全のため）
    const validRecords = recordsToCreate.filter((record: any) => 
      record && record.id && record.issue_key
    );
    
    if (validRecords.length === 0) {
      console.error('❌ 有効なレコードがありません。\n');
      return;
    }
    
    await lanceDb.createTable('jira_issues', validRecords);
    
    console.log(`✅ テーブル再作成完了: ${recordsToCreate.length}レコード\n`);
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Step 5: 統計情報を表示
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 同期完了\n');
    console.log('📊 統計情報:');
    console.log(`   - 総レコード数: ${totalRecords}件`);
    console.log(`   - ラベル統合済み: ${withLabel}件 (${(withLabel / totalRecords * 100).toFixed(1)}%)`);
    console.log(`   - ラベル未統合: ${withoutLabel}件 (${(withoutLabel / totalRecords * 100).toFixed(1)}%)\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('📊 次のステップ:');
    console.log('   1. インデックス作成: npm run lancedb:create-indexes');
    console.log('   2. GCSアップロード: npm run upload:production-data\n');
    
  } catch (error: any) {
    console.error(`❌ エラー: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

