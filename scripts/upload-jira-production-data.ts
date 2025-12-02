/**
 * JiraテーブルのみをGCSにアップロードするスクリプト
 * 
 * 使用方法:
 * ```bash
 * npm run upload:jira-production-data
 * ```
 * 
 * これは upload-production-data.ts のラッパーで、Jiraテーブルのみをアップロードします
 */

import 'dotenv/config';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function main() {
  console.log('='.repeat(80));
  console.log('📤 JiraテーブルのみをGCSにアップロード');
  console.log('='.repeat(80));
  console.log('');
  console.log('⚠️  このスクリプトはJiraテーブル（jira_issues）のみをアップロードします');
  console.log('   Confluenceテーブルは影響を受けません');
  console.log('');

  try {
    // 環境変数を設定してupload-production-data.tsを実行
    process.env.UPLOAD_TABLE_FILTER = 'jira_issues';
    
    console.log('🚀 アップロードを開始します...\n');
    
    const { stdout, stderr } = await execAsync('npx tsx scripts/upload-production-data.ts', {
      env: {
        ...process.env,
        UPLOAD_TABLE_FILTER: 'jira_issues'
      }
    });

    if (stdout) {
      console.log(stdout);
    }
    if (stderr) {
      console.error(stderr);
    }

    console.log('\n✅ Jiraテーブルのアップロードが完了しました\n');

  } catch (error: any) {
    console.error('\n❌ アップロード中にエラーが発生しました:');
    console.error(`   ${error.message}`);
    if (error.stdout) {
      console.log(error.stdout);
    }
    if (error.stderr) {
      console.error(error.stderr);
    }
    process.exit(1);
  }
}

main().catch(console.error);

