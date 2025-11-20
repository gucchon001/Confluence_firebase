/**
 * Jira課題用StructuredLabel生成スクリプト
 * Phase 1: Jira課題にもドメイン知識を使用したStructuredLabelを生成
 * 
 * 使い方:
 *   npx tsx scripts/generate-jira-structured-labels.ts [maxIssues]
 * 
 * 例:
 *   npx tsx scripts/generate-jira-structured-labels.ts 10     # 10課題のみ
 *   npx tsx scripts/generate-jira-structured-labels.ts 100    # 100課題
 *   npx tsx scripts/generate-jira-structured-labels.ts        # 全課題（デフォルト5000）
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import { autoLabelFlow } from '../src/ai/flows/auto-label-flow';
import { saveStructuredLabel, getStructuredLabelStats } from '../src/lib/structured-label-service-admin';
import { loadDomainKnowledge } from '../src/lib/domain-knowledge-loader';
import * as admin from 'firebase-admin';

// Firebase Admin SDK初期化
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

interface JiraIssue {
  id: string;
  issue_key: string;
  title: string;
  content: string;
  labels?: string[];
  issue_type?: string;
  status?: string;
  priority?: string;
}

async function main() {
  console.log('\n🏷️ Jira課題用StructuredLabel生成開始\n');
  
  // コマンドライン引数から最大課題数を取得
  const maxIssues = parseInt(process.argv[2] || '5000', 10);
  console.log(`📊 最大処理課題数: ${maxIssues}課題\n`);
  
  try {
    // Step 1: Domain Knowledgeを読み込み
    console.log('📚 Domain Knowledgeを読み込み中...');
    const domainKnowledge = await loadDomainKnowledge();
    console.log(`✅ Domain Knowledge読み込み完了\n`);
    
    // Step 2: LanceDBに接続
    console.log('🔌 LanceDBに接続中...');
    const lanceDb = await lancedb.connect('.lancedb');
    let table: any;
    
    try {
      table = await lanceDb.openTable('jira_issues');
      console.log(`✅ LanceDB接続完了（jira_issuesテーブル）\n`);
    } catch (error: any) {
      console.error(`❌ jira_issuesテーブルが見つかりません: ${error.message}`);
      console.error('  先にJiraデータを同期してください: npm run sync:jira');
      return;
    }
    
    // Step 3: 全課題を取得
    console.log(`📦 課題を取得中（最大${maxIssues}件）...`);
    const arrow = await table.query().limit(maxIssues).toArrow();
    
    const issues: JiraIssue[] = [];
    for (let i = 0; i < arrow.numRows; i++) {
      const row: any = {};
      for (let j = 0; j < arrow.schema.fields.length; j++) {
        const field = arrow.schema.fields[j];
        const column = arrow.getChildAt(j);
        row[field.name] = column?.get(i);
      }
      
      // labelsを配列に正規化（Arrow List → 通常配列）
      let labels: string[] = [];
      if (row.labels_text) {
        if (typeof row.labels_text === 'string') {
          labels = row.labels_text.split(',').map((l: string) => l.trim()).filter(Boolean);
        } else if (Array.isArray(row.labels_text)) {
          labels = row.labels_text;
        }
      }
      
      // issue_keyを安全に生成
      const issueKey = String(row.issue_key || row.id || `unknown-${i}`).trim() || `issue-${i}`;
      
      issues.push({
        id: issueKey,
        issue_key: issueKey,
        title: row.title || 'Untitled',
        content: row.content || '',
        labels,
        issue_type: row.issue_type,
        status: row.status,
        priority: row.priority,
      });
    }
    
    console.log(`✅ ${issues.length}課題取得完了\n`);
    
    // Step 4: StructuredLabel生成
    console.log('🏷️ StructuredLabel生成開始...\n');
    
    let successCount = 0;
    let errorCount = 0;
    let ruleBasedCount = 0;
    let llmBasedCount = 0;
    
    const startTime = Date.now();
    
    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i];
      const progress = `[${i + 1}/${issues.length}]`;
      
      try {
        // autoLabelFlow実行（Jira対応: source='jira'を指定）
        const structuredLabel = await autoLabelFlow({
          title: issue.title,
          content: issue.content,
          labels: issue.labels || [],
          source: 'jira',
          issueType: issue.issue_type,
          status: issue.status,
          priority: issue.priority,
        });
        
        // Firestore保存（Jira課題用: issue_keyをIDとして使用）
        await saveStructuredLabel(issue.issue_key, structuredLabel);
        
        if (structuredLabel.confidence && structuredLabel.confidence >= 0.8) {
          ruleBasedCount++;
        } else {
          llmBasedCount++;
        }
        
        successCount++;
        
        // 進捗をより頻繁に表示（毎件または10件ごと）
        if ((i + 1) % 10 === 0 || i === 0) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const avgTime = (parseFloat(elapsed) / (i + 1)).toFixed(2);
          console.log(`${progress} ${i + 1}課題完了 (成功: ${successCount}件, ルールベース: ${ruleBasedCount}件, LLM: ${llmBasedCount}件) - 経過時間: ${elapsed}秒, 平均: ${avgTime}秒/件`);
        }
      } catch (error: any) {
        errorCount++;
        console.error(`${progress} ❌ エラー: ${issue.issue_key} - ${error.message}`);
      }
    }
    
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ StructuredLabel生成完了\n`);
    
    console.log(`📊 処理結果:`);
    console.log(`   - 成功: ${successCount}件`);
    console.log(`   - エラー: ${errorCount}件`);
    console.log(`   - ルールベース生成: ${ruleBasedCount}件 (${(ruleBasedCount / successCount * 100).toFixed(1)}%)`);
    console.log(`   - LLMベース生成: ${llmBasedCount}件 (${(llmBasedCount / successCount * 100).toFixed(1)}%)`);
    console.log(`   - 処理時間: ${elapsedTime}秒`);
    console.log(`   - 平均処理時間: ${(parseFloat(elapsedTime) / successCount).toFixed(2)}秒/件`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    // Step 5: 統計情報を表示
    const stats = await getStructuredLabelStats();
    console.log(`📊 Firestore統計（全体）:`);
    console.log(`   - 総件数: ${stats.total}件`);
    console.log(`   - 平均信頼度: ${(stats.averageConfidence * 100).toFixed(1)}%`);
    console.log(`   - カテゴリ別（上位5件）:`);
    Object.entries(stats.byCategory)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .forEach(([category, count]) => {
        console.log(`      - ${category}: ${count}件`);
      });
    console.log(`   - ドメイン別（上位5件）:`);
    Object.entries(stats.byDomain)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .forEach(([domain, count]) => {
        console.log(`      - ${domain}: ${count}件`);
      });
    console.log('');
    
    console.log('✅ 処理が正常に完了しました！\n');
    console.log('📊 次のステップ:');
    console.log('   1. Firestore → LanceDB同期: npm run sync:labels-to-lancedb');
    console.log('   2. インデックス作成: npm run lancedb:create-indexes');
    console.log('   3. GCSアップロード: npm run upload:production-data');
    
  } catch (error: any) {
    console.error(`❌ エラー: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

