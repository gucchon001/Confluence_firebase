import 'dotenv/config';

import { JiraSyncService } from '../lib/jira-sync-service';

async function main() {
  // 最大取得件数を環境変数またはデフォルト1000件に設定
  // JIRA_MAX_ISSUES=0 の場合は全件取得モード
  const maxIssues = process.env.JIRA_MAX_ISSUES !== undefined
    ? parseInt(process.env.JIRA_MAX_ISSUES, 10)
    : 1000;

  if (maxIssues === 0) {
    console.log(`🚀 Jira 同期を開始します（全件取得モード）`);
  } else {
    console.log(`🚀 Jira 同期を開始します（最大${maxIssues}件）`);
  }

  const jiraSyncService = new JiraSyncService(maxIssues);

  try {
    const result = await jiraSyncService.syncAllIssues();

    console.log('✅ Jira同期が完了しました');
    console.log(`  取得件数: ${result.totalIssues}`);
    console.log(`  保存件数: ${result.storedIssues}`);
    console.log(`  スキップ件数: ${result.skippedIssues}`);
    console.log(`  LanceDBレコード: ${result.lanceDbRecords}`);
    console.log(`  追加: ${result.added}件, 更新: ${result.updated}件, 変更なし: ${result.unchanged}件`);
  } catch (error) {
    console.error('❌ Jira同期中にエラーが発生しました:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ 予期しないエラーが発生しました:', error);
  process.exit(1);
});

