/**
 * 強制的にデータを修正
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('force-fix-data.txt', message + '\n');
}

async function forceFixData() {
  fs.writeFileSync('force-fix-data.txt', '');
  
  log('🔧 強制的にデータを修正中...\n');

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
    
    // 3. 強制的に削除
    log('\n🗑️ 強制的に削除中...');
    
    // 複数の削除方法を試行
    try {
      await table.delete(`"pageId" = ${targetPageId}`);
      log(`✅ 方法1: pageIdで削除完了`);
    } catch (error) {
      log(`⚠️ 方法1失敗: ${error}`);
    }
    
    try {
      await table.delete(`pageId = ${targetPageId}`);
      log(`✅ 方法2: pageIdで削除完了`);
    } catch (error) {
      log(`⚠️ 方法2失敗: ${error}`);
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
    }
    
    // 5. 正しいデータを取得
    log('\n📄 正しいデータを取得中...');
    const page = await confluenceSyncService.getConfluencePageById('703529146');
    
    if (page) {
      log(`✅ 正しいデータ取得成功:`);
      log(`- コンテンツ長: ${page.content?.length || 0}文字`);
      log(`- スペース: ${page.spaceKey}`);
      
      // 6. 強制的に追加
      log('\n➕ 強制的に追加中...');
      
      // チャンク分割
      const chunks = confluenceSyncService.splitPageIntoChunks(page);
      log(`- 分割されたチャンク数: ${chunks.length}`);
      
      // 各チャンクを個別に追加
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        log(`- チャンク ${i + 1}: ${chunk.content?.length || 0}文字`);
      }
      
      // 埋め込み生成
      log('\n🧠 埋め込み生成中...');
      for (const chunk of chunks) {
        try {
          const embedding = await confluenceSyncService.embeddingService.generateEmbedding(chunk.content);
          chunk.embedding = embedding;
          log(`✅ 埋め込み生成完了: ${embedding.length}次元`);
        } catch (error) {
          log(`❌ 埋め込み生成エラー: ${error}`);
        }
      }
      
      // データベースに追加
      log('\n💾 データベースに追加中...');
      for (const chunk of chunks) {
        try {
          const chunkData = {
            id: `${chunk.pageId}-${chunk.chunkIndex}`,
            pageId: chunk.pageId,
            title: chunk.title,
            content: chunk.content,
            chunkIndex: chunk.chunkIndex,
            lastUpdated: chunk.lastUpdated,
            space_key: page.spaceKey || 'CLIENTTOMO',
            url: page.url || '',
            labels: confluenceSyncService.extractLabelsFromPage(page),
            vector: chunk.embedding
          };
          
          await table.add([chunkData]);
          log(`✅ チャンク ${chunk.chunkIndex} 追加完了`);
        } catch (error) {
          log(`❌ チャンク ${chunk.chunkIndex} 追加エラー: ${error}`);
        }
      }
      
      // 7. 最終確認
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
        } else {
          log(`❌ データ修正失敗`);
        }
      }
      
    } else {
      log(`❌ 正しいデータの取得に失敗しました`);
    }
    
    log('\n✅ 強制データ修正完了');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

forceFixData().catch(console.error);
