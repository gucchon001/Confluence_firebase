/**
 * ベクトル検索のデバッグ
 * 
 * ベクトル検索が実際に動作しているかを確認する
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../../lib/embeddings';

async function debugVectorSearch(): Promise<void> {
  console.log('🔍 ベクトル検索のデバッグ');
  console.log('='.repeat(80));
  
  try {
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tbl = await db.openTable('confluence');
    
    // 1. データ状況の確認
    console.log(`\n=== 1. データ状況の確認 ===`);
    const totalCount = await tbl.countRows();
    console.log(`総レコード数: ${totalCount}`);
    
    // 2. サンプルレコードの確認
    console.log(`\n=== 2. サンプルレコードの確認 ===`);
    const sampleRecords = await tbl.query().limit(3).toArray();
    for (const record of sampleRecords) {
      console.log(`\n--- レコード: ${record.id} ---`);
      console.log(`タイトル: ${record.title}`);
      console.log(`ベクトルフィールド: ${record.vector ? '存在' : '不存在'}`);
      if (record.vector) {
        console.log(`ベクトル型: ${typeof record.vector}`);
        console.log(`ベクトル配列か: ${Array.isArray(record.vector)}`);
        if (record.vector.toArray) {
          const vectorArray = record.vector.toArray();
          console.log(`ベクトル次元数: ${vectorArray.length}`);
          console.log(`ベクトル範囲: ${Math.min(...vectorArray).toFixed(4)} ～ ${Math.max(...vectorArray).toFixed(4)}`);
        }
      }
    }
    
    // 3. 直接ベクトル検索のテスト
    console.log(`\n=== 3. 直接ベクトル検索のテスト ===`);
    
    const testQuery = '教室管理';
    const queryEmbedding = await getEmbeddings(testQuery);
    console.log(`クエリ: "${testQuery}"`);
    console.log(`クエリ埋め込み次元数: ${queryEmbedding.length}`);
    
    // 距離閾値なしで検索
    console.log(`\n--- 距離閾値なしで検索 ---`);
    const searchResultsNoThreshold = await tbl.search(queryEmbedding).limit(10).toArray();
    console.log(`検索結果数: ${searchResultsNoThreshold.length}`);
    
    for (const result of searchResultsNoThreshold) {
      console.log(`  ${result.id}: ${result.title} (距離: ${result._distance?.toFixed(4) || 'N/A'})`);
    }
    
    // 距離閾値0.5で検索
    console.log(`\n--- 距離閾値0.5で検索 ---`);
    const searchResultsThreshold05 = await tbl.search(queryEmbedding).limit(10).toArray();
    const filteredResults05 = searchResultsThreshold05.filter(r => (r._distance || 0) <= 0.5);
    console.log(`検索結果数: ${searchResultsThreshold05.length}`);
    console.log(`距離閾値0.5でフィルタ後: ${filteredResults05.length}`);
    
    for (const result of filteredResults05) {
      console.log(`  ${result.id}: ${result.title} (距離: ${result._distance?.toFixed(4) || 'N/A'})`);
    }
    
    // 距離閾値1.0で検索
    console.log(`\n--- 距離閾値1.0で検索 ---`);
    const searchResultsThreshold10 = await tbl.search(queryEmbedding).limit(10).toArray();
    const filteredResults10 = searchResultsThreshold10.filter(r => (r._distance || 0) <= 1.0);
    console.log(`検索結果数: ${searchResultsThreshold10.length}`);
    console.log(`距離閾値1.0でフィルタ後: ${filteredResults10.length}`);
    
    for (const result of filteredResults10) {
      console.log(`  ${result.id}: ${result.title} (距離: ${result._distance?.toFixed(4) || 'N/A'})`);
    }
    
    // 距離閾値2.0で検索
    console.log(`\n--- 距離閾値2.0で検索 ---`);
    const searchResultsThreshold20 = await tbl.search(queryEmbedding).limit(10).toArray();
    const filteredResults20 = searchResultsThreshold20.filter(r => (r._distance || 0) <= 2.0);
    console.log(`検索結果数: ${searchResultsThreshold20.length}`);
    console.log(`距離閾値2.0でフィルタ後: ${filteredResults20.length}`);
    
    for (const result of filteredResults20) {
      console.log(`  ${result.id}: ${result.title} (距離: ${result._distance?.toFixed(4) || 'N/A'})`);
    }
    
    // 4. 距離分布の分析
    console.log(`\n=== 4. 距離分布の分析 ===`);
    
    const allDistances = searchResultsNoThreshold.map(r => r._distance || 0);
    if (allDistances.length > 0) {
      const minDistance = Math.min(...allDistances);
      const maxDistance = Math.max(...allDistances);
      const avgDistance = allDistances.reduce((sum, d) => sum + d, 0) / allDistances.length;
      
      console.log(`最小距離: ${minDistance.toFixed(4)}`);
      console.log(`最大距離: ${maxDistance.toFixed(4)}`);
      console.log(`平均距離: ${avgDistance.toFixed(4)}`);
      
      // 距離の分布
      const distanceRanges = [
        { min: 0, max: 0.5, label: '0.0-0.5' },
        { min: 0.5, max: 1.0, label: '0.5-1.0' },
        { min: 1.0, max: 1.5, label: '1.0-1.5' },
        { min: 1.5, max: 2.0, label: '1.5-2.0' },
        { min: 2.0, max: Infinity, label: '2.0以上' }
      ];
      
      console.log(`\n距離分布:`);
      for (const range of distanceRanges) {
        const count = allDistances.filter(d => d >= range.min && d < range.max).length;
        console.log(`  ${range.label}: ${count}件`);
      }
    }
    
    // 5. 推奨距離閾値の計算
    console.log(`\n=== 5. 推奨距離閾値の計算 ===`);
    
    if (allDistances.length > 0) {
      const sortedDistances = allDistances.sort((a, b) => a - b);
      const percentile50 = sortedDistances[Math.floor(sortedDistances.length * 0.5)];
      const percentile75 = sortedDistances[Math.floor(sortedDistances.length * 0.75)];
      const percentile90 = sortedDistances[Math.floor(sortedDistances.length * 0.9)];
      
      console.log(`50パーセンタイル: ${percentile50.toFixed(4)}`);
      console.log(`75パーセンタイル: ${percentile75.toFixed(4)}`);
      console.log(`90パーセンタイル: ${percentile90.toFixed(4)}`);
      
      console.log(`\n推奨距離閾値:`);
      console.log(`  保守的: ${percentile50.toFixed(4)} (50%の結果を含む)`);
      console.log(`  バランス: ${percentile75.toFixed(4)} (75%の結果を含む)`);
      console.log(`  包括的: ${percentile90.toFixed(4)} (90%の結果を含む)`);
    }
    
  } catch (error) {
    console.error('❌ ベクトル検索デバッグエラー:', error);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ ベクトル検索デバッグ完了');
}

if (require.main === module) {
  debugVectorSearch();
}

export { debugVectorSearch };
