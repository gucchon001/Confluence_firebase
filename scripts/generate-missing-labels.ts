/**
 * 未同期ページのStructuredLabel生成スクリプト
 * Phase 1: 未同期の167件に対してStructuredLabelを生成
 * 
 * 使い方:
 *   npx tsx scripts/generate-missing-labels.ts
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as admin from 'firebase-admin';
import { config } from 'dotenv';
import { autoLabelFlow } from '../src/ai/flows/auto-label-flow';
import { saveStructuredLabel, getStructuredLabel } from '../src/lib/structured-label-service-admin';
import { loadDomainKnowledge } from '../src/lib/domain-knowledge-loader';

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

interface ConfluencePage {
  id: string;
  pageId: string;
  title: string;
  content: string;
  labels?: string[];
}

async function findPagesWithoutLabels(): Promise<string[]> {
  console.log('🔍 未同期ページを調査中...\n');
  
  // Firestoreから全StructuredLabelを取得
  const firestoreSnapshot = await firestoreDb.collection(STRUCTURED_LABELS_COLLECTION).get();
  const firestorePageIds = new Set<string>();
  
  firestoreSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.pageId) {
      firestorePageIds.add(String(data.pageId));
    }
  });
  
  console.log(`✅ Firestore: ${firestorePageIds.size}件のStructuredLabelを取得\n`);
  
  // LanceDBから全ページIDを取得（ユニーク化）
  const lanceDb = await lancedb.connect('.lancedb');
  const table = await lanceDb.openTable('confluence');
  const arrow = await table.query().toArrow();
  
  const lancedbPageIds = new Set<string>();
  const lancedbPageInfo = new Map<string, { title: string; row: any }>();
  
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
    
    // page_idを抽出（bigint対応）
    const rawPageId = row.page_id ?? row.pageId ?? row.id;
    let pageIdString: string;
    
    try {
      if (typeof rawPageId === 'bigint') {
        pageIdString = String(rawPageId);
      } else if (typeof rawPageId === 'number') {
        pageIdString = String(rawPageId);
      } else if (typeof rawPageId === 'string') {
        pageIdString = rawPageId.replace(/-chunk-\d+$/, '');
      } else {
        pageIdString = String(rawPageId).replace(/-chunk-\d+$/, '');
      }
      
      lancedbPageIds.add(pageIdString);
      lancedbPageInfo.set(pageIdString, {
        title: row.title || 'No Title',
        row,
      });
    } catch (error: any) {
      console.warn(`⚠️ ページID変換エラー: ${rawPageId} - ${error.message}`);
    }
  }
  
  console.log(`✅ LanceDB: ${lancedbPageIds.size}件のユニークページを取得\n`);
  
  // LanceDBにあるがFirestoreにStructuredLabelがないページを特定
  const missingPageIds: string[] = [];
  lancedbPageIds.forEach(pageId => {
    if (!firestorePageIds.has(pageId)) {
      missingPageIds.push(pageId);
    }
  });
  
  console.log(`📊 未同期ページ数: ${missingPageIds.length}件\n`);
  
  return missingPageIds.map(pageId => {
    const info = lancedbPageInfo.get(pageId);
    return info ? pageId : null;
  }).filter((id): id is string => id !== null);
}

async function generateLabelsForPages(pageIds: string[]): Promise<void> {
  console.log(`🏷️ ${pageIds.length}件のページに対してStructuredLabelを生成します...\n`);
  
  // Domain Knowledgeを読み込み
  console.log('📚 Domain Knowledgeを読み込み中...');
  await loadDomainKnowledge();
  console.log(`✅ Domain Knowledge読み込み完了\n`);
  
  // LanceDBに接続
  const lanceDb = await lancedb.connect('.lancedb');
  const table = await lanceDb.openTable('confluence');
  
  let successCount = 0;
  let errorCount = 0;
  let ruleBasedCount = 0;
  let llmBasedCount = 0;
  const startTime = Date.now();
  
  for (let i = 0; i < pageIds.length; i++) {
    const pageId = pageIds[i];
    const progress = `[${i + 1}/${pageIds.length}]`;
    
    try {
      // LanceDBからページ情報を取得
      const numericPageId = Number(pageId);
      if (Number.isNaN(numericPageId)) {
        console.warn(`${progress} ⚠️ 数値変換不可: ${pageId}`);
        errorCount++;
        continue;
      }
      
      const records = await table
        .query()
        .where(`page_id = ${numericPageId}`)
        .limit(1)
        .toArray();
      
      if (records.length === 0) {
        console.warn(`${progress} ⚠️ ページが見つかりません: ${pageId}`);
        errorCount++;
        continue;
      }
      
      const record = records[0];
      
      // labelsを配列に正規化
      let labels: string[] = [];
      if (record.labels) {
        if (Array.isArray(record.labels)) {
          labels = record.labels;
        } else if (typeof record.labels === 'object' && 'length' in record.labels) {
          const jsonLabels = JSON.parse(JSON.stringify(record.labels));
          if (Array.isArray(jsonLabels)) {
            labels = jsonLabels;
          }
        } else if (typeof record.labels === 'string') {
          labels = record.labels.split(',').map((l: string) => l.trim()).filter(Boolean);
        }
      }
      
      // autoLabelFlow実行
      const structuredLabel = await autoLabelFlow({
        title: record.title || 'Untitled',
        content: record.content || '',
        labels: labels || []
      });
      
      // Firestore保存
      await saveStructuredLabel(pageId, structuredLabel);
      
      successCount++;
      
      // 生成方法をカウント
      if (structuredLabel.confidence && structuredLabel.confidence >= 0.8) {
        ruleBasedCount++;
      } else {
        llmBasedCount++;
      }
      
      // 進捗表示（10件ごと）
      if ((i + 1) % 10 === 0 || i === pageIds.length - 1) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const avgTime = (parseFloat(elapsed) / (i + 1)).toFixed(2);
        console.log(`${progress} ${successCount}件完了 (${elapsed}秒経過, 平均${avgTime}秒/件)`);
      }
      
    } catch (error: any) {
      errorCount++;
      console.error(`${progress} ❌ エラー: ${pageId} - ${error.message}`);
    }
  }
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ StructuredLabel生成完了\n');
  console.log(`📊 処理結果:`);
  console.log(`   - 成功: ${successCount}件`);
  console.log(`   - エラー: ${errorCount}件`);
  if (successCount > 0) {
    console.log(`   - ルールベース: ${ruleBasedCount}件 (${((ruleBasedCount / successCount) * 100).toFixed(1)}%)`);
    console.log(`   - LLMベース: ${llmBasedCount}件 (${((llmBasedCount / successCount) * 100).toFixed(1)}%)`);
  }
  console.log(`   - 処理時間: ${totalTime}秒`);
  if (successCount > 0) {
    console.log(`   - 平均処理時間: ${(parseFloat(totalTime) / successCount).toFixed(2)}秒/件`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║   未同期ページのStructuredLabel生成                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  try {
    // Step 1: 未同期ページを特定
    const missingPageIds = await findPagesWithoutLabels();
    
    if (missingPageIds.length === 0) {
      console.log('✅ 未同期ページはありません。すべて同期済みです。\n');
      return;
    }
    
    // Step 2: StructuredLabelを生成
    await generateLabelsForPages(missingPageIds);
    
    console.log('✅ 処理が正常に完了しました！\n');
    
  } catch (error: any) {
    console.error('\n❌ エラーが発生しました:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

