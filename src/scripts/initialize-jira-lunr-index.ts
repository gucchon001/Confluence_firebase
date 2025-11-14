import 'dotenv/config';
import { lunrInitializer } from '../lib/lunr-initializer';

async function main() {
  console.log('🚀 Jira検索用Lunrインデックスの初期化を開始します...\n');

  try {
    await lunrInitializer.initializeAsync('jira_issues');
    console.log('\n✅ Jira検索用Lunrインデックスの初期化が完了しました');
  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ 予期しないエラーが発生しました:', error);
  process.exit(1);
});

