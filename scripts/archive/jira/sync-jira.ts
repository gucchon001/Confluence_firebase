import 'dotenv/config';

import { jiraSyncService } from '../../../src/lib/archive/jira-sync-service';

async function main() {
  console.log('🚀 Jira 全件同期を開始します');

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

if (require.main === module) {
  main();
}
