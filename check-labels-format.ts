/**
 * LanceDBのラベル形式を確認
 */

import 'dotenv/config';
import { LanceDBClient } from './src/lib/lancedb-client';

async function checkLabelsFormat(): Promise<void> {
  console.log('🔍 LanceDBのラベル形式を確認中...\n');

  try {
    const lancedbClient = LanceDBClient.getInstance();
    await lancedbClient.connect();

    const table = await lancedbClient.getTable();
    
    // 1. 全チャンクを取得
    console.log('📦 全チャンクを取得中...');
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(100).toArray();
    
    console.log(`📄 取得チャンク数: ${allChunks.length}`);
    
    // 2. ラベル形式を確認
    console.log('\n🔍 ラベル形式の確認:');
    const labelTypes = new Set<string>();
    const sampleLabels: any[] = [];
    
    allChunks.forEach((chunk: any, index: number) => {
      const labels = chunk.labels;
      const labelType = typeof labels;
      const isArray = Array.isArray(labels);
      
      labelTypes.add(`${labelType}${isArray ? ' (array)' : ''}`);
      
      if (index < 10) { // 最初の10件のサンプル
        sampleLabels.push({
          pageId: chunk.pageId,
          title: chunk.title,
          labels: labels,
          labelType: labelType,
          isArray: isArray
        });
      }
    });
    
    console.log(`📊 ラベル型の種類: ${Array.from(labelTypes).join(', ')}`);
    
    // 3. サンプルラベルを表示
    console.log('\n📋 サンプルラベル:');
    sampleLabels.forEach((item, index) => {
      console.log(`  ${index + 1}. ページID: ${item.pageId}`);
      console.log(`     タイトル: ${item.title}`);
      console.log(`     ラベル: ${JSON.stringify(item.labels)}`);
      console.log(`     型: ${item.labelType}, 配列: ${item.isArray}`);
      console.log('');
    });
    
    // 4. アーカイブ関連のラベルを検索
    console.log('🔍 アーカイブ関連ラベルの検索:');
    const archiveKeywords = ['アーカイブ', 'archive', 'アーカイブ', 'archive'];
    const archiveChunks: any[] = [];
    
    allChunks.forEach((chunk: any) => {
      const labels = chunk.labels;
      let hasArchiveLabel = false;
      
      if (Array.isArray(labels)) {
        hasArchiveLabel = labels.some((label: string) => 
          archiveKeywords.some(keyword => label.includes(keyword))
        );
      } else if (typeof labels === 'string') {
        hasArchiveLabel = archiveKeywords.some(keyword => labels.includes(keyword));
      } else if (typeof labels === 'object' && labels !== null) {
        const labelsStr = JSON.stringify(labels);
        hasArchiveLabel = archiveKeywords.some(keyword => labelsStr.includes(keyword));
      }
      
      if (hasArchiveLabel) {
        archiveChunks.push(chunk);
      }
    });
    
    console.log(`🚫 アーカイブ関連チャンク数: ${archiveChunks.length}`);
    
    if (archiveChunks.length > 0) {
      console.log('\n📋 アーカイブ関連チャンク:');
      archiveChunks.forEach((chunk: any, index: number) => {
        console.log(`  ${index + 1}. ページID: ${chunk.pageId}`);
        console.log(`     タイトル: ${chunk.title}`);
        console.log(`     ラベル: ${JSON.stringify(chunk.labels)}`);
        console.log('');
      });
    } else {
      console.log('✅ アーカイブ関連チャンクは見つかりませんでした');
    }

  } catch (error) {
    console.error('❌ ラベル形式確認中にエラーが発生しました:', error);
    throw error;
  }
}

// 実行
checkLabelsFormat().catch(console.error);
