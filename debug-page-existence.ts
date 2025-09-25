/**
 * ページID 703529146の存在確認とデバッグ
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('debug-page-existence.txt', message + '\n');
}

async function debugPageExistence() {
  fs.writeFileSync('debug-page-existence.txt', '');
  
  log('🔍 ページID 703529146の存在確認とデバッグ中...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    
    // 1. LanceDBから該当ページを確認
    log('📊 LanceDBから該当ページを確認中...');
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    
    const targetPageId = 703529146;
    const targetChunks = allChunks.filter((chunk: any) => chunk.pageId === targetPageId);
    
    log(`LanceDB内の該当ページ:`);
    log(`- 見つかったチャンク数: ${targetChunks.length}`);
    
    if (targetChunks.length > 0) {
      const chunk = targetChunks[0];
      log(`- タイトル: ${chunk.title}`);
      log(`- コンテンツ: "${chunk.content}"`);
      log(`- コンテンツ長: ${chunk.content?.length || 0}文字`);
      log(`- 最終更新: ${chunk.lastUpdated}`);
      log(`- スペース: ${chunk.space_key}`);
      log(`- URL: ${chunk.url}`);
    }
    
    // 2. Confluence APIで直接確認
    log('\n🌐 Confluence APIで直接確認中...');
    
    const baseUrl = process.env.CONFLUENCE_BASE_URL;
    const username = process.env.CONFLUENCE_USERNAME;
    const apiToken = process.env.CONFLUENCE_API_TOKEN;
    const spaceKey = process.env.CONFLUENCE_SPACE_KEY;
    
    if (!baseUrl || !username || !apiToken || !spaceKey) {
      log('❌ 環境変数が設定されていません');
      return;
    }
    
    log(`設定情報:`);
    log(`- Base URL: ${baseUrl}`);
    log(`- Username: ${username}`);
    log(`- Space Key: ${spaceKey}`);
    
    // 3. ページIDで直接取得を試行
    log('\n📄 ページIDで直接取得を試行中...');
    const directUrl = `${baseUrl}/wiki/rest/api/content/${targetPageId}`;
    const directParams = new URLSearchParams({
      expand: 'body.storage,body.view,space,version,metadata.labels'
    });
    
    log(`直接取得URL: ${directUrl}?${directParams}`);
    
    try {
      const directResponse = await fetch(`${directUrl}?${directParams}`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${username}:${apiToken}`).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      });
      
      log(`レスポンスステータス: ${directResponse.status}`);
      log(`レスポンスOK: ${directResponse.ok}`);
      
      if (directResponse.ok) {
        const directData = await directResponse.json();
        log(`✅ 直接取得成功:`);
        log(`- ID: ${directData.id}`);
        log(`- タイトル: ${directData.title}`);
        log(`- スペース: ${directData.space?.key}`);
        log(`- コンテンツ長: ${directData.body?.storage?.value?.length || 0}文字`);
        log(`- コンテンツ: "${directData.body?.storage?.value || ''}"`);
      } else {
        const errorText = await directResponse.text();
        log(`❌ 直接取得エラー: ${errorText}`);
      }
    } catch (error) {
      log(`❌ 直接取得例外: ${error}`);
    }
    
    // 4. スペース内でページを検索
    log('\n🔍 スペース内でページを検索中...');
    const searchUrl = `${baseUrl}/wiki/rest/api/content`;
    const searchParams = new URLSearchParams({
      spaceKey: spaceKey,
      expand: 'body.storage,space,version,metadata.labels',
      limit: '100',
      start: '0'
    });
    
    log(`検索URL: ${searchUrl}?${searchParams}`);
    
    try {
      const searchResponse = await fetch(`${searchUrl}?${searchParams}`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${username}:${apiToken}`).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      });
      
      log(`検索レスポンスステータス: ${searchResponse.status}`);
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        log(`検索結果:`);
        log(`- 総ページ数: ${searchData.size || 0}`);
        log(`- 取得ページ数: ${searchData.results?.length || 0}`);
        
        // 指定されたページIDを検索
        const foundPage = searchData.results?.find((page: any) => page.id === targetPageId.toString());
        if (foundPage) {
          log(`✅ 検索でページ発見:`);
          log(`- ID: ${foundPage.id}`);
          log(`- タイトル: ${foundPage.title}`);
          log(`- コンテンツ長: ${foundPage.body?.storage?.value?.length || 0}文字`);
          log(`- コンテンツ: "${foundPage.body?.storage?.value || ''}"`);
        } else {
          log(`❌ 検索でページが見つかりませんでした`);
          
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
        log(`❌ 検索エラー: ${errorText}`);
      }
    } catch (error) {
      log(`❌ 検索例外: ${error}`);
    }
    
    // 5. ページIDの形式を確認
    log('\n📊 ページIDの形式を確認中...');
    log(`- 指定PageID: ${targetPageId}`);
    log(`- 文字列形式: "${targetPageId.toString()}"`);
    log(`- 数値形式: ${Number(targetPageId)}`);
    
    // 6. LanceDB内のページID範囲を再確認
    log('\n📊 LanceDB内のページID範囲を再確認中...');
    const pageIds = allChunks.map((chunk: any) => chunk.pageId).sort((a, b) => a - b);
    const minPageId = Math.min(...pageIds);
    const maxPageId = Math.max(...pageIds);
    
    log(`- 最小PageID: ${minPageId}`);
    log(`- 最大PageID: ${maxPageId}`);
    log(`- 指定PageID: ${targetPageId}`);
    log(`- 範囲内: ${targetPageId >= minPageId && targetPageId <= maxPageId ? 'Yes' : 'No'}`);
    
    // 7. 結論
    log('\n🎯 結論:');
    if (targetChunks.length > 0) {
      log(`✅ LanceDBにはページID ${targetPageId} が存在します`);
      log(`- タイトル: ${targetChunks[0].title}`);
      log(`- コンテンツ: "${targetChunks[0].content}"`);
      log(`- コンテンツ長: ${targetChunks[0].content?.length || 0}文字`);
      log(`⚠️ このページは過去に取得されたが、現在はConfluence APIでアクセスできない可能性があります`);
    } else {
      log(`❌ LanceDBにもページID ${targetPageId} は存在しません`);
    }
    
    log('\n✅ ページ存在確認完了');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

debugPageExistence().catch(console.error);
