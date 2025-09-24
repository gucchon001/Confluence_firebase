/**
 * 実際のベクトルファイルを使ったベクトル検索テスト
 * 
 * このテストスイートは、実際のConfluenceデータのベクトルファイルを使用して
 * ベクトル検索の質を詳細に評価します。
 * 実行方法: npx tsx src/tests/lancedb/real-vector-search-test.ts
 */

import 'dotenv/config';
import { describe, test, expect, beforeAll } from 'vitest';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../../lib/embeddings';
import { searchLanceDB } from '../../lib/lancedb-search-client';

describe('実際のベクトルファイルを使ったベクトル検索テスト', () => {
  let db: lancedb.Connection;
  let tbl: lancedb.Table;
  const tableName = 'confluence'; // 実際のテーブル名
  
  // テスト前の準備
  beforeAll(async () => {
    try {
      // LanceDBに接続
      db = await lancedb.connect(path.resolve('.lancedb'));
      
      // テーブル一覧を確認
      const tables = await db.tableNames();
      console.log('利用可能なテーブル:', tables);
      
      if (!tables.includes(tableName)) {
        throw new Error(`テーブル '${tableName}' が見つかりません`);
      }
      
      // 実際のテーブルを開く
      tbl = await db.openTable(tableName);
      
      // テーブルの基本情報を確認
      const rowCount = await tbl.countRows();
      console.log(`テーブル '${tableName}' のレコード数: ${rowCount}件`);
      
      if (rowCount === 0) {
        throw new Error(`テーブル '${tableName}' にデータがありません`);
      }
      
    } catch (error) {
      console.error('テスト準備エラー:', error);
      throw error;
    }
  });
  
  test('RV-01: 実際のベクトルデータの確認', async () => {
    // サンプルレコードを取得
    const sampleRecords = await tbl.query().limit(3).toArray();
    
    expect(sampleRecords.length).toBeGreaterThan(0);
    
    // レコードの構造を確認
    const record = sampleRecords[0];
    console.log('サンプルレコード:', {
      id: record.id,
      title: record.title,
      vectorLength: Array.isArray(record.vector) ? record.vector.length : 'N/A',
      hasContent: !!record.content,
      hasLabels: !!record.labels
    });
    
    // 必要なフィールドが存在することを確認
    expect(record).toHaveProperty('id');
    expect(record).toHaveProperty('vector');
    expect(record).toHaveProperty('title');
    
    // ベクトルの次元数を確認
    if (Array.isArray(record.vector)) {
      expect(record.vector.length).toBeGreaterThan(0);
      console.log(`ベクトル次元数: ${record.vector.length}`);
    }
  });
  
  test('RV-02: 実際のクエリでのベクトル検索テスト', async () => {
    const testQueries = [
      '教室管理の詳細は',
      '教室コピー機能でコピー可能な項目は？',
      'オファー機能の種類と使い方は？'
    ];
    
    for (const query of testQueries) {
      console.log(`\n--- クエリ: "${query}" ---`);
      
      try {
        // 実際の埋め込みベクトルを生成
        const vector = await getEmbeddings(query);
        console.log(`埋め込みベクトル生成完了: ${vector.length}次元`);
        
        // ベクトル検索を実行
        const results = await tbl.search(vector).limit(10).toArray();
        
        expect(results.length).toBeGreaterThan(0);
        console.log(`検索結果数: ${results.length}件`);
        
        // 上位3件の結果を表示
        results.slice(0, 3).forEach((result, index) => {
          console.log(`${index + 1}. ${result.title}`);
          console.log(`   距離: ${result._distance?.toFixed(4) || 'N/A'}`);
          console.log(`   ID: ${result.id}`);
        });
        
        // 距離の妥当性を確認
        const distances = results.map(r => r._distance || 0);
        const minDistance = Math.min(...distances);
        const maxDistance = Math.max(...distances);
        
        console.log(`距離範囲: ${minDistance.toFixed(4)} - ${maxDistance.toFixed(4)}`);
        
        // 距離が適切な範囲内にあることを確認
        expect(minDistance).toBeGreaterThanOrEqual(0);
        expect(maxDistance).toBeLessThanOrEqual(2); // コサイン距離の最大値は2
        
      } catch (error) {
        console.error(`クエリ "${query}" のテストエラー:`, error);
        throw error;
      }
    }
  });
  
  test('RV-03: 検索結果の関連性評価', async () => {
    const query = '教室管理の詳細は';
    console.log(`\n--- 関連性評価テスト: "${query}" ---`);
    
    // 期待される関連ページのキーワード
    const expectedKeywords = ['教室管理', '教室一覧', '教室登録', '教室編集', '教室削除'];
    
    try {
      // 実際の埋め込みベクトルを生成
      const vector = await getEmbeddings(query);
      
      // ベクトル検索を実行
      const results = await tbl.search(vector).limit(20).toArray();
      
      expect(results.length).toBeGreaterThan(0);
      
      // 関連性の評価
      let relevantCount = 0;
      const relevantResults: any[] = [];
      
      results.forEach((result, index) => {
        const title = result.title || '';
        const content = result.content || '';
        const text = `${title} ${content}`.toLowerCase();
        
        // 期待されるキーワードが含まれているかチェック
        const hasRelevantKeyword = expectedKeywords.some(keyword => 
          text.includes(keyword.toLowerCase())
        );
        
        if (hasRelevantKeyword) {
          relevantCount++;
          relevantResults.push({
            rank: index + 1,
            title: result.title,
            distance: result._distance,
            hasKeyword: true
          });
        }
      });
      
      const relevanceRatio = relevantCount / results.length;
      console.log(`関連性評価結果:`);
      console.log(`- 総検索結果: ${results.length}件`);
      console.log(`- 関連結果: ${relevantCount}件`);
      console.log(`- 関連性比率: ${(relevanceRatio * 100).toFixed(1)}%`);
      
      // 関連性が50%以上であることを期待
      expect(relevanceRatio).toBeGreaterThanOrEqual(0.5);
      
      // 関連結果の詳細表示
      if (relevantResults.length > 0) {
        console.log(`\n関連結果:`);
        relevantResults.forEach(result => {
          console.log(`${result.rank}. ${result.title} (距離: ${result.distance?.toFixed(4)})`);
        });
      }
      
    } catch (error) {
      console.error('関連性評価テストエラー:', error);
      throw error;
    }
  });
  
  test('RV-04: 距離分布の分析', async () => {
    const query = '教室管理の詳細は';
    console.log(`\n--- 距離分布分析: "${query}" ---`);
    
    try {
      // 実際の埋め込みベクトルを生成
      const vector = await getEmbeddings(query);
      
      // より多くの結果を取得して距離分布を分析
      const results = await tbl.search(vector).limit(50).toArray();
      
      expect(results.length).toBeGreaterThan(0);
      
      // 距離の統計を計算
      const distances = results.map(r => r._distance || 0);
      const sortedDistances = [...distances].sort((a, b) => a - b);
      
      const min = sortedDistances[0];
      const max = sortedDistances[sortedDistances.length - 1];
      const median = sortedDistances[Math.floor(sortedDistances.length / 2)];
      const avg = distances.reduce((sum, d) => sum + d, 0) / distances.length;
      
      // 標準偏差を計算
      const variance = distances.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / distances.length;
      const stdDev = Math.sqrt(variance);
      
      console.log(`距離統計:`);
      console.log(`- 最小距離: ${min.toFixed(4)}`);
      console.log(`- 最大距離: ${max.toFixed(4)}`);
      console.log(`- 平均距離: ${avg.toFixed(4)}`);
      console.log(`- 中央値距離: ${median.toFixed(4)}`);
      console.log(`- 標準偏差: ${stdDev.toFixed(4)}`);
      
      // 距離の分布を分析
      const distanceRanges = [
        { min: 0, max: 0.2, label: '高類似 (0.0-0.2)' },
        { min: 0.2, max: 0.4, label: '中類似 (0.2-0.4)' },
        { min: 0.4, max: 0.6, label: '低類似 (0.4-0.6)' },
        { min: 0.6, max: 1.0, label: '非類似 (0.6-1.0)' }
      ];
      
      console.log(`\n距離分布:`);
      distanceRanges.forEach(range => {
        const count = distances.filter(d => d >= range.min && d < range.max).length;
        const percentage = (count / distances.length) * 100;
        console.log(`${range.label}: ${count}件 (${percentage.toFixed(1)}%)`);
      });
      
      // 距離の妥当性を確認
      expect(min).toBeGreaterThanOrEqual(0);
      expect(max).toBeLessThanOrEqual(2);
      expect(avg).toBeGreaterThan(0);
      expect(avg).toBeLessThan(1);
      
    } catch (error) {
      console.error('距離分布分析エラー:', error);
      throw error;
    }
  });
  
  test('RV-05: 複数クエリでの一貫性テスト', async () => {
    const testQueries = [
      '教室管理の詳細は',
      '教室管理機能について',
      '教室一覧機能の仕様'
    ];
    
    console.log(`\n--- 一貫性テスト ---`);
    
    const results: any[] = [];
    
    for (const query of testQueries) {
      try {
        // 実際の埋め込みベクトルを生成
        const vector = await getEmbeddings(query);
        
        // ベクトル検索を実行
        const searchResults = await tbl.search(vector).limit(10).toArray();
        
        results.push({
          query,
          resultCount: searchResults.length,
          avgDistance: searchResults.reduce((sum, r) => sum + (r._distance || 0), 0) / searchResults.length,
          topResults: searchResults.slice(0, 3).map(r => r.title)
        });
        
        console.log(`"${query}": ${searchResults.length}件, 平均距離: ${results[results.length - 1].avgDistance.toFixed(4)}`);
        
      } catch (error) {
        console.error(`クエリ "${query}" のエラー:`, error);
        throw error;
      }
    }
    
    // 一貫性の評価
    const avgDistances = results.map(r => r.avgDistance);
    const avgDistance = avgDistances.reduce((sum, d) => sum + d, 0) / avgDistances.length;
    const distanceVariance = avgDistances.reduce((sum, d) => sum + Math.pow(d - avgDistance, 2), 0) / avgDistances.length;
    const distanceStdDev = Math.sqrt(distanceVariance);
    
    console.log(`\n一貫性評価:`);
    console.log(`- 平均距離: ${avgDistance.toFixed(4)}`);
    console.log(`- 距離の標準偏差: ${distanceStdDev.toFixed(4)}`);
    console.log(`- 一貫性スコア: ${(1 - distanceStdDev / avgDistance).toFixed(3)}`);
    
    // 一貫性が0.7以上であることを期待
    const consistencyScore = 1 - distanceStdDev / avgDistance;
    expect(consistencyScore).toBeGreaterThanOrEqual(0.7);
    
  });
  
  test('RV-06: 統合検索クライアントのテスト', async () => {
    const query = '教室管理の詳細は';
    console.log(`\n--- 統合検索クライアントテスト: "${query}" ---`);
    
    try {
      // 統合検索クライアントを使用
      const results = await searchLanceDB({
        query,
        topK: 10,
        useLunrIndex: false, // ベクトル検索のみを使用
        labelFilters: {
          includeMeetingNotes: false,
          includeArchived: false,
          includeFolders: false
        }
      });
      
      expect(results.length).toBeGreaterThan(0);
      console.log(`統合検索結果数: ${results.length}件`);
      
      // 結果の構造を確認
      const result = results[0];
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('distance');
      expect(result).toHaveProperty('labels');
      
      // 上位3件の結果を表示
      results.slice(0, 3).forEach((result, index) => {
        console.log(`${index + 1}. ${result.title}`);
        console.log(`   スコア: ${result.score?.toFixed(2) || 'N/A'}`);
        console.log(`   距離: ${result.distance?.toFixed(4) || 'N/A'}`);
        console.log(`   ラベル: ${result.labels?.join(', ') || 'なし'}`);
      });
      
      // スコアの妥当性を確認
      const scores = results.map(r => r.score || 0);
      const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      console.log(`平均スコア: ${avgScore.toFixed(2)}`);
      
      expect(avgScore).toBeGreaterThan(0);
      expect(avgScore).toBeLessThanOrEqual(100);
      
    } catch (error) {
      console.error('統合検索クライアントテストエラー:', error);
      throw error;
    }
  });
  
  test('RV-07: パフォーマンステスト', async () => {
    const query = '教室管理の詳細は';
    console.log(`\n--- パフォーマンステスト: "${query}" ---`);
    
    try {
      // 実際の埋め込みベクトルを生成
      const vector = await getEmbeddings(query);
      
      // 複数回の検索を実行してパフォーマンスを測定
      const iterations = 10;
      const durations: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await tbl.search(vector).limit(10).toArray();
        const duration = Date.now() - start;
        durations.push(duration);
      }
      
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);
      
      console.log(`パフォーマンス結果:`);
      console.log(`- 平均検索時間: ${avgDuration.toFixed(2)}ms`);
      console.log(`- 最小検索時間: ${minDuration}ms`);
      console.log(`- 最大検索時間: ${maxDuration}ms`);
      
      // 検索が平均200ms以内に完了することを期待
      expect(avgDuration).toBeLessThan(200);
      
    } catch (error) {
      console.error('パフォーマンステストエラー:', error);
      throw error;
    }
  });
});

