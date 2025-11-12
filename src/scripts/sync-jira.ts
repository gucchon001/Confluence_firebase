import 'dotenv/config';

import { JiraSyncService } from '../lib/jira-sync-service';

async function main() {
  // 最大取得件数を環境変数またはデフォルト1000件に設定
  const maxIssues = process.env.JIRA_MAX_ISSUES 
    ? parseInt(process.env.JIRA_MAX_ISSUES, 10) 
    : 1000;

  console.log(`🚀 Jira 同期を開始します（最大${maxIssues}件）`);

  const jiraSyncService = new JiraSyncService(maxIssues);

  try {
    const result = await jiraSyncService.syncAllIssues();

    console.log('✅ Jira同期が完了しました');
    console.log(`  取得件数: ${result.totalIssues}`);
    console.log(`  保存件数: ${result.storedIssues}`);
    console.log(`  スキップ件数: ${result.skippedIssues}`);
    console.log(`  LanceDBレコード: ${result.lanceDbRecords}`);
  } catch (error) {
    console.error('❌ Jira同期中にエラーが発生しました:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ 予期しないエラーが発生しました:', error);
  process.exit(1);
});

