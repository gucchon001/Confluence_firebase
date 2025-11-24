/**
 * Jiraベクトル全件再構築スクリプト
 * 
 * 目的: jira_issuesテーブルのベクトルを全件再生成
 * 
 * 実行方法:
 *   npx tsx scripts/rebuild-jira-vectors.ts
 * 
 * 注意:
 *   - このスクリプトは全件再構築を行うため、時間がかかります（約30分〜1時間）
 *   - GEMINI_API_KEYが正しく設定されていることを確認してください
 */

import 'dotenv/config';

import { JiraSyncService } from '../src/lib/jira-sync-service';
import { connect } from '@lancedb/lancedb';
import * as path from 'path';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Jiraベクトル全件再構築');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 環境変数の確認
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.trim().length === 0) {
    console.error('❌ エラー: GEMINI_API_KEYが設定されていません');
    console.error('   .env.localファイルにGEMINI_API_KEYを設定してください');
    process.exit(1);
  }

  // 現在のレコード数を確認
  console.log('【ステップ1】現在のレコード数を確認');
  console.log('─────────────────────────────────────────────────────');
  
  const dbPath = path.resolve(process.cwd(), '.lancedb');
  const db = await connect(dbPath);
  const table = await db.openTable('jira_issues');
  const currentCount = await table.countRows();
  
  console.log(`現在のレコード数: ${currentCount}件`);
  
  if (currentCount === 0) {
    console.log('✅ テーブルが空のため、通常の同期で全件再構築されます');
    console.log('   通常の同期を実行してください: npm run sync:jira');
    process.exit(0);
  }

  // 確認メッセージ
  console.log('\n【ステップ2】再構築の確認');
  console.log('─────────────────────────────────────────────────────');
  console.log(`⚠️  警告: ${currentCount}件のレコードを全件再構築します`);
  console.log('   この処理には時間がかかります（約30分〜1時間）');
  console.log('   ベクトル生成のため、GEMINI_API_KEYが必要です');
  console.log('\n   続行しますか？ (y/N)');
  
  // 対話的な確認は難しいため、環境変数で制御
  const FORCE_REBUILD = process.env.FORCE_REBUILD === 'true';
  
  if (!FORCE_REBUILD) {
    console.log('\n⚠️  安全のため、環境変数FORCE_REBUILD=trueを設定してから実行してください');
    console.log('   例: FORCE_REBUILD=true npx tsx scripts/rebuild-jira-vectors.ts');
    process.exit(0);
  }

  console.log('\n【ステップ3】全件再構築を開始');
  console.log('─────────────────────────────────────────────────────');
  console.log('⏳ 処理を開始します...\n');

  // 最大取得件数を環境変数から取得（デフォルトは全件）
  const maxIssues = process.env.JIRA_MAX_ISSUES !== undefined
    ? parseInt(process.env.JIRA_MAX_ISSUES, 10)
    : 0; // 0 = 全件取得

  const jiraSyncService = new JiraSyncService(maxIssues);

  try {
    // 全件再構築のため、テーブルを削除してから同期を実行
    // ただし、syncAllIssues()はテーブルが空の場合のみ全件再構築するため、
    // 先にテーブルを削除する必要がある
    
    console.log('📋 テーブルを削除してから再構築します...');
    await db.dropTable('jira_issues');
    console.log('✅ テーブルを削除しました\n');

    // 同期を実行（テーブルが空なので全件再構築される）
    const result = await jiraSyncService.syncAllIssues();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 全件再構築が完了しました');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`取得件数: ${result.totalIssues}件`);
    console.log(`保存件数: ${result.storedIssues}件`);
    console.log(`スキップ件数: ${result.skippedIssues}件`);
    console.log(`LanceDBレコード: ${result.lanceDbRecords}件`);
    console.log(`追加: ${result.added}件, 更新: ${result.updated}件, 変更なし: ${result.unchanged}件`);

    // 再構築後のベクトルを確認
    console.log('\n【ステップ4】再構築後のベクトルを確認');
    console.log('─────────────────────────────────────────────────────');
    
    const newTable = await db.openTable('jira_issues');
    const newCount = await newTable.countRows();
    console.log(`再構築後のレコード数: ${newCount}件`);

    // サンプルレコードのベクトルを確認
    const sampleRows = await newTable
      .query()
      .limit(3)
      .toArray();

    let validVectorCount = 0;
    for (const row of sampleRows) {
      let vector: number[] = [];
      if (Array.isArray(row.vector)) {
        vector = row.vector;
      } else if (row.vector && typeof row.vector.toArray === 'function') {
        vector = row.vector.toArray();
      }

      if (vector.length > 0) {
        const isZeroVector = vector.every((v: number) => Math.abs(v) < 0.0001);
        if (!isZeroVector) {
          validVectorCount++;
        }
      }
    }

    if (validVectorCount === sampleRows.length) {
      console.log(`✅ サンプルレコードのベクトルはすべて正常です`);
    } else {
      console.error(`❌ 警告: サンプルレコードの中に0ベクトルが含まれています`);
    }

  } catch (error) {
    console.error('\n❌ 全件再構築中にエラーが発生しました:', error);
    console.error('   エラー詳細:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ 予期しないエラーが発生しました:', error);
  process.exit(1);
});

