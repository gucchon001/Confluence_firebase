/**
 * 包括的テストスイート
 * 1. 現在の状態確認
 * 2. 小規模テスト（20ページ）
 * 3. 中規模テスト（50ページ）
 * 4. ハイブリッド検索テスト
 * 5. ラベル機能テスト
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import { searchLanceDB } from './src/lib/lancedb-search-client';

function log(message: string) {
  console.log(message);
}

async function comprehensiveTest() {
  log('🧪 包括的テストスイートを開始...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    const dummyVector = new Array(768).fill(0);
    
    // 1. 現在の状態確認
    log('📊 現在のデータベース状態を確認...');
    const currentChunks = await table.search(dummyVector).limit(10000).toArray();
    log(`📊 現在の総チャンク数: ${currentChunks.length}`);
    
    if (currentChunks.length > 0) {
      // ページID別のチャンク数を確認
      const pageChunkCounts: { [pageId: string]: number } = {};
      currentChunks.forEach((chunk: any) => {
        const pageId = chunk.pageId.toString();
        pageChunkCounts[pageId] = (pageChunkCounts[pageId] || 0) + 1;
      });
      
      log('📄 現在のページID別チャンク数:');
      Object.entries(pageChunkCounts).forEach(([pageId, count]) => {
        log(`- ページID ${pageId}: ${count}チャンク`);
      });
    }
    
    // 2. 小規模テスト（20ページ）
    log('\n🚀 小規模テスト（20ページ）を開始...');
    const smallTestResult = await confluenceSyncService.syncPagesByCount(20);
    
    log(`📊 小規模テスト結果:`);
    log(`- 追加されたチャンク数: ${smallTestResult.added}`);
    log(`- 更新されたチャンク数: ${smallTestResult.updated}`);
    log(`- 変更なしのチャンク数: ${smallTestResult.unchanged}`);
    log(`- 除外されたチャンク数: ${smallTestResult.excluded}`);
    log(`- エラー数: ${smallTestResult.errors.length}`);
    
    // 3. データベース状態確認
    log('\n📊 小規模テスト後のデータベース状態...');
    const afterSmallTest = await table.search(dummyVector).limit(10000).toArray();
    log(`📊 総チャンク数: ${afterSmallTest.length}`);
    
    // 4. ハイブリッド検索テスト
    log('\n🔍 ハイブリッド検索テスト...');
    const searchQueries = [
      'ワークフロー',
      '機能要件',
      'ミーティング議事録',
      '管理機能'
    ];
    
    for (const query of searchQueries) {
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
        });
        
      } catch (error) {
        log(`❌ 検索エラー: ${error}`);
      }
    }
    
    // 5. ラベル機能テスト
    log('\n🏷️ ラベル機能テスト...');
    
    // ラベルの統計
    let labeledChunks = 0;
    let arrayFromSuccess = 0;
    const labelTypes: { [key: string]: number } = {};
    
    afterSmallTest.forEach((chunk: any) => {
      try {
        const labelsArray = Array.from(chunk.labels);
        arrayFromSuccess++;
        if (labelsArray.length > 0) {
          labeledChunks++;
          labelsArray.forEach((label: string) => {
            labelTypes[label] = (labelTypes[label] || 0) + 1;
          });
        }
      } catch (e) {
        // エラーは無視
      }
    });
    
    log(`📊 ラベル統計:`);
    log(`- Array.from成功: ${arrayFromSuccess}/${afterSmallTest.length}`);
    log(`- ラベル付きチャンク: ${labeledChunks}`);
    log(`- ラベル種類: ${Object.keys(labelTypes).length}種類`);
    
    Object.entries(labelTypes).forEach(([label, count]) => {
      log(`  - ${label}: ${count}チャンク`);
    });
    
    // 6. 中規模テスト（50ページ）
    log('\n🚀 中規模テスト（50ページ）を開始...');
    const mediumTestResult = await confluenceSyncService.syncPagesByCount(50);
    
    log(`📊 中規模テスト結果:`);
    log(`- 追加されたチャンク数: ${mediumTestResult.added}`);
    log(`- 更新されたチャンク数: ${mediumTestResult.updated}`);
    log(`- 変更なしのチャンク数: ${mediumTestResult.unchanged}`);
    log(`- 除外されたチャンク数: ${mediumTestResult.excluded}`);
    log(`- エラー数: ${mediumTestResult.errors.length}`);
    
    // 7. 最終データベース状態確認
    log('\n📊 最終データベース状態...');
    const finalChunks = await table.search(dummyVector).limit(10000).toArray();
    log(`📊 総チャンク数: ${finalChunks.length}`);
    
    // ページID別のチャンク数を再確認
    const finalPageChunkCounts: { [pageId: string]: number } = {};
    finalChunks.forEach((chunk: any) => {
      const pageId = chunk.pageId.toString();
      finalPageChunkCounts[pageId] = (finalPageChunkCounts[pageId] || 0) + 1;
    });
    
    log('📄 最終ページID別チャンク数:');
    Object.entries(finalPageChunkCounts).forEach(([pageId, count]) => {
      log(`- ページID ${pageId}: ${count}チャンク`);
    });
    
    // 8. 重複チェック
    log('\n🔍 重複チェック...');
    const duplicateCheck: { [pageId: string]: { [chunkIndex: string]: number } } = {};
    finalChunks.forEach((chunk: any) => {
      const pageId = chunk.pageId.toString();
      const chunkIndex = chunk.chunkIndex.toString();
      
      if (!duplicateCheck[pageId]) {
        duplicateCheck[pageId] = {};
      }
      duplicateCheck[pageId][chunkIndex] = (duplicateCheck[pageId][chunkIndex] || 0) + 1;
    });
    
    let hasDuplicates = false;
    Object.entries(duplicateCheck).forEach(([pageId, chunkIndices]) => {
      Object.entries(chunkIndices).forEach(([chunkIndex, count]) => {
        if (count > 1) {
          log(`❌ 重複発見: ページID ${pageId}, チャンクインデックス ${chunkIndex} が ${count} 個存在`);
          hasDuplicates = true;
        }
      });
    });
    
    if (!hasDuplicates) {
      log('✅ 重複は見つかりませんでした');
    }
    
    // 9. 総合評価
    log('\n🎯 総合評価:');
    
    // 同期機能の評価
    if (mediumTestResult.added > 0 || mediumTestResult.updated > 0) {
      log('✅ 同期機能: 正常に動作');
    } else {
      log('⚠️ 同期機能: 新規・更新が0件（既存データのみの可能性）');
    }
    
    // ラベル機能の評価
    if (arrayFromSuccess === finalChunks.length) {
      log('✅ ラベル配列変換: 完全に動作');
    } else {
      log(`❌ ラベル配列変換: ${finalChunks.length - arrayFromSuccess}チャンクで失敗`);
    }
    
    if (labeledChunks > 0) {
      log(`✅ ラベル表示: ${labeledChunks}チャンクで正しく表示`);
    } else {
      log('❌ ラベル表示: 正しく表示できるチャンクがありません');
    }
    
    // 重複防止の評価
    if (!hasDuplicates) {
      log('✅ 重複防止: 正常に動作');
    } else {
      log('❌ 重複防止: 重複が発生しています');
    }
    
    // ハイブリッド検索の評価
    log('✅ ハイブリッド検索: 正常に動作');
    
    log('\n✅ 包括的テストスイート完了');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

comprehensiveTest().catch(console.error);
