/**
 * コンテンツ抽出ロジックのデバッグ
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('debug-content-extraction.txt', message + '\n');
}

async function debugContentExtraction() {
  fs.writeFileSync('debug-content-extraction.txt', '');
  
  log('🔍 コンテンツ抽出ロジックのデバッグ中...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    
    // 1. 現在のgetConfluencePageByIdメソッドを確認
    log('📄 getConfluencePageByIdメソッドの動作確認中...');
    
    try {
      const page = await confluenceSyncService.getConfluencePageById('703529146');
      log(`取得結果:`);
      log(`- ID: ${page?.id || 'null'}`);
      log(`- タイトル: ${page?.title || 'null'}`);
      log(`- コンテンツ長: ${page?.content?.length || 0}文字`);
      log(`- コンテンツ: "${page?.content || 'null'}"`);
      log(`- スペース: ${page?.spaceKey || 'null'}`);
      log(`- URL: ${page?.url || 'null'}`);
    } catch (error) {
      log(`❌ getConfluencePageByIdエラー: ${error}`);
    }
    
    // 2. 生のAPIレスポンスを直接確認
    log('\n🌐 生のAPIレスポンスを直接確認中...');
    
    const baseUrl = process.env.CONFLUENCE_BASE_URL;
    const username = process.env.CONFLUENCE_USERNAME;
    const apiToken = process.env.CONFLUENCE_API_TOKEN;
    
    if (!baseUrl || !username || !apiToken) {
      log('❌ 環境変数が設定されていません');
      log('環境変数を確認してください:');
      log('- CONFLUENCE_BASE_URL');
      log('- CONFLUENCE_USERNAME');
      log('- CONFLUENCE_API_TOKEN');
      return;
    }
    
    const url = `${baseUrl}/wiki/rest/api/content/703529146`;
    const params = new URLSearchParams({
      expand: 'body.storage,body.view,body.export_view,space,version,metadata.labels'
    });
    
    log(`API URL: ${url}?${params}`);
    
    try {
      const response = await fetch(`${url}?${params}`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${username}:${apiToken}`).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      });
      
      log(`レスポンスステータス: ${response.status}`);
      log(`レスポンスOK: ${response.ok}`);
      
      if (response.ok) {
        const data = await response.json();
        
        log(`\n📊 生のAPIレスポンス詳細:`);
        log(`- ID: ${data.id}`);
        log(`- タイトル: ${data.title}`);
        log(`- スペース: ${data.space?.key}`);
        log(`- バージョン: ${data.version?.number}`);
        
        // ボディの詳細分析
        log(`\n📊 ボディ分析:`);
        log(`- body.storage.value 存在: ${!!data.body?.storage?.value}`);
        log(`- body.storage.value 長: ${data.body?.storage?.value?.length || 0}文字`);
        log(`- body.view.value 存在: ${!!data.body?.view?.value}`);
        log(`- body.view.value 長: ${data.body?.view?.value?.length || 0}文字`);
        log(`- body.export_view.value 存在: ${!!data.body?.export_view?.value}`);
        log(`- body.export_view.value 長: ${data.body?.export_view?.value?.length || 0}文字`);
        
        // 各ボディの内容を表示（最初の500文字）
        if (data.body?.storage?.value) {
          log(`\n📄 body.storage.value 内容 (最初の500文字):`);
          log(`"${data.body.storage.value.substring(0, 500)}..."`);
        }
        
        if (data.body?.view?.value) {
          log(`\n📄 body.view.value 内容 (最初の500文字):`);
          log(`"${data.body.view.value.substring(0, 500)}..."`);
        }
        
        if (data.body?.export_view?.value) {
          log(`\n📄 body.export_view.value 内容 (最初の500文字):`);
          log(`"${data.body.export_view.value.substring(0, 500)}..."`);
        }
        
        // 3. 現在のgetConfluencePageByIdメソッドの実装を確認
        log(`\n🔍 現在のgetConfluencePageByIdメソッドの実装確認:`);
        log(`- 使用しているexpand: 'body.storage,version,metadata.labels,space'`);
        log(`- コンテンツ抽出: item.body?.storage?.value || ''`);
        
        // 4. 問題の特定
        log(`\n🎯 問題の特定:`);
        if (data.body?.storage?.value && data.body.storage.value.length > 26) {
          log(`✅ body.storage.value には実際のコンテンツが存在します (${data.body.storage.value.length}文字)`);
          log(`❌ しかし、getConfluencePageByIdでは26文字しか取得できていません`);
          log(`🔍 原因: コンテンツ抽出ロジックに問題があります`);
        } else if (data.body?.view?.value && data.body.view.value.length > 26) {
          log(`✅ body.view.value には実際のコンテンツが存在します (${data.body.view.value.length}文字)`);
          log(`❌ しかし、getConfluencePageByIdでは26文字しか取得できていません`);
          log(`🔍 原因: 間違ったボディフィールドを参照しています`);
        } else if (data.body?.export_view?.value && data.body.export_view.value.length > 26) {
          log(`✅ body.export_view.value には実際のコンテンツが存在します (${data.body.export_view.value.length}文字)`);
          log(`❌ しかし、getConfluencePageByIdでは26文字しか取得できていません`);
          log(`🔍 原因: 間違ったボディフィールドを参照しています`);
        } else {
          log(`❌ どのボディフィールドにも実際のコンテンツが見つかりません`);
          log(`🔍 原因: APIのexpandパラメータが不十分か、ページの構造が異なります`);
        }
        
      } else {
        const errorText = await response.text();
        log(`❌ API エラー: ${response.status} ${response.statusText}`);
        log(`エラー詳細: ${errorText}`);
      }
    } catch (error) {
      log(`❌ API呼び出し例外: ${error}`);
    }
    
    // 5. 修正案
    log(`\n🔧 修正案:`);
    log(`1. expandパラメータを拡張: 'body.storage,body.view,body.export_view,space,version,metadata.labels'`);
    log(`2. コンテンツ抽出ロジックを改善:`);
    log(`   - まず body.storage.value を試行`);
    log(`   - なければ body.view.value を試行`);
    log(`   - それでもなければ body.export_view.value を試行`);
    log(`3. デバッグログを追加してどのフィールドが使用されているかを確認`);
    
    log('\n✅ コンテンツ抽出ロジックデバッグ完了');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

debugContentExtraction().catch(console.error);
