import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import axios from 'axios';

async function debugSpecificPage() {
  try {
    // LanceDBに接続
    const db = await lancedb.connect('.lancedb');
    const tbl = await db.openTable('confluence');
    
    // 1. LanceDBから「201_■応募管理」を検索
    console.log('🔍 LanceDBから「201_■応募管理」を検索中...');
    const lancedbResults = await tbl.query().where('title LIKE "%201_■応募管理%"').limit(10).toArray();
    console.log(`LanceDB結果: ${lancedbResults.length}件`);
    
    if (lancedbResults.length > 0) {
      const result = lancedbResults[0];
      console.log('LanceDB内のデータ:');
      console.log(`- pageId: ${result.pageId}`);
      console.log(`- title: ${result.title}`);
      console.log(`- lastUpdated: ${result.lastUpdated}`);
      console.log(`- labels: ${JSON.stringify(result.labels)}`);
    }
    
    // 2. Confluence APIから「201_■応募管理」を検索
    console.log('\n🔍 Confluence APIから「201_■応募管理」を検索中...');
    const response = await axios.get(`${process.env.CONFLUENCE_BASE_URL}/wiki/rest/api/content/search`, {
      params: {
        cql: 'title ~ "201_■応募管理"',
        expand: 'version,metadata.labels'
      },
      auth: { 
        username: process.env.CONFLUENCE_USER_EMAIL, 
        password: process.env.CONFLUENCE_API_TOKEN 
      }
    });
    
    if (response.data && response.data.results && response.data.results.length > 0) {
      const page = response.data.results[0];
      console.log('Confluence API結果:');
      console.log(`- pageId: ${page.id}`);
      console.log(`- title: ${page.title}`);
      console.log(`- lastUpdated: ${page.version?.when}`);
      console.log(`- labels: ${JSON.stringify(page.metadata?.labels?.results)}`);
      
      // 3. ラベル除外チェック
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
    }
    
  } catch (error: any) {
    console.error('エラー:', error.message);
  }
}

debugSpecificPage();
