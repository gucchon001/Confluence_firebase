import 'dotenv/config';
import axios from 'axios';

async function checkSpecificPage(pageId: string) {
  try {
    const baseUrl = process.env.CONFLUENCE_BASE_URL;
    const username = process.env.CONFLUENCE_USER_EMAIL;
    const apiToken = process.env.CONFLUENCE_API_TOKEN;
    
    if (!baseUrl || !username || !apiToken) {
      throw new Error('Confluence API credentials not configured');
    }

    console.log(`=== ページID ${pageId} の詳細確認 ===`);
    
    // ページの詳細を取得
    const endpoint = `${baseUrl}/wiki/rest/api/content/${pageId}`;
    const params = {
      expand: 'body.storage,version,space,metadata.labels'
    };
    
    try {
      const response = await axios.get(endpoint, {
        params,
        auth: { username, password: apiToken }
      });
      
      const page = response.data;
      console.log('✅ ページが見つかりました');
      console.log(`タイトル: ${page.title}`);
      console.log(`スペース: ${page.space?.key} (${page.space?.name})`);
      console.log(`最終更新: ${page.version?.when}`);
      console.log(`URL: ${baseUrl}/wiki/spaces/${page.space?.key}/pages/${pageId}`);
      
      // ラベルを取得
      const labels = page.metadata?.labels?.results?.map((l: any) => l?.name).filter((x: any) => typeof x === 'string' && x.trim().length > 0) || [];
      console.log(`ラベル: ${JSON.stringify(labels)}`);
      
      // コンテンツの長さ
      const content = page.body?.storage?.value || '';
      console.log(`コンテンツ長: ${content.length} 文字`);
      
      return true;
    } catch (apiError: any) {
      if (axios.isAxiosError(apiError)) {
        const status = apiError.response?.status;
        const statusText = apiError.response?.statusText;
        console.log(`❌ API エラー: ${status} ${statusText}`);
        
        if (status === 404) {
          console.log('ページが存在しないか、アクセス権限がありません');
        } else if (status === 403) {
          console.log('アクセス権限がありません');
        } else if (status === 401) {
          console.log('認証エラーです');
        }
      } else {
        console.log(`❌ エラー: ${apiError.message}`);
      }
      return false;
    }
  } catch (error: any) {
    console.error('エラー:', error.message);
    return false;
  }
}

async function main() {
  const pageIds = ['540901632', '703889475'];
  
  for (const pageId of pageIds) {
    console.log(`\n${'='.repeat(50)}`);
    const exists = await checkSpecificPage(pageId);
    console.log(`ページID ${pageId}: ${exists ? '存在' : '不存在'}`);
  }
}

main().catch(console.error);
