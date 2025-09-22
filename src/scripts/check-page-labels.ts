import 'dotenv/config';
import axios from 'axios';

async function checkPageLabels() {
  try {
    // Confluence APIから「201_■応募管理」を検索
    console.log('🔍 Confluence APIから「201_■応募管理」を検索中...');
    const response = await axios.get(`${process.env.CONFLUENCE_BASE_URL}/wiki/rest/api/content/search`, {
      params: {
        cql: 'title ~ "210_■応募管理機能"',
        expand: 'version,metadata.labels'
      },
      auth: { 
        username: process.env.CONFLUENCE_USER_EMAIL, 
        password: process.env.CONFLUENCE_API_TOKEN 
      },
      timeout: 10000 // 10秒タイムアウト
    });
    
    if (response.data && response.data.results && response.data.results.length > 0) {
      const page = response.data.results[0];
      console.log('Confluence API結果:');
      console.log(`- pageId: ${page.id}`);
      console.log(`- title: ${page.title}`);
      console.log(`- lastUpdated: ${page.version?.when}`);
      console.log(`- labels: ${JSON.stringify(page.metadata?.labels?.results)}`);
      
      // ラベル除外チェック
      console.log('\n🔍 ラベル除外チェック...');
      const labels = page.metadata?.labels?.results?.map((l: any) => l?.name) || [];
      console.log(`ラベル一覧: ${JSON.stringify(labels)}`);
      
      // 除外ラベルをチェック
      const excludeLabels = ['スコープ外', 'メールテンプレート', '議事録', 'meeting-notes', 'アーカイブ', 'archive'];
      const isExcluded = labels.some((label: string) => 
        excludeLabels.some(excludeLabel => 
          label.toLowerCase() === excludeLabel.toLowerCase()
        )
      );
      console.log(`除外対象: ${isExcluded}`);
      
      if (isExcluded) {
        console.log('✅ このページはラベル除外対象です');
        console.log('   そのため、LanceDBに保存されず、毎回新規として処理されます');
      } else {
        console.log('❌ このページはラベル除外対象ではありません');
        console.log('   他の原因で新規として処理されています');
      }
    } else {
      console.log('❌ 「201_■応募管理」ページが見つかりませんでした');
    }
    
  } catch (error: any) {
    console.error('エラー:', error.message);
    if (error.code === 'ECONNABORTED') {
      console.error('タイムアウト: Confluence APIの応答が遅いです');
    }
  }
}

checkPageLabels();
