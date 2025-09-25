/**
 * 小さいデータでの同期テスト（20ページ）
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import { searchLanceDB } from './src/lib/lancedb-search-client';

function log(message: string) {
  console.log(message);
}

async function testSmallSync() {
  log('🚀 小さいデータでの同期テストを開始...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    
    // 1. 既存データの削除
    log('🗑️ 既存データを削除中...');
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    const dummyVector = new Array(768).fill(0);
    const existingChunks = await table.search(dummyVector).limit(10000).toArray();
    
    if (existingChunks.length > 0) {
      const idsToDelete = existingChunks.map((chunk: any) => chunk.id);
      await table.delete(`id IN (${idsToDelete.map(id => `'${id}'`).join(', ')})`);
      log(`✅ ${existingChunks.length}チャンクを削除しました`);
    } else {
      log('✅ 削除するデータはありません');
    }
    
    // 2. 20ページの同期実行
    log('\n📥 20ページの同期を実行中...');
    const syncResult = await confluenceSyncService.syncConfluencePages(20);
    
    log(`📊 同期結果:`);
    log(`- 処理したページ数: ${syncResult.processedPages}`);
    log(`- 新規チャンク数: ${syncResult.newChunks}`);
    log(`- 更新チャンク数: ${syncResult.updatedChunks}`);
    log(`- 削除チャンク数: ${syncResult.deletedChunks}`);
    log(`- スキップしたページ数: ${syncResult.skippedPages}`);
    log(`- エラー数: ${syncResult.errors}`);
    
    // 3. データベースの状態確認
    log('\n📊 データベースの状態確認...');
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    log(`📊 総チャンク数: ${allChunks.length}`);
    
    // 4. ラベルの詳細確認
    log('\n🔍 ラベルの詳細確認...');
    const labelStats = {
      'Array.isArray=true': 0,
      'Array.isArray=false': 0,
      'Array.from可能': 0,
      'Array.from不可': 0,
      '正しい表示可能': 0,
      'ラベル付きチャンク': 0
    };
    
    allChunks.forEach((chunk: any) => {
      const labels = chunk.labels;
      
      if (Array.isArray(labels)) {
        labelStats['Array.isArray=true']++;
      } else {
        labelStats['Array.isArray=false']++;
      }
      
      try {
        const labelsArray = Array.from(labels);
        labelStats['Array.from可能']++;
        if (labelsArray.length > 0) {
          labelStats['正しい表示可能']++;
          labelStats['ラベル付きチャンク']++;
        }
      } catch {
        labelStats['Array.from不可']++;
      }
    });
    
    Object.entries(labelStats).forEach(([key, count]) => {
      log(`- ${key}: ${count}チャンク`);
    });
    
    // 5. ラベルサンプルの表示
    log('\n📄 ラベルサンプル（最初の5チャンク）:');
    allChunks.slice(0, 5).forEach((chunk: any, index: number) => {
      log(`\nチャンク ${index + 1}:`);
      log(`- ID: ${chunk.id}`);
      log(`- タイトル: ${chunk.title}`);
      log(`- ラベル: [${Array.from(chunk.labels).join(', ')}]`);
      log(`- ラベル型: ${typeof chunk.labels} (Array.isArray: ${Array.isArray(chunk.labels)})`);
      log(`- コンテンツ長: ${chunk.content?.length || 0}文字`);
    });
    
    // 6. ハイブリッド検索のテスト
    log('\n🔍 ハイブリッド検索のテスト...');
    
    const testQueries = [
      'ワークフロー',
      '機能要件',
      'ミーティング議事録'
    ];
    
    for (const query of testQueries) {
      log(`\n🔍 検索クエリ: "${query}"`);
      
      try {
        const searchResults = await searchLanceDB({
          query,
          topK: 3,
          filters: {},
          excludeLabels: ['アーカイブ', 'フォルダ', 'スコープ外'],
          excludeTitlePatterns: ['■要件定義', 'xxx_*']
        });
        
        log(`📊 検索結果: ${searchResults.length}件`);
        
        searchResults.forEach((result: any, index: number) => {
          log(`  ${index + 1}. [${result.pageId}] ${result.title}`);
          log(`     ラベル: [${Array.from(result.labels).join(', ')}]`);
          log(`     スコア: ${result.score?.toFixed(4) || 'N/A'}`);
          log(`     コンテンツ長: ${result.content?.length || 0}文字`);
        });
        
      } catch (error) {
        log(`❌ 検索エラー: ${error}`);
      }
    }
    
    // 7. ラベルフィルタリングのテスト
    log('\n🏷️ ラベルフィルタリングのテスト...');
    
    try {
      // ワークフローラベルのみを検索
      const workflowResults = await searchLanceDB({
        query: '管理機能',
        topK: 3,
        filters: {
          labels: ['ワークフロー']
        },
        excludeLabels: ['アーカイブ', 'フォルダ', 'スコープ外'],
        excludeTitlePatterns: ['■要件定義', 'xxx_*']
      });
      
      log(`📊 ワークフローラベル検索結果: ${workflowResults.length}件`);
      workflowResults.forEach((result: any, index: number) => {
        log(`  ${index + 1}. [${result.pageId}] ${result.title}`);
        log(`     ラベル: [${Array.from(result.labels).join(', ')}]`);
      });
      
    } catch (error) {
      log(`❌ ラベルフィルタリングエラー: ${error}`);
    }
    
    // 8. 除外ラベルのテスト
    log('\n🚫 除外ラベルのテスト...');
    
    try {
      // 除外ラベルなしの検索
      const allResults = await searchLanceDB({
        query: '管理機能',
        topK: 5,
        filters: {},
        excludeLabels: [], // 除外ラベルなし
        excludeTitlePatterns: []
      });
      
      log(`📊 除外なし検索結果: ${allResults.length}件`);
      
      // 除外ラベルありの検索
      const filteredResults = await searchLanceDB({
        query: '管理機能',
        topK: 5,
        filters: {},
        excludeLabels: ['アーカイブ', 'フォルダ', 'スコープ外'],
        excludeTitlePatterns: ['■要件定義', 'xxx_*']
      });
      
      log(`📊 除外あり検索結果: ${filteredResults.length}件`);
      log(`📊 除外効果: ${allResults.length - filteredResults.length}件が除外されました`);
      
    } catch (error) {
      log(`❌ 除外ラベルテストエラー: ${error}`);
    }
    
    // 9. 総合評価
    log('\n🎯 総合評価:');
    
    if (labelStats['Array.from可能'] === allChunks.length) {
      log('✅ ラベル配列変換: 完全に動作');
    } else {
      log(`❌ ラベル配列変換: ${labelStats['Array.from不可']}チャンクで失敗`);
    }
    
    if (labelStats['正しい表示可能'] > 0) {
      log(`✅ ラベル表示: ${labelStats['正しい表示可能']}チャンクで正しく表示`);
    } else {
      log('❌ ラベル表示: 正しく表示できるチャンクがありません');
    }
    
    if (labelStats['ラベル付きチャンク'] > 0) {
      log(`✅ ラベル付きチャンク: ${labelStats['ラベル付きチャンク']}チャンク`);
    } else {
      log('❌ ラベル付きチャンク: ラベル付きチャンクがありません');
    }
    
    log('\n✅ 小さいデータでの同期テスト完了');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

testSmallSync().catch(console.error);
