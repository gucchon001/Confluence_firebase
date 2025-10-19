/**
 * StructuredLabel生成スクリプト
 * Phase 0A-1: LanceDBからページを読み込み、StructuredLabelを生成
 * 
 * 使い方:
 *   npx tsx scripts/generate-structured-labels.ts [maxPages]
 * 
 * 例:
 *   npx tsx scripts/generate-structured-labels.ts 10     # 10ページのみ
 *   npx tsx scripts/generate-structured-labels.ts 100    # 100ページ
 *   npx tsx scripts/generate-structured-labels.ts        # 全ページ（デフォルト1000）
 */

import 'dotenv/config';
import { optimizedLanceDBClient } from '@/lib/optimized-lancedb-client';
import { autoLabelFlow } from '@/ai/flows/auto-label-flow';
import { saveStructuredLabel, getStructuredLabelStats } from '@/lib/structured-label-service-admin';
import { loadDomainKnowledge } from '@/lib/domain-knowledge-loader';

interface ConfluencePage {
  id: string;
  pageId: string;
  title: string;
  content: string;
  labels?: string[];
}

async function main() {
  console.log('\n🏷️ StructuredLabel生成開始\n');
  
  // コマンドライン引数から最大ページ数を取得
  const maxPages = parseInt(process.argv[2] || '1000', 10);
  console.log(`📊 最大処理ページ数: ${maxPages}ページ\n`);
  
  try {
    // Step 1: Domain Knowledgeを読み込み
    console.log('📚 Domain Knowledgeを読み込み中...');
    const domainKnowledge = await loadDomainKnowledge();
    console.log(`✅ Domain Knowledge読み込み完了\n`);
    
    // Step 2: LanceDBに接続
    console.log('🔌 LanceDBに接続中...');
    const connection = await optimizedLanceDBClient.getConnection();
    const table = connection.table;
    console.log(`✅ LanceDB接続完了\n`);
    
    // Step 3: 全ページを取得
    console.log(`📦 ページを取得中（最大${maxPages}件）...`);
    const arrow = await table.query().limit(maxPages).toArrow();
    
    const pages: ConfluencePage[] = [];
    for (let i = 0; i < arrow.numRows; i++) {
      const row: any = {};
      for (let j = 0; j < arrow.schema.fields.length; j++) {
        const field = arrow.schema.fields[j];
        const column = arrow.getChildAt(j);
        row[field.name] = column?.get(i);
      }
      
      // labelsを配列に正規化（Arrow List → 通常配列）
      let labels: string[] = [];
      if (row.labels) {
        if (Array.isArray(row.labels)) {
          // 通常の配列
          labels = row.labels;
        } else if (typeof row.labels === 'object' && 'length' in row.labels) {
          // Arrow List型オブジェクト → JSON化して配列に変換
          const jsonLabels = JSON.parse(JSON.stringify(row.labels));
          if (Array.isArray(jsonLabels)) {
            labels = jsonLabels;
          }
        } else if (typeof row.labels === 'string') {
          // カンマ区切りの文字列
          labels = row.labels.split(',').map((l: string) => l.trim()).filter(Boolean);
        }
      }
      
      // pageIdを安全に生成（空文字列を防ぐ）
      const pageId = String(row.pageId || row.id || `unknown-${i}`).trim() || `page-${i}`;
      
      pages.push({
        id: pageId,
        pageId: pageId,
        title: row.title || 'Untitled',
        content: row.content || '',
        labels
      });
    }
    
    console.log(`✅ ${pages.length}ページ取得完了\n`);
    
    // Step 4: StructuredLabel生成
    console.log('🏷️ StructuredLabel生成開始...\n');
    
    let successCount = 0;
    let errorCount = 0;
    let ruleBasedCount = 0;
    let llmBasedCount = 0;
    
    const startTime = Date.now();
    
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const progress = `[${i + 1}/${pages.length}]`;
      
      try {
        // autoLabelFlow実行
        const structuredLabel = await autoLabelFlow({
          title: page.title,
          content: page.content,
          labels: page.labels || []
        });
        
        // Firestore保存
        await saveStructuredLabel(page.pageId, structuredLabel);
        
        successCount++;
        
        // カウント
        if (structuredLabel.confidence && structuredLabel.confidence >= 0.85) {
          ruleBasedCount++;
        } else {
          llmBasedCount++;
        }
        
        // 進捗表示（10件ごと）
        if ((i + 1) % 10 === 0) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const avgTime = (parseFloat(elapsed) / (i + 1)).toFixed(2);
          console.log(`${progress} ${successCount}件完了 (${elapsed}秒経過, 平均${avgTime}秒/件)`);
        }
        
      } catch (error: any) {
        errorCount++;
        console.error(`${progress} ❌ エラー: ${page.title} - ${error.message}`);
      }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ StructuredLabel生成完了\n');
    console.log(`📊 処理結果:`);
    console.log(`   - 成功: ${successCount}件`);
    console.log(`   - エラー: ${errorCount}件`);
    console.log(`   - ルールベース: ${ruleBasedCount}件 (${((ruleBasedCount / successCount) * 100).toFixed(1)}%)`);
    console.log(`   - LLMベース: ${llmBasedCount}件 (${((llmBasedCount / successCount) * 100).toFixed(1)}%)`);
    console.log(`   - 処理時間: ${totalTime}秒`);
    console.log(`   - 平均処理時間: ${(parseFloat(totalTime) / pages.length).toFixed(2)}秒/件`);
    
    // Step 5: 統計情報を表示
    console.log('\n📊 統計情報を取得中...');
    const stats = await getStructuredLabelStats();
    
    console.log(`\n📈 StructuredLabel統計:`);
    console.log(`   - 総件数: ${stats.total}件`);
    console.log(`   - 平均信頼度: ${(stats.averageConfidence * 100).toFixed(1)}%`);
    
    console.log(`\n📋 カテゴリ別:`);
    Object.entries(stats.byCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .forEach(([category, count]) => {
        console.log(`   - ${category}: ${count}件`);
      });
    
    console.log(`\n🏢 ドメイン別（上位10件）:`);
    Object.entries(stats.byDomain)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .forEach(([domain, count]) => {
        console.log(`   - ${domain}: ${count}件`);
      });
    
    console.log(`\n📝 ステータス別:`);
    Object.entries(stats.byStatus)
      .sort(([, a], [, b]) => b - a)
      .forEach(([status, count]) => {
        console.log(`   - ${status}: ${count}件`);
      });
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error: any) {
    console.error('\n❌ エラーが発生しました:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

