/**
 * Confluence APIから実際にページID 703529146のコンテンツを取得
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('check-confluence-api-content.txt', message + '\n');
}

async function checkConfluenceApiContent() {
  fs.writeFileSync('check-confluence-api-content.txt', '');
  
  log('🌐 Confluence APIからページID 703529146の実際のコンテンツを取得中...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    
    // 1. Confluence APIから直接ページを取得
    log('📄 Confluence APIからページを取得中...');
    const page = await confluenceSyncService.getConfluencePageById('703529146');
    
    log(`✅ ページ取得成功:`);
    log(`- ページID: ${page.id}`);
    log(`- タイトル: ${page.title}`);
    log(`- スペース: ${page.spaceKey}`);
    log(`- URL: ${page.url}`);
    log(`- 最終更新: ${page.lastModified}`);
    
    // 2. コンテンツの詳細分析
    log(`\n📊 コンテンツ詳細分析:`);
    log(`- コンテンツ長: ${page.content?.length || 0}文字`);
    log(`- コンテンツ内容:`);
    log(`"${page.content}"`);
    
    // 3. 生のAPIレスポンスを確認
    log(`\n🔍 生のAPIレスポンスを確認中...`);
    
    const baseUrl = process.env.CONFLUENCE_BASE_URL;
    const username = process.env.CONFLUENCE_USERNAME;
    const apiToken = process.env.CONFLUENCE_API_TOKEN;
    
    if (!baseUrl || !username || !apiToken) {
      log('❌ 環境変数が設定されていません');
      return;
    }
    
    const url = `${baseUrl}/wiki/rest/api/content/703529146`;
    const params = new URLSearchParams({
      expand: 'body.storage,body.view,body.export_view,space,version,metadata.labels,metadata.properties'
    });
    
    log(`API URL: ${url}?${params}`);
    
    const response = await fetch(`${url}?${params}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${username}:${apiToken}`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      log(`❌ API エラー: ${response.status} ${response.statusText}`);
      log(`エラー詳細: ${errorText}`);
      return;
    }
    
    const data = await response.json();
    
    log(`\n📊 生のAPIレスポンス:`);
    log(`- ID: ${data.id}`);
    log(`- タイトル: ${data.title}`);
    log(`- スペース: ${data.space?.key}`);
    log(`- バージョン: ${data.version?.number}`);
    log(`- 作成日: ${data.version?.when}`);
    log(`- 作成者: ${data.version?.by?.displayName}`);
    
    // 4. ボディの詳細分析
    log(`\n📊 ボディの詳細分析:`);
    log(`- body.storage.value 長: ${data.body?.storage?.value?.length || 0}文字`);
    log(`- body.view.value 長: ${data.body?.view?.value?.length || 0}文字`);
    log(`- body.export_view.value 長: ${data.body?.export_view?.value?.length || 0}文字`);
    
    // 5. 各ボディの内容を表示
    if (data.body?.storage?.value) {
      log(`\n📄 body.storage.value 内容:`);
      log(`"${data.body.storage.value}"`);
    }
    
    if (data.body?.view?.value) {
      log(`\n📄 body.view.value 内容:`);
      log(`"${data.body.view.value}"`);
    }
    
    if (data.body?.export_view?.value) {
      log(`\n📄 body.export_view.value 内容:`);
      log(`"${data.body.export_view.value}"`);
    }
    
    // 6. メタデータの確認
    log(`\n📊 メタデータ:`);
    log(`- ラベル: ${JSON.stringify(data.metadata?.labels?.results || [])}`);
    log(`- プロパティ: ${JSON.stringify(data.metadata?.properties || {})}`);
    
    // 7. ページの種類を確認
    log(`\n📊 ページ情報:`);
    log(`- タイプ: ${data.type}`);
    log(`- ステータス: ${data.status}`);
    log(`- アンカー: ${data.ancestors?.length || 0}個`);
    
    if (data.ancestors && data.ancestors.length > 0) {
      log(`- 親ページ:`);
      data.ancestors.forEach((ancestor: any, index: number) => {
        log(`  ${index + 1}. ${ancestor.title} (ID: ${ancestor.id})`);
      });
    }
    
    // 8. 子ページの確認
    log(`\n📊 子ページの確認:`);
    const childUrl = `${baseUrl}/wiki/rest/api/content/703529146/child/page`;
    const childResponse = await fetch(childUrl, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${username}:${apiToken}`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (childResponse.ok) {
      const childData = await childResponse.json();
      log(`- 子ページ数: ${childData.results?.length || 0}`);
      if (childData.results && childData.results.length > 0) {
        childData.results.forEach((child: any, index: number) => {
          log(`  ${index + 1}. ${child.title} (ID: ${child.id})`);
        });
      }
    } else {
      log(`- 子ページ取得エラー: ${childResponse.status}`);
    }
    
    // 9. 結論
    log(`\n🎯 結論:`);
    if (data.body?.storage?.value && data.body.storage.value.length > 26) {
      log(`✅ 実際のコンテンツは26文字より長いです`);
      log(`- 実際の長さ: ${data.body.storage.value.length}文字`);
      log(`- 取得された長さ: ${page.content?.length || 0}文字`);
      log(`⚠️ コンテンツの取得に問題がある可能性があります`);
    } else {
      log(`✅ 実際のコンテンツも26文字程度です`);
      log(`- これは正常な動作です`);
    }
    
    log('\n✅ Confluence APIコンテンツ確認完了');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

checkConfluenceApiContent().catch(console.error);
