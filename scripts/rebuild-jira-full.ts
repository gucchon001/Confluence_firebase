/**
 * Jira全件再構築スクリプト
 * 
 * 目的: 新しいスキーマ（カスタムフィールド追加、全コメント取得）で全件再構築
 * 
 * 注意事項:
 * - 約5430件のレコードを再生成するため、時間がかかります（30分〜1時間程度）
 * - ベクトル生成に時間がかかるため、進捗を確認しながら実行してください
 * 
 * 実行方法:
 *   npx tsx scripts/rebuild-jira-full.ts
 */

import 'dotenv/config';
import { JiraSyncService } from '../src/lib/jira-sync-service';
import { connect } from '@lancedb/lancedb';
import * as path from 'path';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Jira全件再構築スクリプト');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('⚠️  注意事項:');
  console.log('  - 約5430件のレコードを再生成します');
  console.log('  - 処理時間は30分〜1時間程度かかる可能性があります');
  console.log('  - 既存のLanceDBテーブルは削除されます');
  console.log('  - 新しいスキーマ（カスタムフィールド、全コメント）で再構築されます\n');
  
  // 確認プロンプト（実際の実行時は手動で確認）
  console.log('✅ 実行を開始します...\n');

  const startTime = Date.now();

  try {
    // 全件取得モード（maxIssues=0）
    const jiraSyncService = new JiraSyncService(0);

    // 既存のテーブルを削除
    console.log('📋 既存のLanceDBテーブルを削除します...');
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    const db = await connect(dbPath);
    
    try {
      await db.dropTable('jira_issues');
      console.log('✅ テーブルを削除しました\n');
    } catch (error) {
      console.warn('⚠️  テーブル削除に失敗（既に存在しない可能性があります）:', error);
    }

    // 全件同期を実行
    console.log('【ステップ1】全件同期を開始します\n');
    console.log('📊 全件取得モード: isLastがtrueになるまで取得します\n');
    
    const result = await jiraSyncService.syncAllIssues();

    const endTime = Date.now();
    const duration = Math.floor((endTime - startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 全件再構築が完了しました');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`取得件数: ${result.totalIssues}件`);
    console.log(`LanceDBレコード: ${result.lanceDbRecords}件`);
    console.log(`処理時間: ${minutes}分${seconds}秒\n`);

    // 再構築後のレコードを確認
    console.log('【ステップ2】再構築後のレコードを確認\n');
    
    const table = await db.openTable('jira_issues');
    const sampleRows = await table.query().limit(3).toArray();
    
    console.log(`サンプルレコード（最初の3件）:\n`);
    
    for (let i = 0; i < sampleRows.length; i++) {
      const row = sampleRows[i];
      const issueKey = row.issue_key || row.id;
      const title = row.title || 'タイトル不明';
      
      console.log(`課題 ${i + 1}: ${issueKey} - ${title.substring(0, 60)}...`);
      
      // カスタムフィールドの確認
      const customFields = [
        'month',
        'custom_assignee',
        'gig_status',
        'dev_validation',
        'prod_validation',
        'release_date',
        'completed_date',
        'desired_release_date',
        'deadline_release_date',
        'impact_domain',
        'impact_level'
      ];
      
      const fieldsWithValues = customFields.filter(field => 
        row[field] !== undefined && row[field] !== null && row[field] !== ''
      );
      
      if (fieldsWithValues.length > 0) {
        console.log(`  ✅ カスタムフィールド: ${fieldsWithValues.length}個に値あり`);
      }
      
      // コメント履歴の確認
      const content = row.content || '';
      const commentsMatch = content.match(/コメント履歴:\n(.*)/s);
      if (commentsMatch) {
        const commentsText = commentsMatch[1];
        const commentCount = (commentsText.match(/コメント\d+:/g) || []).length;
        console.log(`  ✅ コメント履歴: ${commentCount}件`);
      }
      
      console.log('');
    }

    // ベクトルの確認
    const firstRow = sampleRows[0];
    if (firstRow && firstRow.vector) {
      // LanceDBから取得したベクトルは配列またはTypedArrayの可能性があるため、配列に変換
      const vector = Array.isArray(firstRow.vector) 
        ? firstRow.vector as number[]
        : Array.from(firstRow.vector as any);
      
      if (vector.length > 0) {
        const isZeroVector = vector.every(v => v === 0);
        if (isZeroVector) {
          console.error('❌ 警告: ベクトルが0ベクトルです。ベクトル生成に問題がある可能性があります。');
        } else {
          console.log(`✅ ベクトルが正しく生成されています（サンプル確認: ${vector.length}次元）`);
        }
      } else {
        console.warn('⚠️  ベクトルが空です');
      }
    }

    console.log('\n✅ 全件再構築が正常に完了しました');

  } catch (error) {
    console.error('\n❌ 全件再構築中にエラーが発生しました:', error);
    console.error('   エラー詳細:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('   スタックトレース:', error.stack);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ 予期しないエラーが発生しました:', error);
  process.exit(1);
});

