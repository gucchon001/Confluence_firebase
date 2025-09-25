/**
 * 大規模データ同期テスト
 * 20ページ、50ページ、100ページと段階的にテスト
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import { HybridSearchEngine } from './src/lib/hybrid-search-engine';

async function testLargeScaleSync() {
  console.log('🚀 大規模データ同期テストを開始...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    const searchEngine = new HybridSearchEngine();

    // テストケース: 20ページ
    console.log('📊 テストケース1: 20ページの同期');
    console.log('=' .repeat(50));
    
    const startTime20 = Date.now();
    const pages20 = await confluenceSyncService.getConfluencePages(20, 0);
    console.log(`📄 取得したページ数: ${pages20.length}`);
    
    const syncResult20 = await confluenceSyncService.syncPages(pages20);
    const endTime20 = Date.now();
    
    console.log(`⏱️ 20ページ同期時間: ${endTime20 - startTime20}ms`);
    console.log(`📈 同期結果: 追加=${syncResult20.added}, 更新=${syncResult20.updated}, エラー=${syncResult20.errors}`);
    
    // 20ページでの検索テスト
    console.log('\n🔍 20ページでの検索テスト...');
    const searchStart20 = Date.now();
    const searchResults20 = await searchEngine.search({ 
      query: '機能要件 システム', 
      topK: 5 
    });
    const searchEnd20 = Date.now();
    
    console.log(`📊 検索結果: ${searchResults20.length}件 (${searchEnd20 - searchStart20}ms)`);
    searchResults20.slice(0, 3).forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title}`);
    });

    // テストケース: 50ページ
    console.log('\n📊 テストケース2: 50ページの同期');
    console.log('=' .repeat(50));
    
    const startTime50 = Date.now();
    const pages50 = await confluenceSyncService.getConfluencePages(50, 0);
    console.log(`📄 取得したページ数: ${pages50.length}`);
    
    const syncResult50 = await confluenceSyncService.syncPages(pages50);
    const endTime50 = Date.now();
    
    console.log(`⏱️ 50ページ同期時間: ${endTime50 - startTime50}ms`);
    console.log(`📈 同期結果: 追加=${syncResult50.added}, 更新=${syncResult50.updated}, エラー=${syncResult50.errors}`);
    
    // 50ページでの検索テスト
    console.log('\n🔍 50ページでの検索テスト...');
    const searchStart50 = Date.now();
    const searchResults50 = await searchEngine.search({ 
      query: 'データベース 管理', 
      topK: 5 
    });
    const searchEnd50 = Date.now();
    
    console.log(`📊 検索結果: ${searchResults50.length}件 (${searchEnd50 - searchStart50}ms)`);
    searchResults50.slice(0, 3).forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title}`);
    });

    // テストケース: 100ページ
    console.log('\n📊 テストケース3: 100ページの同期');
    console.log('=' .repeat(50));
    
    const startTime100 = Date.now();
    const pages100 = await confluenceSyncService.getConfluencePages(100, 0);
    console.log(`📄 取得したページ数: ${pages100.length}`);
    
    const syncResult100 = await confluenceSyncService.syncPages(pages100);
    const endTime100 = Date.now();
    
    console.log(`⏱️ 100ページ同期時間: ${endTime100 - startTime100}ms`);
    console.log(`📈 同期結果: 追加=${syncResult100.added}, 更新=${syncResult100.updated}, エラー=${syncResult100.errors}`);
    
    // 100ページでの検索テスト
    console.log('\n🔍 100ページでの検索テスト...');
    const searchStart100 = Date.now();
    const searchResults100 = await searchEngine.search({ 
      query: 'セキュリティ 認証', 
      topK: 5 
    });
    const searchEnd100 = Date.now();
    
    console.log(`📊 検索結果: ${searchResults100.length}件 (${searchEnd100 - searchStart100}ms)`);
    searchResults100.slice(0, 3).forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title}`);
    });

    // パフォーマンス分析
    console.log('\n📈 パフォーマンス分析');
    console.log('=' .repeat(50));
    console.log(`20ページ同期: ${endTime20 - startTime20}ms (${Math.round((endTime20 - startTime20) / 20)}ms/ページ)`);
    console.log(`50ページ同期: ${endTime50 - startTime50}ms (${Math.round((endTime50 - startTime50) / 50)}ms/ページ)`);
    console.log(`100ページ同期: ${endTime100 - startTime100}ms (${Math.round((endTime100 - startTime100) / 100)}ms/ページ)`);
    console.log(`20ページ検索: ${searchEnd20 - searchStart20}ms`);
    console.log(`50ページ検索: ${searchEnd50 - searchStart50}ms`);
    console.log(`100ページ検索: ${searchEnd100 - searchStart100}ms`);

    // 総合評価
    console.log('\n🎯 総合評価');
    console.log('=' .repeat(50));
    const totalPages = syncResult20.added + syncResult50.added + syncResult100.added;
    const totalTime = (endTime20 - startTime20) + (endTime50 - startTime50) + (endTime100 - startTime100);
    console.log(`総ページ数: ${totalPages}ページ`);
    console.log(`総同期時間: ${totalTime}ms`);
    console.log(`平均同期時間: ${Math.round(totalTime / totalPages)}ms/ページ`);
    console.log(`同期成功率: ${Math.round((totalPages - syncResult20.errors - syncResult50.errors - syncResult100.errors) / totalPages * 100)}%`);

    console.log('\n✅ 大規模データ同期テスト完了！');

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

testLargeScaleSync().catch(console.error);
