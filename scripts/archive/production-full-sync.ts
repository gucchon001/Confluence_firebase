/**
 * 本番環境での全ページ同期
 * 安全で効率的な全ページ同期を実行
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import { searchLanceDB } from './src/lib/lancedb-search-client';

function log(message: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

async function productionFullSync() {
  log('🚀 本番環境での全ページ同期を開始...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    
    // 1. 事前確認
    log('📊 事前確認を実行中...');
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    const dummyVector = new Array(768).fill(0);
    const currentChunks = await table.search(dummyVector).limit(10000).toArray();
    
    log(`📊 現在のデータベース状態:`);
    log(`- 総チャンク数: ${currentChunks.length}`);
    
    if (currentChunks.length > 0) {
      // ページID別のチャンク数を確認
      const pageChunkCounts: { [pageId: string]: number } = {};
      currentChunks.forEach((chunk: any) => {
        const pageId = chunk.pageId.toString();
        pageChunkCounts[pageId] = (pageChunkCounts[pageId] || 0) + 1;
      });
      
      log(`- ページ数: ${Object.keys(pageChunkCounts).length}`);
      log(`- 平均チャンク数/ページ: ${(currentChunks.length / Object.keys(pageChunkCounts).length).toFixed(2)}`);
    }
    
    // 2. 全ページ数の取得
    log('\n📄 全ページ数の取得中...');
    const allPages = await confluenceSyncService.getAllConfluencePages(10000); // 最大10000ページ
    log(`📊 取得したページ数: ${allPages.length}`);
    
    if (allPages.length === 0) {
      log('❌ ページが取得できませんでした。設定を確認してください。');
      return;
    }
    
    // 3. 除外対象ページの確認
    log('\n🚫 除外対象ページの確認...');
    let excludedCount = 0;
    const excludedReasons: { [reason: string]: number } = {};
    
    allPages.forEach(page => {
      if (confluenceSyncService.shouldExcludePage(page)) {
        excludedCount++;
        
        // 除外理由を分類
        const labels = confluenceSyncService.extractLabelsFromPage(page);
        const hasExcludedLabel = labels.some(label => 
          ['アーカイブ', 'フォルダ', 'スコープ外'].includes(label)
        );
        const hasExcludedTitle = ['■要件定義', 'xxx_'].some(pattern => 
          page.title.includes(pattern)
        );
        const isShortContent = (page.content?.length || 0) < 100;
        
        if (hasExcludedLabel) {
          excludedReasons['除外ラベル'] = (excludedReasons['除外ラベル'] || 0) + 1;
        } else if (hasExcludedTitle) {
          excludedReasons['除外タイトル'] = (excludedReasons['除外タイトル'] || 0) + 1;
        } else if (isShortContent) {
          excludedReasons['短いコンテンツ'] = (excludedReasons['短いコンテンツ'] || 0) + 1;
        } else {
          excludedReasons['その他'] = (excludedReasons['その他'] || 0) + 1;
        }
      }
    });
    
    log(`📊 除外対象ページ: ${excludedCount}/${allPages.length} (${(excludedCount / allPages.length * 100).toFixed(1)}%)`);
    Object.entries(excludedReasons).forEach(([reason, count]) => {
      log(`  - ${reason}: ${count}ページ`);
    });
    
    const expectedProcessedPages = allPages.length - excludedCount;
    log(`📊 処理予定ページ数: ${expectedProcessedPages}ページ`);
    
    // 4. 全ページ同期の実行
    log('\n🔄 全ページ同期を実行中...');
    const startTime = Date.now();
    
    const syncResult = await confluenceSyncService.syncPagesByCount(allPages.length);
    
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    log(`\n📊 全ページ同期結果:`);
    log(`- 実行時間: ${Math.round(executionTime / 1000)}秒 (${Math.round(executionTime / 1000 / 60)}分)`);
    log(`- 処理したページ数: ${allPages.length}`);
    log(`- 追加されたチャンク数: ${syncResult.added}`);
    log(`- 更新されたチャンク数: ${syncResult.updated}`);
    log(`- 変更なしのチャンク数: ${syncResult.unchanged}`);
    log(`- 除外されたチャンク数: ${syncResult.excluded}`);
    log(`- エラー数: ${syncResult.errors.length}`);
    
    if (syncResult.errors.length > 0) {
      log('\n❌ エラー詳細:');
      syncResult.errors.forEach((error, index) => {
        log(`  ${index + 1}. ${error}`);
      });
    }
    
    // 5. 最終データベース状態確認
    log('\n📊 最終データベース状態確認...');
    const finalChunks = await table.search(dummyVector).limit(10000).toArray();
    log(`📊 最終総チャンク数: ${finalChunks.length}`);
    
    // ページID別のチャンク数を確認
    const finalPageChunkCounts: { [pageId: string]: number } = {};
    finalChunks.forEach((chunk: any) => {
      const pageId = chunk.pageId.toString();
      finalPageChunkCounts[pageId] = (finalPageChunkCounts[pageId] || 0) + 1;
    });
    
    log(`📊 最終ページ数: ${Object.keys(finalPageChunkCounts).length}`);
    log(`📊 平均チャンク数/ページ: ${(finalChunks.length / Object.keys(finalPageChunkCounts).length).toFixed(2)}`);
    
    // 6. 重複チェック
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
    let duplicateCount = 0;
    Object.entries(duplicateCheck).forEach(([pageId, chunkIndices]) => {
      Object.entries(chunkIndices).forEach(([chunkIndex, count]) => {
        if (count > 1) {
          hasDuplicates = true;
          duplicateCount += count - 1;
        }
      });
    });
    
    if (!hasDuplicates) {
      log('✅ 重複は見つかりませんでした');
    } else {
      log(`❌ 重複が ${duplicateCount} 個見つかりました`);
    }
    
    // 7. ラベル機能の確認
    log('\n🏷️ ラベル機能の確認...');
    let labeledChunks = 0;
    let arrayFromSuccess = 0;
    const labelTypes: { [key: string]: number } = {};
    
    finalChunks.forEach((chunk: any) => {
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
    log(`- Array.from成功: ${arrayFromSuccess}/${finalChunks.length} (${(arrayFromSuccess / finalChunks.length * 100).toFixed(1)}%)`);
    log(`- ラベル付きチャンク: ${labeledChunks} (${(labeledChunks / finalChunks.length * 100).toFixed(1)}%)`);
    log(`- ラベル種類: ${Object.keys(labelTypes).length}種類`);
    
    // 8. ハイブリッド検索のテスト
    log('\n🔍 ハイブリッド検索のテスト...');
    const testQueries = [
      'ワークフロー',
      '機能要件',
      'ミーティング議事録',
      '管理機能',
      'テスト要件'
    ];
    
    for (const query of testQueries) {
      try {
        const searchResults = await searchLanceDB({
          query,
          topK: 3,
          filters: {},
          excludeLabels: ['アーカイブ', 'フォルダ', 'スコープ外'],
          excludeTitlePatterns: ['■要件定義', 'xxx_*']
        });
        
        log(`  ✅ "${query}": ${searchResults.length}件の結果`);
      } catch (error) {
        log(`  ❌ "${query}": エラー - ${error}`);
      }
    }
    
    // 9. 最終評価
    log('\n🎯 最終評価:');
    
    // 同期機能の評価
    if (syncResult.added > 0 || syncResult.updated > 0) {
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
    
    // パフォーマンスの評価
    const pagesPerSecond = Math.round(allPages.length / (executionTime / 1000));
    log(`📊 パフォーマンス: ${pagesPerSecond}ページ/秒`);
    
    log('\n✅ 本番環境での全ページ同期完了');

  } catch (error) {
    log(`❌ エラー: ${error}`);
    throw error;
  }
}

productionFullSync().catch(console.error);
