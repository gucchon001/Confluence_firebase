import 'dotenv/config';
import { lunrInitializer } from '../lib/lunr-initializer';

async function main() {
  console.log('🚀 Jira Lunrインデックスの初期化を開始します...\n');
  
  try {
    // Jira用のLunrインデックスを初期化
    await lunrInitializer.initializeAsync('jira_issues');
    
    console.log('\n✅ Jira Lunrインデックスの初期化が完了しました');
    
    // 状態を確認
    const status = lunrInitializer.getStatus();
    console.log(`📊 インデックス状態:`);
    console.log(`   - 初期化済み: ${status.isInitialized ? '✅' : '❌'}`);
    console.log(`   - ドキュメント数: ${status.documentCount}`);
    console.log(`   - 最終更新: ${status.lastUpdated?.toLocaleString() || 'N/A'}`);
    
  } catch (error) {
    console.error('❌ Jira Lunrインデックスの初期化中にエラーが発生しました:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ 予期しないエラーが発生しました:', error);
  process.exit(1);
});

