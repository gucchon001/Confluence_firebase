/**
 * 直接Confluence APIを呼び出してコンテンツを確認
 */

import 'dotenv/config';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('test-direct-api.txt', message + '\n');
}

async function testDirectApi() {
  fs.writeFileSync('test-direct-api.txt', '');
  
  log('🌐 直接Confluence APIを呼び出してコンテンツを確認中...\n');

  try {
    const baseUrl = process.env.CONFLUENCE_BASE_URL;
    const username = process.env.CONFLUENCE_USER_EMAIL;
    const apiToken = process.env.CONFLUENCE_API_TOKEN;
    const spaceKey = process.env.CONFLUENCE_SPACE_KEY;
    
    log(`環境変数確認:`);
    log(`- CONFLUENCE_BASE_URL: ${baseUrl}`);
    log(`- CONFLUENCE_USER_EMAIL: ${username}`);
    log(`- CONFLUENCE_API_TOKEN: ${apiToken ? '設定済み' : '未設定'}`);
    log(`- CONFLUENCE_SPACE_KEY: ${spaceKey}`);
    
    if (!baseUrl || !username || !apiToken) {
      log('❌ 必要な環境変数が設定されていません');
      return;
    }
    
    // 1. ページIDで直接取得
    log('\n📄 ページID 703529146 で直接取得中...');
    const pageUrl = `${baseUrl}/wiki/rest/api/content/703529146`;
    const pageParams = new URLSearchParams({
      expand: 'body.storage,body.view,body.export_view,space,version,metadata.labels'
    });
    
    log(`URL: ${pageUrl}?${pageParams}`);
    
    const pageResponse = await fetch(`${pageUrl}?${pageParams}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${username}:${apiToken}`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });
    
    log(`レスポンスステータス: ${pageResponse.status}`);
    log(`レスポンスOK: ${pageResponse.ok}`);
    
    if (pageResponse.ok) {
      const pageData = await pageResponse.json();
      
      log(`\n✅ ページ取得成功:`);
      log(`- ID: ${pageData.id}`);
      log(`- タイトル: ${pageData.title}`);
      log(`- スペース: ${pageData.space?.key}`);
      log(`- バージョン: ${pageData.version?.number}`);
      log(`- 作成日: ${pageData.version?.when}`);
      
      // ボディの詳細分析
      log(`\n📊 ボディ分析:`);
      log(`- body.storage.value 存在: ${!!pageData.body?.storage?.value}`);
      log(`- body.storage.value 長: ${pageData.body?.storage?.value?.length || 0}文字`);
      log(`- body.view.value 存在: ${!!pageData.body?.view?.value}`);
      log(`- body.view.value 長: ${pageData.body?.view?.value?.length || 0}文字`);
      log(`- body.export_view.value 存在: ${!!pageData.body?.export_view?.value}`);
      log(`- body.export_view.value 長: ${pageData.body?.export_view?.value?.length || 0}文字`);
      
      // コンテンツの内容を表示
      if (pageData.body?.storage?.value) {
        log(`\n📄 body.storage.value 内容 (最初の1000文字):`);
        log(`"${pageData.body.storage.value.substring(0, 1000)}..."`);
      }
      
      if (pageData.body?.view?.value) {
        log(`\n📄 body.view.value 内容 (最初の1000文字):`);
        log(`"${pageData.body.view.value.substring(0, 1000)}..."`);
      }
      
      if (pageData.body?.export_view?.value) {
        log(`\n📄 body.export_view.value 内容 (最初の1000文字):`);
        log(`"${pageData.body.export_view.value.substring(0, 1000)}..."`);
      }
      
      // メタデータ
      log(`\n📊 メタデータ:`);
      log(`- ラベル: ${JSON.stringify(pageData.metadata?.labels?.results || [])}`);
      
    } else {
      const errorText = await pageResponse.text();
      log(`❌ ページ取得エラー: ${pageResponse.status} ${pageResponse.statusText}`);
      log(`エラー詳細: ${errorText}`);
    }
    
    // 2. スペース内でページを検索
    log('\n🔍 スペース内でページを検索中...');
    const searchUrl = `${baseUrl}/wiki/rest/api/content`;
    const searchParams = new URLSearchParams({
      spaceKey: spaceKey || 'CLIENTTOMO',
      expand: 'body.storage,space,version,metadata.labels',
      limit: '50',
      start: '0'
    });
    
    log(`検索URL: ${searchUrl}?${searchParams}`);
    
    const searchResponse = await fetch(`${searchUrl}?${searchParams}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${username}:${apiToken}`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });
    
    log(`検索レスポンスステータス: ${searchResponse.status}`);
    
    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      
      log(`\n✅ 検索成功:`);
      log(`- 総ページ数: ${searchData.size || 0}`);
      log(`- 取得ページ数: ${searchData.results?.length || 0}`);
      
      // 指定されたページIDを検索
      const targetPage = searchData.results?.find((page: any) => page.id === '703529146');
      if (targetPage) {
        log(`\n✅ 検索でページ発見:`);
        log(`- ID: ${targetPage.id}`);
        log(`- タイトル: ${targetPage.title}`);
        log(`- スペース: ${targetPage.space?.key}`);
        log(`- コンテンツ長: ${targetPage.body?.storage?.value?.length || 0}文字`);
        
        if (targetPage.body?.storage?.value) {
          log(`- コンテンツ (最初の1000文字): "${targetPage.body.storage.value.substring(0, 1000)}..."`);
        }
      } else {
        log(`\n❌ 検索でページが見つかりませんでした`);
        
        // 類似のページIDを検索
        const similarPages = searchData.results?.filter((page: any) => 
          page.id.includes('703529') || page.id.includes('3529146')
        );
        
        if (similarPages && similarPages.length > 0) {
          log(`類似のページID:`);
          similarPages.forEach((page: any, index: number) => {
            log(`  ${index + 1}. ID: ${page.id}, タイトル: ${page.title}`);
          });
        }
      }
    } else {
      const errorText = await searchResponse.text();
      log(`❌ 検索エラー: ${searchResponse.status} ${searchResponse.statusText}`);
      log(`エラー詳細: ${errorText}`);
    }
    
    log('\n✅ 直接API呼び出し完了');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

testDirectApi().catch(console.error);
