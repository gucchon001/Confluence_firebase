/**
 * 100文字未満除外条件のテスト
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';

function log(message: string) {
  console.log(message);
}

async function test100CharExclusion() {
  log('🔧 100文字未満除外条件のテストを開始...\n');

  try {
    // 1. LanceDBデータベースを完全削除
    log('🧹 LanceDBデータベースを完全削除中...');
    const lancedbPath = join(process.cwd(), '.lancedb');
    if (existsSync(lancedbPath)) {
      rmSync(lancedbPath, { recursive: true, force: true });
      log('✅ .lancedbフォルダを完全削除しました');
    }
    
    // 2. 修正版で新規同期を実行
    log('\n📊 修正版で100ページの新規同期を実行...');
    const confluenceSyncService = new ConfluenceSyncService();
    const syncResult = await confluenceSyncService.syncPagesByCount(100);
    
    log('\n📊 同期結果:');
    log(`- 追加: ${syncResult.added}`);
    log(`- 更新: ${syncResult.updated}`);
    log(`- 変更なし: ${syncResult.unchanged}`);
    log(`- 除外: ${syncResult.excluded}`);
    log(`- エラー: ${syncResult.errors}`);
    
    // 3. 除外効果の確認
    log('\n🔍 除外効果の確認...');
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    const dummyVector = new Array(768).fill(0);
    const newChunks = await table.search(dummyVector).limit(10000).toArray();
    
    log(`📊 総チャンク数: ${newChunks.length}`);
    
    // コンテンツ長の分布確認
    const contentLengthStats = {
      '0-100文字': 0,
      '101-500文字': 0,
      '501-1000文字': 0,
      '1001-1800文字': 0,
      '1801文字以上': 0
    };
    
    const shortContentChunks: any[] = [];
    
    newChunks.forEach((chunk: any) => {
      const length = chunk.content?.length || 0;
      
      if (length <= 100) {
        contentLengthStats['0-100文字']++;
        shortContentChunks.push(chunk);
      } else if (length <= 500) {
        contentLengthStats['101-500文字']++;
      } else if (length <= 1000) {
        contentLengthStats['501-1000文字']++;
      } else if (length <= 1800) {
        contentLengthStats['1001-1800文字']++;
      } else {
        contentLengthStats['1801文字以上']++;
      }
    });
    
    log('\n📊 コンテンツ長分布（100文字未満除外後）:');
    Object.entries(contentLengthStats).forEach(([range, count]) => {
      const percentage = ((count / newChunks.length) * 100).toFixed(1);
      log(`- ${range}: ${count}チャンク (${percentage}%)`);
    });
    
    // 短いコンテンツの詳細表示
    if (shortContentChunks.length > 0) {
      log('\n📄 短いコンテンツの詳細（除外後）:');
      shortContentChunks.forEach((chunk: any, index: number) => {
        log(`\nチャンク ${index + 1}:`);
        log(`- ID: ${chunk.id}`);
        log(`- タイトル: ${chunk.title}`);
        log(`- コンテンツ長: ${chunk.content?.length || 0}文字`);
        log(`- コンテンツ: "${chunk.content}"`);
        log(`- チャンクインデックス: ${chunk.chunkIndex}`);
      });
    } else {
      log('\n✅ 100文字未満のコンテンツは完全に除外されました！');
    }
    
    // ページごとのチャンク数確認
    const pageChunkCounts = new Map<number, number>();
    newChunks.forEach((chunk: any) => {
      const pageId = chunk.pageId;
      pageChunkCounts.set(pageId, (pageChunkCounts.get(pageId) || 0) + 1);
    });
    
    log('\n📊 ページごとのチャンク数:');
    Array.from(pageChunkCounts.entries()).forEach(([pageId, count]) => {
      log(`- ページID ${pageId}: ${count}チャンク`);
    });
    
    // 平均チャンクサイズの計算
    const totalContentLength = newChunks.reduce((sum: number, chunk: any) => 
      sum + (chunk.content?.length || 0), 0);
    const avgChunkSize = totalContentLength / newChunks.length;
    
    log(`\n📊 チャンクサイズ統計:`);
    log(`- 平均チャンクサイズ: ${avgChunkSize.toFixed(1)}文字`);
    log(`- 期待値: 1800文字`);
    log(`- 差: ${(1800 - avgChunkSize).toFixed(1)}文字`);
    
    // 品質スコア計算
    let qualityScore = 0;
    
    // pageId型チェック
    const correctPageIdType = newChunks.every((chunk: any) => typeof chunk.pageId === 'number');
    if (correctPageIdType) qualityScore++;
    
    // ラベル配列互換性チェック
    const labelsArrayCompatible = newChunks.every((chunk: any) => {
      try {
        const labels = chunk.labels;
        if (labels && typeof labels === 'object') {
          Array.from(labels);
          return true;
        }
        return Array.isArray(labels);
      } catch {
        return false;
      }
    });
    if (labelsArrayCompatible) qualityScore++;
    
    // lastUpdated型チェック
    const correctLastUpdatedType = newChunks.every((chunk: any) => typeof chunk.lastUpdated === 'string');
    if (correctLastUpdatedType) qualityScore++;
    
    // ベクトル次元チェック
    const correctVectorDimension = newChunks.every((chunk: any) => {
      const vector = chunk.vector;
      return Array.isArray(vector) && vector.length === 768;
    });
    if (correctVectorDimension) qualityScore++;
    
    // コンテンツ長チェック（100文字以上）
    const adequateContentLength = newChunks.every((chunk: any) => (chunk.content?.length || 0) >= 100);
    if (adequateContentLength) qualityScore++;
    
    log(`\n📊 品質スコア: ${qualityScore}/5`);
    
    if (qualityScore >= 4) {
      log('✅ 高品質なデータベースです');
    } else if (qualityScore >= 3) {
      log('⚠️ 品質に改善の余地があります');
    } else {
      log('❌ 品質に問題があります');
    }
    
    // 除外効果の総評
    log('\n🎯 除外効果の総評:');
    if (shortContentChunks.length === 0) {
      log('✅ コンテンツ長問題: 完全に解決（100文字未満は除外）');
    } else {
      log(`⚠️ コンテンツ長問題: ${shortContentChunks.length}チャンクが短いまま`);
    }
    
    log(`📊 除外率: ${syncResult.excluded}ページが除外されました`);
    const totalPages = syncResult.added + syncResult.updated + syncResult.unchanged + syncResult.excluded;
    log(`📊 有効ページ率: ${((syncResult.added + syncResult.updated + syncResult.unchanged) / totalPages * 100).toFixed(1)}%`);
    
    log('\n✅ 100文字未満除外条件のテスト完了');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

test100CharExclusion().catch(console.error);
