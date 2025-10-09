/**
 * 最終的な修正 - 古いデータを完全削除して新しいデータで再同期
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('final-fix.txt', message + '\n');
}

async function finalFix() {
  fs.writeFileSync('final-fix.txt', '');
  
  log('🔧 最終的な修正 - 古いデータを完全削除して新しいデータで再同期中...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    
    // 1. LanceDBに接続
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    const dummyVector = new Array(768).fill(0);
    
    // 2. 現在の状況を確認
    log('📊 現在の状況を確認中...');
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    const targetPageId = 703529146;
    const targetChunks = allChunks.filter((chunk: any) => chunk.pageId === targetPageId);
    
    log(`- 総チャンク数: ${allChunks.length}`);
    log(`- 対象ページのチャンク数: ${targetChunks.length}`);
    
    if (targetChunks.length > 0) {
      log(`- 現在のコンテンツ長: ${targetChunks[0].content?.length || 0}文字`);
      log(`- 現在のスペース: ${targetChunks[0].space_key}`);
    }
    
    // 3. 古いデータを完全削除
    log('\n🗑️ 古いデータを完全削除中...');
    
    // 複数の削除方法を試行
    const deleteMethods = [
      `"pageId" = ${targetPageId}`,
      `pageId = ${targetPageId}`,
      `pageId = '${targetPageId}'`,
      `"pageId" = '${targetPageId}'`
    ];
    
    for (const method of deleteMethods) {
      try {
        await table.delete(method);
        log(`✅ 削除方法 "${method}" 実行完了`);
      } catch (error) {
        log(`⚠️ 削除方法 "${method}" 失敗: ${error}`);
      }
    }
    
    // 4. 削除確認
    log('\n🔍 削除確認中...');
    const afterDeleteChunks = await table.search(dummyVector).limit(10000).toArray();
    const afterDeleteTargetChunks = afterDeleteChunks.filter((chunk: any) => chunk.pageId === targetPageId);
    
    log(`- 削除後の総チャンク数: ${afterDeleteChunks.length}`);
    log(`- 削除後の対象ページのチャンク数: ${afterDeleteTargetChunks.length}`);
    
    if (afterDeleteTargetChunks.length === 0) {
      log(`✅ 削除成功`);
    } else {
      log(`❌ 削除失敗 - まだ ${afterDeleteTargetChunks.length} チャンクが残存`);
      
      // 個別削除を試行
      log('\n🗑️ 個別削除を試行中...');
      for (const chunk of afterDeleteTargetChunks) {
        try {
          await table.delete(`"id" = '${chunk.id}'`);
          log(`✅ チャンク ${chunk.id} 削除完了`);
        } catch (error) {
          log(`❌ チャンク ${chunk.id} 削除失敗: ${error}`);
        }
      }
    }
    
    // 5. 正しいデータを取得
    log('\n📄 正しいデータを取得中...');
    const page = await confluenceSyncService.getConfluencePageById('703529146');
    
    if (page) {
      log(`✅ 正しいデータ取得成功:`);
      log(`- コンテンツ長: ${page.content?.length || 0}文字`);
      log(`- スペース: ${page.spaceKey}`);
      
      // 6. チャンク分割を確認
      log('\n📝 チャンク分割を確認中...');
      const chunks = confluenceSyncService.splitPageIntoChunks(page);
      log(`- 分割されたチャンク数: ${chunks.length}`);
      
      chunks.forEach((chunk, index) => {
        log(`- チャンク ${index + 1}: ${chunk.content?.length || 0}文字`);
      });
      
      // 7. 強制的に同期（日時比較を無視）
      log('\n🔄 強制的に同期中...');
      
      // チャンクを個別に追加
      for (const chunk of chunks) {
        try {
          // 埋め込み生成
          const embedding = await confluenceSyncService.embeddingService.generateSingleEmbedding(chunk.content);
          
          // ラベル抽出
          const labels = confluenceSyncService.extractLabelsFromPage(page);
          
          // チャンクデータを作成
          const chunkData = {
            id: `${chunk.pageId}-${chunk.chunkIndex}`,
            pageId: chunk.pageId,
            title: chunk.title,
            content: chunk.content,
            chunkIndex: chunk.chunkIndex,
            lastUpdated: chunk.lastUpdated,
            space_key: page.spaceKey || 'CLIENTTOMO',
            url: page.url || '',
            labels: labels,
            vector: embedding
          };
          
          await table.add([chunkData]);
          log(`✅ チャンク ${chunk.chunkIndex} 追加完了`);
        } catch (error) {
          log(`❌ チャンク ${chunk.chunkIndex} 追加エラー: ${error}`);
        }
      }
      
      // 8. 最終確認
      log('\n📊 最終確認中...');
      const finalChunks = await table.search(dummyVector).limit(10000).toArray();
      const finalTargetChunks = finalChunks.filter((chunk: any) => chunk.pageId === targetPageId);
      
      log(`最終結果:`);
      log(`- 総チャンク数: ${finalChunks.length}`);
      log(`- 対象ページのチャンク数: ${finalTargetChunks.length}`);
      
      if (finalTargetChunks.length > 0) {
        const chunk = finalTargetChunks[0];
        log(`- 最終コンテンツ長: ${chunk.content?.length || 0}文字`);
        log(`- 最終スペース: ${chunk.space_key}`);
        log(`- 最終チャンクインデックス: ${chunk.chunkIndex}`);
        
        if (chunk.content && chunk.content.length > 26) {
          log(`✅ データ修正成功！`);
          log(`- 古いコンテンツ: 26文字`);
          log(`- 新しいコンテンツ: ${chunk.content.length}文字`);
          log(`- チャンク数: ${finalTargetChunks.length}`);
        } else {
          log(`❌ データ修正失敗`);
        }
      }
      
    } else {
      log(`❌ 正しいデータの取得に失敗しました`);
    }
    
    log('\n✅ 最終修正完了');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

finalFix().catch(console.error);
