const { execSync } = require('child_process');
const fs = require('fs');

console.log('🧪 データドリブンなドメイン知識抽出V2のテスト実行');

try {
  // 設定ファイルをコピー
  console.log('📋 設定ファイルを準備中...');
  execSync('copy config\\domain-knowledge-config-v2.json config\\domain-knowledge-config.json');
  
  // 小規模テスト用に設定を調整
  const config = JSON.parse(fs.readFileSync('config/domain-knowledge-config.json', 'utf8'));
  config.confluence.maxPages = 50; // 小規模テスト
  config.confluence.batchSize = 10;
  config.llm.batchSize = 3;
  config.llm.delayBetweenRequests = 500;
  
  fs.writeFileSync('config/domain-knowledge-config.json', JSON.stringify(config, null, 2));
  console.log('✅ 設定ファイルを調整しました');
  
  // パイプライン実行
  console.log('🚀 パイプライン実行中...');
  execSync('npx tsx src/scripts/run-domain-knowledge-extraction-v2.ts', { stdio: 'inherit' });
  
  console.log('✅ テスト実行完了！');
  
  // 結果の確認
  console.log('\n📊 結果確認:');
  
  if (fs.existsSync('data/domain-knowledge-v2/final-domain-knowledge-v2.json')) {
    const result = JSON.parse(fs.readFileSync('data/domain-knowledge-v2/final-domain-knowledge-v2.json', 'utf8'));
    console.log(`- 総ページ数: ${result.statistics.totalPages}`);
    console.log(`- 総キーワード数: ${result.statistics.totalKeywords}`);
    console.log(`- ドメイン名数: ${result.statistics.domainNames}`);
    console.log(`- 削減率: ${result.statistics.reductionRate.toFixed(1)}%`);
    console.log(`- 保護キーワード数: ${result.statistics.protectedKeywords}`);
    
    console.log('\n🏆 トップドメイン名:');
    result.topDomainNames.slice(0, 10).forEach((domain, index) => {
      console.log(`  ${index + 1}. ${domain}`);
    });
    
    // 教室管理の確認
    const classroomDomains = result.domainNames.filter(domain => domain.includes('教室'));
    console.log('\n🏫 教室関連ドメイン名:');
    classroomDomains.forEach(domain => {
      console.log(`  - ${domain}`);
    });
    
    if (classroomDomains.length > 0) {
      console.log('✅ 教室管理ドメイン名が正常に抽出されました！');
    } else {
      console.log('⚠️ 教室管理ドメイン名が見つかりませんでした');
    }
  } else {
    console.log('❌ 結果ファイルが見つかりません');
  }
  
} catch (error) {
  console.error('❌ テスト実行中にエラーが発生しました:', error.message);
  process.exit(1);
}
