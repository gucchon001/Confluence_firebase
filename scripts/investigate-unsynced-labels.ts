/**
 * 未同期StructuredLabel調査スクリプト
 * Phase 0A-1: 未同期の167件を詳細に調査
 * 
 * 使い方:
 *   npx tsx scripts/investigate-unsynced-labels.ts
 * 
 * 調査項目:
 *   1. LanceDBに存在するがFirestoreにStructuredLabelがないページ
 *   2. FirestoreにStructuredLabelがあるがLanceDBに存在しないページ
 *   3. pageIdの不一致や変換エラー
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as admin from 'firebase-admin';
import { config } from 'dotenv';

// .envファイルをロード
config();

// Firebase Admin SDK初期化
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const firestoreDb = admin.firestore();
const STRUCTURED_LABELS_COLLECTION = 'structured_labels';

interface InvestigationResult {
  lancedbPageIds: Set<string>;
  firestorePageIds: Set<string>;
  unsyncedFromFirestore: string[]; // LanceDBにあるがFirestoreにない
  unsyncedFromLancedb: string[];    // FirestoreにあるがLanceDBにない
  conversionErrors: Array<{ pageId: string; error: string }>;
}

async function investigateUnsynced(): Promise<InvestigationResult> {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║   未同期StructuredLabel調査                                       ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Step 1: Firestoreから全StructuredLabelを取得
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  console.log('📥 Firestoreから全StructuredLabelを取得中...\n');
  
  const firestoreSnapshot = await firestoreDb.collection(STRUCTURED_LABELS_COLLECTION).get();
  const firestorePageIds = new Set<string>();
  
  firestoreSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.pageId) {
      firestorePageIds.add(String(data.pageId));
    }
  });
  
  console.log(`✅ Firestore: ${firestorePageIds.size}件のStructuredLabelを取得\n`);
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Step 2: LanceDBから全ページIDを取得（ユニーク化）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  console.log('📥 LanceDBから全ページIDを取得中...\n');
  
  const lanceDb = await lancedb.connect('.lancedb');
  const table = await lanceDb.openTable('confluence');
  const arrow = await table.query().toArrow();
  
  const lancedbPageIds = new Set<string>();
  const lancedbPageInfo = new Map<string, { title: string; hasLabel: boolean }>();
  const conversionErrors: Array<{ pageId: string; error: string }> = [];
  
  for (let i = 0; i < arrow.numRows; i++) {
    const row: any = {};
    for (let j = 0; j < arrow.schema.fields.length; j++) {
      const field = arrow.schema.fields[j];
      const column = arrow.getChildAt(j);
      row[field.name] = column?.get(i);
    }
    
    // チャンクは除外
    if (row.isChunked || (typeof row.page_id === 'string' && row.page_id.includes('-chunk-'))) {
      continue;
    }
    
    // page_idを抽出
    const rawPageId = row.page_id ?? row.pageId ?? row.id;
    let pageIdString: string;
    
    try {
      // 数値の場合は文字列に変換（bigint対応）
      if (typeof rawPageId === 'bigint') {
        pageIdString = String(rawPageId);
      } else if (typeof rawPageId === 'number') {
        pageIdString = String(rawPageId);
      } else if (typeof rawPageId === 'string') {
        pageIdString = rawPageId.replace(/-chunk-\d+$/, '');
      } else {
        // その他の型も文字列変換を試行
        pageIdString = String(rawPageId).replace(/-chunk-\d+$/, '');
      }
      
      lancedbPageIds.add(pageIdString);
      
      // ページ情報を保存
      const hasLabel = !!(row.structured_category || row.structured_domain || row.structured_feature || row.structured_status);
      lancedbPageInfo.set(pageIdString, {
        title: row.title || 'No Title',
        hasLabel,
      });
      
    } catch (error: any) {
      conversionErrors.push({
        pageId: String(rawPageId),
        error: error.message,
      });
    }
  }
  
  console.log(`✅ LanceDB: ${lancedbPageIds.size}件のユニークページを取得\n`);
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Step 3: 未同期を調査
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  console.log('🔍 未同期を調査中...\n');
  
  // LanceDBにあるがFirestoreにない
  const unsyncedFromFirestore: string[] = [];
  lancedbPageIds.forEach(pageId => {
    if (!firestorePageIds.has(pageId)) {
      unsyncedFromFirestore.push(pageId);
    }
  });
  
  // FirestoreにあるがLanceDBにない
  const unsyncedFromLancedb: string[] = [];
  firestorePageIds.forEach(pageId => {
    if (!lancedbPageIds.has(pageId)) {
      unsyncedFromLancedb.push(pageId);
    }
  });
  
  return {
    lancedbPageIds,
    firestorePageIds,
    unsyncedFromFirestore,
    unsyncedFromLancedb,
    conversionErrors,
  };
}

async function displayResults(result: InvestigationResult) {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║   調査結果                                                       ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 概要統計
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  console.log('📊 概要統計:');
  console.log('─'.repeat(60));
  console.log(`   Firestore StructuredLabel数: ${result.firestorePageIds.size}件`);
  console.log(`   LanceDB ユニークページ数: ${result.lancedbPageIds.size}件`);
  console.log(`   同期済み: ${result.lancedbPageIds.size - result.unsyncedFromFirestore.length}件`);
  console.log(`   未同期（LanceDBにあるがFirestoreにない）: ${result.unsyncedFromFirestore.length}件`);
  console.log(`   未同期（FirestoreにあるがLanceDBにない）: ${result.unsyncedFromLancedb.length}件`);
  console.log(`   変換エラー: ${result.conversionErrors.length}件\n`);
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. LanceDBにあるがFirestoreにない（未同期の167件の候補）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  if (result.unsyncedFromFirestore.length > 0) {
    console.log('📋 1. LanceDBにあるがFirestoreにStructuredLabelがないページ:');
    console.log('─'.repeat(60));
    console.log(`   件数: ${result.unsyncedFromFirestore.length}件\n`);
    
    // 最初の20件を表示
    const displayCount = Math.min(20, result.unsyncedFromFirestore.length);
    console.log(`   最初の${displayCount}件:\n`);
    
    const lanceDb = await lancedb.connect('.lancedb');
    const table = await lanceDb.openTable('confluence');
    
    for (let i = 0; i < displayCount; i++) {
      const pageId = result.unsyncedFromFirestore[i];
      try {
        // pageIdで検索（数値に変換を試行）
        const numericPageId = Number(pageId);
        if (!Number.isNaN(numericPageId)) {
          const records = await table
            .query()
            .where(`page_id = ${numericPageId}`)
            .limit(1)
            .toArray();
          
          if (records.length > 0) {
            const record = records[0];
            console.log(`   ${i + 1}. pageId: ${pageId}`);
            console.log(`      タイトル: ${record.title || 'No Title'}`);
            console.log(`      カテゴリ: ${record.structured_category || 'なし'}`);
            console.log(`      ドメイン: ${record.structured_domain || 'なし'}`);
            console.log(`      ラベルあり: ${!(record.structured_category || record.structured_domain || record.structured_feature || record.structured_status) ? '❌' : '✅'}\n`);
          } else {
            console.log(`   ${i + 1}. pageId: ${pageId} (レコードが見つかりません)\n`);
          }
        } else {
          console.log(`   ${i + 1}. pageId: ${pageId} (数値変換不可)\n`);
        }
      } catch (error: any) {
        console.log(`   ${i + 1}. pageId: ${pageId} (エラー: ${error.message})\n`);
      }
    }
    
    if (result.unsyncedFromFirestore.length > displayCount) {
      console.log(`   ... 残り${result.unsyncedFromFirestore.length - displayCount}件\n`);
    }
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. FirestoreにあるがLanceDBにない
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  if (result.unsyncedFromLancedb.length > 0) {
    console.log('📋 2. FirestoreにStructuredLabelがあるがLanceDBに存在しないページ:');
    console.log('─'.repeat(60));
    console.log(`   件数: ${result.unsyncedFromLancedb.length}件\n`);
    
    // 最初の20件を表示
    const displayCount = Math.min(20, result.unsyncedFromLancedb.length);
    console.log(`   最初の${displayCount}件:\n`);
    
    for (let i = 0; i < displayCount; i++) {
      const pageId = result.unsyncedFromLancedb[i];
      try {
        const doc = await firestoreDb.collection(STRUCTURED_LABELS_COLLECTION).doc(pageId).get();
        if (doc.exists) {
          const data = doc.data();
          const label = data?.structuredLabel || {};
          console.log(`   ${i + 1}. pageId: ${pageId}`);
          console.log(`      タイトル: ${label.feature || 'No Title'}`);
          console.log(`      カテゴリ: ${label.category || 'なし'}`);
          console.log(`      ドメイン: ${label.domain || 'なし'}`);
          console.log(`      生成方法: ${data?.generatedBy || 'unknown'}`);
          console.log(`      信頼度: ${label.confidence ? (label.confidence * 100).toFixed(1) + '%' : 'なし'}\n`);
        } else {
          console.log(`   ${i + 1}. pageId: ${pageId} (Firestoreに存在しません)\n`);
        }
      } catch (error: any) {
        console.log(`   ${i + 1}. pageId: ${pageId} (エラー: ${error.message})\n`);
      }
    }
    
    if (result.unsyncedFromLancedb.length > displayCount) {
      console.log(`   ... 残り${result.unsyncedFromLancedb.length - displayCount}件\n`);
    }
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. 変換エラー
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  if (result.conversionErrors.length > 0) {
    console.log('⚠️ 3. 変換エラー:');
    console.log('─'.repeat(60));
    console.log(`   件数: ${result.conversionErrors.length}件\n`);
    
    result.conversionErrors.slice(0, 10).forEach((error, i) => {
      console.log(`   ${i + 1}. pageId: ${error.pageId}`);
      console.log(`      エラー: ${error.error}\n`);
    });
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 推奨事項
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║   推奨事項                                                       ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  if (result.unsyncedFromFirestore.length > 0) {
    console.log(`📝 LanceDBにあるがFirestoreにStructuredLabelがない ${result.unsyncedFromFirestore.length}件:`);
    console.log(`   推奨: 以下のページIDに対してStructuredLabelを生成`);
    console.log(`   npm run label:generate ${result.unsyncedFromFirestore.length + 100}\n`);
    
    // pageIdリストを出力（スクリプトで使用できる形式）
    console.log(`   ページIDリスト（最初の50件）:`);
    result.unsyncedFromFirestore.slice(0, 50).forEach((pageId, i) => {
      if (i < 49) {
        process.stdout.write(`${pageId}, `);
      } else {
        console.log(pageId);
      }
    });
    if (result.unsyncedFromFirestore.length > 50) {
      console.log(`   ... 残り${result.unsyncedFromFirestore.length - 50}件\n`);
    } else {
      console.log('');
    }
  }
  
  if (result.unsyncedFromLancedb.length > 0) {
    console.log(`📝 FirestoreにStructuredLabelがあるがLanceDBに存在しない ${result.unsyncedFromLancedb.length}件:`);
    console.log(`   推奨: これらのページはLanceDBに存在しないため、同期する必要はありません`);
    console.log(`   （削除されたページや、まだ同期されていないページの可能性があります）\n`);
  }
  
  console.log('✅ 調査完了\n');
}

async function main() {
  try {
    const result = await investigateUnsynced();
    await displayResults(result);
  } catch (error: any) {
    console.error('\n❌ エラーが発生しました:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
