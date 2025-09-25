/**
 * 重複ファイルの生成状況を詳細確認
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('check-duplicate-files.txt', message + '\n');
}

async function checkDuplicateFiles() {
  // 結果ファイルをクリア
  fs.writeFileSync('check-duplicate-files.txt', '');
  
  log('🔍 重複ファイルの生成状況を詳細確認...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();

    // 1. データベースの状態確認
    log('📊 データベースの状態確認...');
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    log(`📊 総チャンク数: ${allChunks.length}`);

    // 2. ページIDごとのチャンク数を詳細分析
    const chunksByPageId = new Map<number, any[]>();
    allChunks.forEach((chunk: any) => {
      const pageId = chunk.pageId;
      if (!chunksByPageId.has(pageId)) {
        chunksByPageId.set(pageId, []);
      }
      chunksByPageId.get(pageId)!.push(chunk);
    });

    log(`\n📊 ページIDごとのチャンク数分析:`);
    let totalPages = 0;
    let totalChunks = 0;
    let duplicatePages = 0;
    let normalPages = 0;
    let pagesWithMultipleChunks = 0;

    for (const [pageId, chunks] of chunksByPageId) {
      totalPages++;
      totalChunks += chunks.length;
      
      // チャンクを枝番順にソート
      chunks.sort((a: any, b: any) => a.chunkIndex - b.chunkIndex);
      
      // 重複チェック
      const chunkIndexes = chunks.map((c: any) => c.chunkIndex);
      const uniqueIndexes = new Set(chunkIndexes);
      
      if (chunkIndexes.length !== uniqueIndexes.size) {
        duplicatePages++;
        log(`\n⚠️ ページID ${pageId}: ${chunks.length}チャンク (重複あり)`);
        chunks.forEach((chunk: any, index: number) => {
          log(`  チャンク ${index}:`);
          log(`    枝番: ${chunk.chunkIndex}`);
          log(`    更新日時: ${chunk.lastUpdated}`);
          log(`    タイトル: ${chunk.title}`);
          log(`    コンテンツ長: ${chunk.content?.length || 0}文字`);
        });
      } else if (chunks.length > 1) {
        pagesWithMultipleChunks++;
        log(`\n✅ ページID ${pageId}: ${chunks.length}チャンク (正常な複数チャンク)`);
        chunks.forEach((chunk: any, index: number) => {
          log(`  チャンク ${index}:`);
          log(`    枝番: ${chunk.chunkIndex}`);
          log(`    更新日時: ${chunk.lastUpdated}`);
          log(`    タイトル: ${chunk.title}`);
          log(`    コンテンツ長: ${chunk.content?.length || 0}文字`);
        });
      } else {
        normalPages++;
        log(`\n✅ ページID ${pageId}: ${chunks.length}チャンク (正常)`);
        chunks.forEach((chunk: any, index: number) => {
          log(`  チャンク ${index}:`);
          log(`    枝番: ${chunk.chunkIndex}`);
          log(`    更新日時: ${chunk.lastUpdated}`);
          log(`    タイトル: ${chunk.title}`);
          log(`    コンテンツ長: ${chunk.content?.length || 0}文字`);
        });
      }
    }

    // 3. 重複統計
    log(`\n📊 重複統計:`);
    log(`  総ページ数: ${totalPages}`);
    log(`  総チャンク数: ${totalChunks}`);
    log(`  重複ページ数: ${duplicatePages}`);
    log(`  正常ページ数: ${normalPages}`);
    log(`  複数チャンクページ数: ${pagesWithMultipleChunks}`);
    log(`  平均チャンク数: ${(totalChunks / totalPages).toFixed(2)}`);

    // 4. 重複の詳細分析
    if (duplicatePages > 0) {
      log(`\n🔍 重複の詳細分析:`);
      for (const [pageId, chunks] of chunksByPageId) {
        const chunkIndexes = chunks.map((c: any) => c.chunkIndex);
        const uniqueIndexes = new Set(chunkIndexes);
        
        if (chunkIndexes.length !== uniqueIndexes.size) {
          log(`\n  ページID ${pageId} の重複パターン:`);
          const indexCounts = new Map<number, number>();
          chunkIndexes.forEach(index => {
            indexCounts.set(index, (indexCounts.get(index) || 0) + 1);
          });
          
          for (const [index, count] of indexCounts) {
            if (count > 1) {
              log(`    枝番 ${index}: ${count}個の重複`);
              
              // 重複したチャンクの詳細を表示
              const duplicateChunks = chunks.filter(c => c.chunkIndex === index);
              duplicateChunks.forEach((chunk, i) => {
                log(`      重複 ${i + 1}:`);
                log(`        更新日時: ${chunk.lastUpdated}`);
                log(`        タイトル: ${chunk.title}`);
                log(`        コンテンツ長: ${chunk.content?.length || 0}文字`);
                log(`        コンテンツ先頭: ${chunk.content?.substring(0, 100) || ''}...`);
              });
            }
          }
        }
      }
    } else {
      log(`\n✅ 重複ページはありません！`);
    }

    // 5. チャンクの内容比較（重複チェック）
    log(`\n🔍 チャンクの内容比較...`);
    let contentDuplicates = 0;
    
    for (const [pageId, chunks] of chunksByPageId) {
      if (chunks.length > 1) {
        // 同じページ内で同じ内容のチャンクがないかチェック
        for (let i = 0; i < chunks.length; i++) {
          for (let j = i + 1; j < chunks.length; j++) {
            const chunk1 = chunks[i];
            const chunk2 = chunks[j];
            
            if (chunk1.content === chunk2.content) {
              contentDuplicates++;
              log(`\n⚠️ ページID ${pageId} で内容重複を発見:`);
              log(`  チャンク ${i} (枝番 ${chunk1.chunkIndex}): ${chunk1.content?.substring(0, 100)}...`);
              log(`  チャンク ${j} (枝番 ${chunk2.chunkIndex}): ${chunk2.content?.substring(0, 100)}...`);
            }
          }
        }
      }
    }
    
    if (contentDuplicates === 0) {
      log(`✅ 内容重複はありません！`);
    } else {
      log(`⚠️ 内容重複: ${contentDuplicates}件`);
    }

    // 6. 更新日時の一貫性チェック
    log(`\n🔍 更新日時の一貫性チェック...`);
    let timestampInconsistencies = 0;
    
    for (const [pageId, chunks] of chunksByPageId) {
      if (chunks.length > 1) {
        const timestamps = chunks.map(c => c.lastUpdated);
        const uniqueTimestamps = new Set(timestamps);
        
        if (uniqueTimestamps.size > 1) {
          timestampInconsistencies++;
          log(`\n⚠️ ページID ${pageId} で更新日時不一致:`);
          chunks.forEach((chunk, index) => {
            log(`  チャンク ${index} (枝番 ${chunk.chunkIndex}): ${chunk.lastUpdated}`);
          });
        }
      }
    }
    
    if (timestampInconsistencies === 0) {
      log(`✅ 更新日時は一貫しています！`);
    } else {
      log(`⚠️ 更新日時不一致: ${timestampInconsistencies}ページ`);
    }

    // 7. 総合評価
    log(`\n🎯 総合評価:`);
    log('=' .repeat(50));
    
    const isNoDuplicates = duplicatePages === 0;
    const isNoContentDuplicates = contentDuplicates === 0;
    const isTimestampConsistent = timestampInconsistencies === 0;
    
    log(`✅ 重複なし: ${isNoDuplicates ? 'Yes' : 'No'} (重複ページ: ${duplicatePages})`);
    log(`✅ 内容重複なし: ${isNoContentDuplicates ? 'Yes' : 'No'} (内容重複: ${contentDuplicates})`);
    log(`✅ 更新日時一貫: ${isTimestampConsistent ? 'Yes' : 'No'} (不一致: ${timestampInconsistencies})`);
    
    const overallScore = (isNoDuplicates ? 1 : 0) + (isNoContentDuplicates ? 1 : 0) + (isTimestampConsistent ? 1 : 0);
    
    log(`\n🏆 総合スコア: ${overallScore}/3`);
    
    if (overallScore === 3) {
      log(`🎉 重複ファイルは全く生成されていません！`);
    } else if (overallScore >= 2) {
      log(`👍 重複ファイルはほとんど生成されていません。`);
    } else {
      log(`⚠️ 重複ファイルが生成されています。`);
    }

    log('\n✅ 重複ファイルチェック完了！');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

checkDuplicateFiles().catch(console.error);
