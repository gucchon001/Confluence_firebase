import 'dotenv/config';
import { getConfluenceServerInfo, getAllSpaceContent } from '../lib/confluence-client';

async function testConfluenceAPI() {
  try {
    // サーバー情報の取得テスト
    console.log('Testing server info...');
    const serverInfo = await getConfluenceServerInfo();
    console.log('Server info:', serverInfo);

    // スペースコンテンツの取得テスト
    const spaceKey = process.env.CONFLUENCE_SPACE_KEY;
    if (!spaceKey) {
      throw new Error('CONFLUENCE_SPACE_KEY environment variable is not set');
    }

    console.log(`\nFetching content from space: ${spaceKey}`);
    const content = await getAllSpaceContent(spaceKey);
    console.log(`Found ${content.length} pages`);
    
    // 最初の3ページの情報を表示
    content.slice(0, 3).forEach((page: any, index: number) => {
      console.log(`\nPage ${index + 1}:`);
      console.log('Title:', page.title);
      console.log('ID:', page.id);
      console.log('Version:', page.version.number);
      console.log('Last updated:', page.version.when);
    });

  } catch (error) {
    console.error('Error testing Confluence API:', error);
  }
}

testConfluenceAPI();

