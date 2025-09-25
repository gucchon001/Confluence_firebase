/**
 * 実際のAPIレスポンスを確認して仕様書を検証
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('test-actual-api-response.txt', message + '\n');
}

async function testActualApiResponse() {
  fs.writeFileSync('test-actual-api-response.txt', '');
  
  log('🔍 実際のAPIレスポンスを確認して仕様書を検証中...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    
    // 1. 直接APIを叩いて生のレスポンスを確認
    log('📡 直接APIを叩いて生のレスポンスを確認中...');
    
    const baseUrl = process.env.CONFLUENCE_BASE_URL;
    const username = process.env.CONFLUENCE_USER_EMAIL;
    const apiToken = process.env.CONFLUENCE_API_TOKEN;
    const spaceKey = process.env.CONFLUENCE_SPACE_KEY;
    
    const url = `${baseUrl}/wiki/rest/api/content`;
    const params = new URLSearchParams({
      spaceKey: spaceKey || 'CLIENTTOMO',
      expand: 'body.storage,space,version,metadata.labels',
      limit: '1',
      start: '0'
    });
    
    log(`URL: ${url}?${params}`);
    
    const response = await fetch(`${url}?${params}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${username}:${apiToken}`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      log(`❌ APIエラー: ${response.status} ${response.statusText}`);
      return;
    }
    
    const data = await response.json();
    log(`✅ APIレスポンス取得成功`);
    log(`- 取得ページ数: ${data.results?.length || 0}`);
    
    if (data.results && data.results.length > 0) {
      const item = data.results[0];
      
      log(`\n📄 生のAPIレスポンス構造:`);
      log(`- id: ${item.id} (型: ${typeof item.id})`);
      log(`- title: ${item.title} (型: ${typeof item.title})`);
      log(`- space: ${JSON.stringify(item.space)}`);
      log(`- version: ${JSON.stringify(item.version)}`);
      log(`- metadata: ${JSON.stringify(item.metadata)}`);
      log(`- body: ${JSON.stringify(item.body)}`);
      
      // 各フィールドの詳細確認
      log(`\n🔍 フィールド詳細確認:`);
      
      // body構造
      log(`\n📝 body構造:`);
      log(`- body: ${item.body ? '存在' : 'null'}`);
      log(`- body.storage: ${item.body?.storage ? '存在' : 'null'}`);
      log(`- body.storage.value: ${item.body?.storage?.value ? '存在' : 'null'}`);
      if (item.body?.storage?.value) {
        log(`- body.storage.value長: ${item.body.storage.value.length}文字`);
        log(`- body.storage.valueプレビュー: "${item.body.storage.value.substring(0, 200)}..."`);
      }
      
      // space構造
      log(`\n🏢 space構造:`);
      log(`- space: ${item.space ? '存在' : 'null'}`);
      log(`- space.key: ${item.space?.key || 'null'}`);
      log(`- space.name: ${item.space?.name || 'null'}`);
      
      // version構造
      log(`\n📅 version構造:`);
      log(`- version: ${item.version ? '存在' : 'null'}`);
      log(`- version.when: ${item.version?.when || 'null'}`);
      log(`- version.number: ${item.version?.number || 'null'}`);
      
      // metadata構造
      log(`\n🏷️ metadata構造:`);
      log(`- metadata: ${item.metadata ? '存在' : 'null'}`);
      log(`- metadata.labels: ${item.metadata?.labels ? '存在' : 'null'}`);
      if (item.metadata?.labels) {
        log(`- metadata.labels.results: ${item.metadata.labels.results ? '存在' : 'null'}`);
        if (item.metadata.labels.results) {
          log(`- metadata.labels.results長: ${item.metadata.labels.results.length}`);
          log(`- metadata.labels.results内容: ${JSON.stringify(item.metadata.labels.results)}`);
        }
      }
      
      // 2. 現在のマッピングロジックをテスト
      log(`\n🔄 現在のマッピングロジックをテスト中...`);
      
      const mappedPage = {
        id: item.id,
        title: item.title,
        content: item.body?.storage?.value || '',
        lastModified: item.version?.when || new Date().toISOString(),
        spaceKey: item.space?.key || '',
        url: `${baseUrl}/wiki/spaces/${item.space?.key}/pages/${item.id}`,
        metadata: {
          labels: item.metadata?.labels || { results: [] }
        }
      };
      
      log(`- マッピング結果:`);
      log(`  - id: ${mappedPage.id}`);
      log(`  - title: ${mappedPage.title}`);
      log(`  - content長: ${mappedPage.content.length}文字`);
      log(`  - lastModified: ${mappedPage.lastModified}`);
      log(`  - spaceKey: ${mappedPage.spaceKey}`);
      log(`  - url: ${mappedPage.url}`);
      log(`  - labels: ${JSON.stringify(mappedPage.metadata.labels)}`);
      
      // 3. チャンク分割をテスト
      log(`\n📝 チャンク分割をテスト中...`);
      
      const chunks = confluenceSyncService.splitPageIntoChunks(mappedPage);
      log(`- 分割されたチャンク数: ${chunks.length}`);
      
      chunks.forEach((chunk, index) => {
        log(`- チャンク ${index + 1}:`);
        log(`  - サイズ: ${chunk.content?.length || 0}文字`);
        log(`  - インデックス: ${chunk.chunkIndex}`);
        log(`  - スペース: ${chunk.spaceKey}`);
        log(`  - 最終更新: ${chunk.lastUpdated}`);
      });
      
      // 4. 仕様書との照合
      log(`\n📋 仕様書との照合:`);
      
      // コンテンツ取得
      const contentFromBody = item.body?.storage?.value || '';
      const contentFromMapped = mappedPage.content;
      log(`- コンテンツ取得方法:`);
      log(`  - body.storage.value: ${contentFromBody.length}文字`);
      log(`  - マッピング後: ${contentFromMapped.length}文字`);
      log(`  - 一致: ${contentFromBody === contentFromMapped ? '✅' : '❌'}`);
      
      // スペースキー取得
      const spaceFromItem = item.space?.key || '';
      const spaceFromMapped = mappedPage.spaceKey;
      log(`- スペースキー取得方法:`);
      log(`  - space.key: ${spaceFromItem}`);
      log(`  - マッピング後: ${spaceFromMapped}`);
      log(`  - 一致: ${spaceFromItem === spaceFromMapped ? '✅' : '❌'}`);
      
      // 更新日時取得
      const versionFromItem = item.version?.when || '';
      const versionFromMapped = mappedPage.lastModified;
      log(`- 更新日時取得方法:`);
      log(`  - version.when: ${versionFromItem}`);
      log(`  - マッピング後: ${versionFromMapped}`);
      log(`  - 一致: ${versionFromItem === versionFromMapped ? '✅' : '❌'}`);
      
      // ラベル取得
      const labelsFromItem = item.metadata?.labels?.results || [];
      const labelsFromMapped = mappedPage.metadata.labels.results || [];
      log(`- ラベル取得方法:`);
      log(`  - metadata.labels.results: ${JSON.stringify(labelsFromItem)}`);
      log(`  - マッピング後: ${JSON.stringify(labelsFromMapped)}`);
      log(`  - 一致: ${JSON.stringify(labelsFromItem) === JSON.stringify(labelsFromMapped) ? '✅' : '❌'}`);
      
    } else {
      log(`❌ ページが取得できませんでした`);
    }
    
    log('\n✅ APIレスポンス確認完了');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

testActualApiResponse().catch(console.error);
