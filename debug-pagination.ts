/**
 * Confluence APIのページネーション問題をデバッグ
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('debug-pagination.txt', message + '\n');
}

async function debugPagination() {
  fs.writeFileSync('debug-pagination.txt', '');
  
  log('🔍 Confluence APIのページネーション問題をデバッグ中...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    
    // 1. 最初のページを取得してレスポンス構造を確認
    log('📄 最初のページを取得中...');
    const firstPage = await confluenceSyncService.getConfluencePages(1, 0);
    log(`取得したページ数: ${firstPage.length}`);
    
    // 2. 10ページ取得を試行
    log('\n📄 10ページ取得を試行中...');
    const tenPages = await confluenceSyncService.getConfluencePages(10, 0);
    log(`取得したページ数: ${tenPages.length}`);
    
    // 3. 50ページ取得を試行
    log('\n📄 50ページ取得を試行中...');
    const fiftyPages = await confluenceSyncService.getConfluencePages(50, 0);
    log(`取得したページ数: ${fiftyPages.length}`);
    
    // 4. 100ページ取得を試行
    log('\n📄 100ページ取得を試行中...');
    const hundredPages = await confluenceSyncService.getConfluencePages(100, 0);
    log(`取得したページ数: ${hundredPages.length}`);
    
    // 5. 200ページ取得を試行
    log('\n📄 200ページ取得を試行中...');
    const twoHundredPages = await confluenceSyncService.getConfluencePages(200, 0);
    log(`取得したページ数: ${twoHundredPages.length}`);
    
    // 6. ページネーションを試行（start=100で50ページ取得）
    log('\n📄 ページネーション試行（start=100, limit=50）...');
    const paginatedPages = await confluenceSyncService.getConfluencePages(50, 100);
    log(`取得したページ数: ${paginatedPages.length}`);
    
    // 7. さらにページネーション（start=200で50ページ取得）
    log('\n📄 ページネーション試行（start=200, limit=50）...');
    const morePaginatedPages = await confluenceSyncService.getConfluencePages(50, 200);
    log(`取得したページ数: ${morePaginatedPages.length}`);
    
    // 8. 手動でConfluence APIを直接呼び出してレスポンス構造を確認
    log('\n🔍 手動でConfluence APIを直接呼び出し中...');
    
    const baseUrl = process.env.CONFLUENCE_BASE_URL;
    const username = process.env.CONFLUENCE_USERNAME;
    const apiToken = process.env.CONFLUENCE_API_TOKEN;
    const spaceKey = process.env.CONFLUENCE_SPACE_KEY;
    
    if (!baseUrl || !username || !apiToken || !spaceKey) {
      log('❌ 環境変数が設定されていません');
      return;
    }
    
    const url = `${baseUrl}/wiki/rest/api/content`;
    const params = new URLSearchParams({
      spaceKey: spaceKey,
      expand: 'body.storage,space,version,metadata.labels',
      limit: '100',
      start: '0'
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
    log(`\n📊 API レスポンス構造:`);
    log(`- results.length: ${data.results?.length || 0}`);
    log(`- size: ${data.size || 'N/A'}`);
    log(`- limit: ${data.limit || 'N/A'}`);
    log(`- start: ${data.start || 'N/A'}`);
    log(`- _links: ${JSON.stringify(data._links || {}, null, 2)}`);
    
    // 9. ページネーション情報を確認
    if (data._links) {
      log(`\n🔗 ページネーション情報:`);
      log(`- next: ${data._links.next || 'N/A'}`);
      log(`- prev: ${data._links.prev || 'N/A'}`);
      log(`- self: ${data._links.self || 'N/A'}`);
    }
    
    // 10. 総ページ数を確認
    if (data.size) {
      log(`\n📊 総ページ数: ${data.size}`);
      log(`現在の取得数: ${data.results?.length || 0}`);
      log(`残りページ数: ${data.size - (data.results?.length || 0)}`);
    }
    
    log('\n✅ ページネーションデバッグ完了');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

debugPagination().catch(console.error);
