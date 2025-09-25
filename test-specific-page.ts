/**
 * 特定のページID (721125561) でテストを実行
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import * as fs from 'fs';

async function testSpecificPage() {
  const logMessages: string[] = [];
  
  function log(message: string) {
    console.log(message);
    logMessages.push(message);
  }

  log('🚀 特定ページID (640450787) テストを開始...\n');

  try {
    // 環境変数の確認
    log('🔍 環境変数の確認:');
    const requiredEnvVars = [
      'CONFLUENCE_BASE_URL',
      'CONFLUENCE_USER_EMAIL', 
      'CONFLUENCE_SPACE_KEY',
      'CONFLUENCE_API_TOKEN'
    ];

    let allEnvVarsSet = true;
    requiredEnvVars.forEach(envVar => {
      if (process.env[envVar]) {
        log(`✅ ${envVar}: ${envVar.includes('TOKEN') ? '***設定済み***' : process.env[envVar]}`);
      } else {
        log(`❌ ${envVar}: 設定されていません`);
        allEnvVarsSet = false;
      }
    });

    if (!allEnvVarsSet) {
      log('\n❌ 必要な環境変数が設定されていません。.envファイルを確認してください。');
      process.exit(1);
    }

    log('\n🔧 ConfluenceSyncServiceインスタンスを作成中...');
    const confluenceSyncService = new ConfluenceSyncService();
    log('✅ インスタンス作成完了');

    log('\n📄 利用可能なページを取得中...');
    const pages = await confluenceSyncService.getConfluencePages(1, 0);
    
    if (!pages || pages.length === 0) {
      log('❌ ページが見つかりませんでした');
      return;
    }
    
    const page = pages[0];
    log(`✅ 最初のページを取得: ${page.title} (ID: ${page.id})`);
    log(`📝 コンテンツ長: ${page.content.length}文字`);
    log(`🏷️ ラベル数: ${page.metadata?.labels?.results?.length || 0}`);
    log(`🔍 ページIDの型: ${typeof page.id}`);
    log(`🔍 ページIDの値: ${page.id}`);
    
    if (page.metadata?.labels?.results?.length > 0) {
      const labels = page.metadata.labels.results.map(label => label.name);
      log(`🏷️ ラベル一覧: ${labels.join(', ')}`);
    }

    log('\n🔄 ページ同期を実行中...');
    log(`🔍 同期前のページ配列: ${JSON.stringify([page].map(p => ({ id: p.id, title: p.title })))}`);
    
    try {
      const syncResult = await confluenceSyncService.syncPages([page]);
      log('✅ 同期処理完了');
      
      log('\n📈 同期結果:');
      log(`  追加: ${syncResult.added}ページ`);
      log(`  更新: ${syncResult.updated}ページ`);
      log(`  変更なし: ${syncResult.unchanged}ページ`);
      log(`  エラー: ${syncResult.errors.length}件`);

      if (syncResult.errors.length > 0) {
        log('\n❌ エラー詳細:');
        syncResult.errors.forEach(error => log(`  - ${error}`));
      }
    } catch (syncError) {
      log(`❌ 同期処理でエラーが発生: ${syncError}`);
      log(`エラー詳細: ${(syncError as Error).stack}`);
      throw syncError;
    }

    log('\n✅ テスト完了！');
    
    // 結果をファイルに保存
    fs.writeFileSync('test-result.txt', logMessages.join('\n'));
    log('\n📁 結果をtest-result.txtに保存しました');

  } catch (error) {
    log('\n❌ テスト実行エラー: ' + error);
    log('エラー詳細: ' + (error as Error).stack);
    
    // エラーもファイルに保存
    fs.writeFileSync('test-result.txt', logMessages.join('\n'));
    log('\n📁 エラー結果をtest-result.txtに保存しました');
    
    process.exit(1);
  }
}

testSpecificPage().catch(console.error);