// テスト実行用のメイン関数
async function runRealVectorSearchTest(): Promise<void> {
  console.log('🔍 実際のベクトルファイルを使ったベクトル検索テスト開始');
  console.log('='.repeat(80));
  
  try {
    // LanceDBに接続
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tables = await db.tableNames();
    
    console.log('利用可能なテーブル:', tables);
    
    if (!tables.includes('confluence')) {
      throw new Error('テーブル "confluence" が見つかりません');
    }
    
    const tbl = await db.openTable('confluence');
    const rowCount = await tbl.countRows();
    
    console.log(`テーブル "confluence" のレコード数: ${rowCount}件`);
    
    if (rowCount === 0) {
      throw new Error('テーブル "confluence" にデータがありません');
    }
    
    // サンプルレコードを確認
    const sampleRecords = await tbl.query().limit(3).toArray();
    console.log('\nサンプルレコード:');
    sampleRecords.forEach((record, index) => {
      console.log(`${index + 1}. ${record.title}`);
      console.log(`   ID: ${record.id}`);
      console.log(`   ベクトル次元: ${Array.isArray(record.vector) ? record.vector.length : 'N/A'}`);
    });
    
    console.log('\n✅ 実際のベクトルファイルの確認完了');
    console.log('詳細なテストは vitest で実行してください:');
    console.log('npx vitest run src/tests/lancedb/real-vector-search-test.ts');
    
  } catch (error) {
    console.error('❌ テスト準備エラー:', error);
    process.exit(1);
  }
}

// テスト実行
if (require.main === module) {
  runRealVectorSearchTest();
}

export { runRealVectorSearchTest };
