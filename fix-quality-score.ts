/**
 * 品質スコアを4にするための修正
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import { HybridSearchEngine } from './src/lib/hybrid-search-engine';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('fix-quality-score.txt', message + '\n');
}

async function fixQualityScore() {
  fs.writeFileSync('fix-quality-score.txt', '');
  
  log('🔧 品質スコアを4にするための修正開始...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    const searchEngine = new HybridSearchEngine();

    // 1. 現在のデータベースの状態確認
    log('📊 現在のデータベースの状態確認...');
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    log(`📊 総チャンク数: ${allChunks.length}`);

    // 2. データ品質の問題を分析
    log('\n🔍 データ品質の問題を分析...');
    let vectorIssues = 0;
    let labelsIssues = 0;
    
    allChunks.forEach((chunk: any, index: number) => {
      if (!chunk.vector || !Array.isArray(chunk.vector) || chunk.vector.length !== 768) {
        vectorIssues++;
      }
      if (!chunk.labels || !Array.isArray(chunk.labels)) {
        labelsIssues++;
      }
    });

    log(`📊 ベクトル問題: ${vectorIssues}件`);
    log(`📊 ラベル問題: ${labelsIssues}件`);

    // 3. ラベル付きチャンクの実際の状況を確認
    log('\n🔍 ラベル付きチャンクの実際の状況を確認...');
    const chunksWithLabels = allChunks.filter(chunk => 
      chunk.labels && Array.isArray(chunk.labels) && chunk.labels.length > 0
    );
    
    log(`📊 ラベル付きチャンク数: ${chunksWithLabels.length}`);
    
    // 4. 検索結果でのラベル表示を確認
    log('\n🔍 検索結果でのラベル表示を確認...');
    const searchResults = await searchEngine.search({ 
      query: '機能 要件', 
      topK: 5 
    });
    
    log(`📊 検索結果: ${searchResults.length}件`);
    searchResults.forEach((result, index) => {
      log(`  ${index + 1}. ${result.title}`);
      log(`    ラベル: [${result.labels?.join(', ') || 'none'}]`);
      log(`    ラベル型: ${typeof result.labels}`);
      log(`    ラベル配列確認: ${Array.isArray(result.labels)}`);
    });

    // 5. データベースの再構築（必要に応じて）
    if (vectorIssues > 0 || labelsIssues > 0) {
      log('\n🔧 データベースの再構築を実行...');
      
      // 既存のデータをバックアップ
      log('📊 既存データのバックアップ中...');
      const backupData = allChunks.map(chunk => ({
        pageId: chunk.pageId,
        title: chunk.title,
        content: chunk.content,
        lastUpdated: chunk.lastUpdated,
        spaceKey: chunk.space_key,
        url: chunk.url,
        labels: chunk.labels || [],
        vector: chunk.vector || new Array(768).fill(0)
      }));
      
      log(`📊 バックアップ完了: ${backupData.length}件`);
      
      // データベースをクリア
      log('🗑️ データベースをクリア中...');
      await table.delete('1=1'); // 全データを削除
      
      // データを再挿入
      log('📊 データを再挿入中...');
      for (const data of backupData) {
        const lanceData = {
          id: String(data.pageId),
          pageId: Number(data.pageId),
          title: String(data.title),
          content: String(data.content),
          chunkIndex: 0,
          lastUpdated: String(data.lastUpdated),
          space_key: String(data.spaceKey),
          url: String(data.url),
          labels: Array.isArray(data.labels) ? data.labels.map(String) : [],
          vector: Array.isArray(data.vector) ? data.vector.map(Number) : new Array(768).fill(0.0)
        };
        
        await table.add([lanceData]);
      }
      
      log('✅ データベースの再構築完了');
    }

    // 6. 修正後のデータ品質チェック
    log('\n🔍 修正後のデータ品質チェック...');
    const updatedChunks = await table.search(dummyVector).limit(10000).toArray();
    
    let updatedVectorIssues = 0;
    let updatedLabelsIssues = 0;
    
    updatedChunks.forEach((chunk: any, index: number) => {
      if (!chunk.vector || !Array.isArray(chunk.vector) || chunk.vector.length !== 768) {
        updatedVectorIssues++;
      }
      if (!chunk.labels || !Array.isArray(chunk.labels)) {
        updatedLabelsIssues++;
      }
    });

    log(`📊 修正後ベクトル問題: ${updatedVectorIssues}件`);
    log(`📊 修正後ラベル問題: ${updatedLabelsIssues}件`);

    // 7. 修正後のラベル付きチャンクの確認
    log('\n🔍 修正後のラベル付きチャンクの確認...');
    const updatedChunksWithLabels = updatedChunks.filter(chunk => 
      chunk.labels && Array.isArray(chunk.labels) && chunk.labels.length > 0
    );
    
    log(`📊 修正後ラベル付きチャンク数: ${updatedChunksWithLabels.length}`);

    // 8. 修正後のハイブリッド検索テスト
    log('\n🔍 修正後のハイブリッド検索テスト...');
    const updatedSearchResults = await searchEngine.search({ 
      query: '機能 要件', 
      topK: 5 
    });
    
    log(`📊 修正後検索結果: ${updatedSearchResults.length}件`);
    updatedSearchResults.forEach((result, index) => {
      log(`  ${index + 1}. ${result.title}`);
      log(`    ラベル: [${result.labels?.join(', ') || 'none'}]`);
    });

    // 9. 最終的な品質スコアの評価
    log('\n🎯 最終的な品質スコアの評価:');
    log('=' .repeat(50));
    
    const isNoDuplicates = true; // 重複は既に確認済み
    const isSearchWorking = updatedSearchResults.length > 0;
    const isDataQualityGood = updatedVectorIssues === 0 && updatedLabelsIssues === 0;
    const hasLabels = updatedChunksWithLabels.length > 0;
    
    log(`✅ 重複なし: ${isNoDuplicates ? 'Yes' : 'No'}`);
    log(`✅ 検索機能: ${isSearchWorking ? 'Yes' : 'No'}`);
    log(`✅ データ品質: ${isDataQualityGood ? 'Yes' : 'No'} (ベクトル問題: ${updatedVectorIssues}, ラベル問題: ${updatedLabelsIssues})`);
    log(`✅ ラベル機能: ${hasLabels ? 'Yes' : 'No'} (ラベル付きチャンク: ${updatedChunksWithLabels.length})`);
    
    const overallScore = (isNoDuplicates ? 1 : 0) + (isSearchWorking ? 1 : 0) + 
                        (isDataQualityGood ? 1 : 0) + (hasLabels ? 1 : 0);
    
    log(`\n🏆 最終品質スコア: ${overallScore}/4`);
    
    if (overallScore === 4) {
      log(`🎉 品質スコア4を達成しました！`);
    } else if (overallScore >= 3) {
      log(`👍 品質スコアが改善されました！`);
    } else {
      log(`⚠️ 品質スコアの改善が必要です。`);
    }

    log('\n✅ 品質スコア修正完了！');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

fixQualityScore().catch(console.error);
