/**
 * Confluence APIの応答形式を詳細に調査
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('debug-confluence-api-response.txt', message + '\n');
}

async function debugConfluenceApiResponse() {
  // 結果ファイルをクリア
  fs.writeFileSync('debug-confluence-api-response.txt', '');
  
  log('🔍 Confluence APIの応答形式を詳細に調査...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();

    // 1. ページを取得
    log('📄 ページを取得中...');
    const pages = await confluenceSyncService.getConfluencePages(1, 0);
    
    if (pages.length === 0) {
      log('❌ ページが見つかりませんでした');
      return;
    }

    const page = pages[0];
    log(`\n🧪 テストページ: ${page.title} (ID: ${page.id})`);
    
    // 2. ページオブジェクトの全体構造を確認
    log('\n📊 ページオブジェクトの全体構造:');
    log(`  page: ${JSON.stringify(page, null, 2)}`);
    
    // 3. 各プロパティを詳細に確認
    log('\n🔍 各プロパティの詳細:');
    log(`  page.id: ${page.id} (型: ${typeof page.id})`);
    log(`  page.title: ${page.title} (型: ${typeof page.title})`);
    log(`  page.version: ${JSON.stringify(page.version, null, 2)}`);
    log(`  page.body: ${JSON.stringify(page.body, null, 2)}`);
    log(`  page.metadata: ${JSON.stringify(page.metadata, null, 2)}`);
    log(`  page.space: ${JSON.stringify(page.space, null, 2)}`);
    
    // 4. 更新日時の可能性のあるプロパティを確認
    log('\n🔍 更新日時の可能性のあるプロパティ:');
    log(`  page.version?.when: ${page.version?.when}`);
    log(`  page.version?.number: ${page.version?.number}`);
    log(`  page.version?.friendlyWhen: ${page.version?.friendlyWhen}`);
    log(`  page.lastModified: ${page.lastModified}`);
    log(`  page.created: ${page.created}`);
    log(`  page.updated: ${page.updated}`);
    
    // 5. 日時関連のプロパティを全て確認
    log('\n🔍 日時関連のプロパティを全て確認:');
    const dateProperties = ['when', 'number', 'friendlyWhen', 'lastModified', 'created', 'updated', 'modified', 'date'];
    
    for (const prop of dateProperties) {
      if (page[prop]) {
        log(`  page.${prop}: ${page[prop]} (型: ${typeof page[prop]})`);
      }
      if (page.version && page.version[prop]) {
        log(`  page.version.${prop}: ${page.version[prop]} (型: ${typeof page.version[prop]})`);
      }
      if (page.metadata && page.metadata[prop]) {
        log(`  page.metadata.${prop}: ${page.metadata[prop]} (型: ${typeof page.metadata[prop]})`);
      }
    }
    
    // 6. 同期ロジックでの更新日時取得を確認
    log('\n🔍 同期ロジックでの更新日時取得:');
    const confluenceLastModified = page.version?.when || new Date().toISOString();
    log(`  confluenceLastModified: ${confluenceLastModified}`);
    log(`  confluenceLastModified の型: ${typeof confluenceLastModified}`);
    
    // 7. 日時オブジェクトとして変換
    const confluenceDate = new Date(confluenceLastModified);
    log(`  confluenceDate: ${confluenceDate.toISOString()}`);
    log(`  confluenceDate の型: ${typeof confluenceDate}`);
    log(`  confluenceDate のタイムスタンプ: ${confluenceDate.getTime()}`);

    log('\n✅ Confluence APIの応答形式調査完了！');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

debugConfluenceApiResponse().catch(console.error);
