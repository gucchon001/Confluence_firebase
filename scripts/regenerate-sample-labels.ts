/**
 * サンプルページのStructuredLabel再生成スクリプト
 * Phase 1改善効果の測定用
 * 
 * 使い方:
 *   npx tsx scripts/regenerate-sample-labels.ts [count]
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

interface RegenerationResult {
  pageId: string;
  title: string;
  oldConfidence: number | undefined;
  newConfidence: number | undefined;
  oldGenerationMethod: 'rule-based' | 'llm-based' | 'unknown';
  newGenerationMethod: 'rule-based' | 'llm-based' | 'unknown';
  improved: boolean;
}

async function regenerateSampleLabels(count: number = 50): Promise<RegenerationResult[]> {
  console.log(`🏷️ ${count}件のサンプルページのStructuredLabelを再生成します...\n`);
  
  // Domain Knowledgeを読み込み
  console.log('📚 Domain Knowledgeを読み込み中...');
  await loadDomainKnowledge();
  console.log(`✅ Domain Knowledge読み込み完了\n`);
  
  // LanceDBに接続
  const lanceDb = await lancedb.connect('.lancedb');
  const table = await lanceDb.openTable('confluence');
  
  // ランダムにサンプルページを選択
  const arrow = await table.query().limit(1000).toArrow();
  const allPages: Array<{ pageId: string; title: string; row: any }> = [];
  
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
      if (typeof rawPageId === 'bigint') {
        pageIdString = String(rawPageId);
      } else if (typeof rawPageId === 'number') {
        pageIdString = String(rawPageId);
      } else if (typeof rawPageId === 'string') {
        pageIdString = rawPageId.replace(/-chunk-\d+$/, '');
      } else {
        pageIdString = String(rawPageId).replace(/-chunk-\d+$/, '');
      }
      
      allPages.push({
        pageId: pageIdString,
        title: row.title || 'No Title',
        row,
      });
    } catch (error) {
      // スキップ
    }
  }
  
  // ランダムにサンプルを選択
  const shuffled = allPages.sort(() => Math.random() - 0.5);
  const samplePages = shuffled.slice(0, Math.min(count, allPages.length));
  
  console.log(`📊 サンプルページ数: ${samplePages.length}件\n`);
  
  const results: RegenerationResult[] = [];
  let successCount = 0;
  let errorCount = 0;
  let improvedCount = 0;
  let ruleBasedCount = 0;
  let llmBasedCount = 0;
  const startTime = Date.now();
  
  for (let i = 0; i < samplePages.length; i++) {
    const { pageId, title, row } = samplePages[i];
    const progress = `[${i + 1}/${samplePages.length}]`;
    
    try {
      // 既存のStructuredLabelを取得
      const oldLabel = await getStructuredLabel(pageId);
      const oldConfidence = oldLabel?.confidence;
      const oldGenerationMethod = oldConfidence && oldConfidence >= 0.85 ? 'rule-based' : 
                                 oldConfidence && oldConfidence >= 0.7 ? 'llm-based' : 'unknown';
      
      // labelsを配列に正規化
      let labels: string[] = [];
      if (row.labels) {
        if (Array.isArray(row.labels)) {
          labels = row.labels;
        } else if (typeof row.labels === 'object' && 'length' in row.labels) {
          const jsonLabels = JSON.parse(JSON.stringify(row.labels));
          if (Array.isArray(jsonLabels)) {
            labels = jsonLabels;
          }
        } else if (typeof row.labels === 'string') {
          labels = row.labels.split(',').map((l: string) => l.trim()).filter(Boolean);
        }
      }
      
      // autoLabelFlow実行（Phase 1改善版）
      const newLabel = await autoLabelFlow({
        title: row.title || 'Untitled',
        content: row.content || '',
        labels: labels || []
      });
      
      const newConfidence = newLabel.confidence;
      const newGenerationMethod = newConfidence && newConfidence >= 0.8 ? 'rule-based' : 
                                 newConfidence && newConfidence >= 0.7 ? 'llm-based' : 'unknown';
      
      // Firestore保存
      await saveStructuredLabel(pageId, newLabel);
      
      // 改善判定（信頼度が向上、またはルールベース生成になった）
      const improved = (newConfidence && oldConfidence && newConfidence > oldConfidence) ||
                      (oldGenerationMethod !== 'rule-based' && newGenerationMethod === 'rule-based');
      
      if (improved) {
        improvedCount++;
      }
      
      if (newGenerationMethod === 'rule-based') {
        ruleBasedCount++;
      } else {
        llmBasedCount++;
      }
      
      results.push({
        pageId,
        title,
        oldConfidence,
        newConfidence,
        oldGenerationMethod,
        newGenerationMethod,
        improved,
      });
      
      successCount++;
      
      // 進捗表示（10件ごと）
      if ((i + 1) % 10 === 0 || i === samplePages.length - 1) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`${progress} ${successCount}件完了 (改善: ${improvedCount}件, ルールベース: ${ruleBasedCount}件)`);
      }
      
    } catch (error: any) {
      errorCount++;
      console.error(`${progress} ❌ エラー: ${pageId} - ${error.message}`);
    }
  }
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ StructuredLabel再生成完了\n');
  console.log(`📊 処理結果:`);
  console.log(`   - 成功: ${successCount}件`);
  console.log(`   - エラー: ${errorCount}件`);
  console.log(`   - 改善: ${improvedCount}件 (${(improvedCount / successCount * 100).toFixed(1)}%)`);
  if (successCount > 0) {
    console.log(`   - ルールベース生成: ${ruleBasedCount}件 (${(ruleBasedCount / successCount * 100).toFixed(1)}%)`);
    console.log(`   - LLMベース生成: ${llmBasedCount}件 (${(llmBasedCount / successCount * 100).toFixed(1)}%)`);
  }
  console.log(`   - 処理時間: ${totalTime}秒`);
  if (successCount > 0) {
    console.log(`   - 平均処理時間: ${(parseFloat(totalTime) / successCount).toFixed(2)}秒/件`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // 改善の詳細を表示（最初の10件）
  console.log('📋 改善詳細（最初の10件）:\n');
  const improvedResults = results.filter(r => r.improved).slice(0, 10);
  improvedResults.forEach((result, i) => {
    console.log(`${i + 1}. ${result.title}`);
    console.log(`   ページID: ${result.pageId}`);
    console.log(`   旧: ${result.oldGenerationMethod} (信頼度: ${result.oldConfidence ? (result.oldConfidence * 100).toFixed(1) + '%' : 'N/A'})`);
    console.log(`   新: ${result.newGenerationMethod} (信頼度: ${result.newConfidence ? (result.newConfidence * 100).toFixed(1) + '%' : 'N/A'})`);
    console.log('');
  });
  
  return results;
}

async function main() {
  const count = parseInt(process.argv[2] || '50', 10);
  
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║   サンプルページのStructuredLabel再生成                           ║');
  console.log('║   Phase 1改善効果の測定                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  try {
    await regenerateSampleLabels(count);
    
    console.log('✅ 処理が正常に完了しました！\n');
    console.log('📊 改善効果を確認するには: npm run label:analyze\n');
    
  } catch (error: any) {
    console.error('\n❌ エラーが発生しました:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

