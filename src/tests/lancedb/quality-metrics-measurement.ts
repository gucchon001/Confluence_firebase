/**
 * 品質メトリクスの測定
 * 
 * 現在のベクトル検索の品質を具体的な数値で測定する
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../../lib/embeddings';
import { searchLanceDB } from '../../lib/lancedb-search-client';

/**
 * 品質メトリクスの測定
 */
async function measureQualityMetrics(): Promise<void> {
  console.log('📊 品質メトリクスの測定');
  console.log('='.repeat(80));
  console.log(`開始時刻: ${new Date().toISOString()}`);
  
  try {
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tbl = await db.openTable('confluence');
    
    // 1. データ状況の確認
    console.log(`\n=== 1. データ状況の確認 ===`);
    const totalCount = await tbl.countRows();
    console.log(`総レコード数: ${totalCount}`);
    
    // 2. テストクエリの定義
    console.log(`\n=== 2. テストクエリの定義 ===`);
    
    const testQueries = [
      {
        query: '教室管理',
        expectedResults: [
          'classroom-001', 'classroom-002', 'classroom-003', 'classroom-004', 'classroom-005',
          'classroom-006', 'classroom-007', 'classroom-008', 'classroom-009', 'classroom-010'
        ],
        description: '教室管理関連の検索'
      },
      {
        query: 'ユーザー登録',
        expectedResults: [
          'user-001', 'user-002', 'user-003', 'user-004', 'user-005',
          'user-006', 'user-007', 'user-008', 'user-009', 'user-010'
        ],
        description: 'ユーザー管理関連の検索'
      },
      {
        query: '契約管理',
        expectedResults: [
          'contract-001', 'contract-002', 'contract-003', 'contract-004', 'contract-005',
          'contract-006', 'contract-007', 'contract-008', 'contract-009', 'contract-010'
        ],
        description: '契約管理関連の検索'
      },
      {
        query: '採用フロー',
        expectedResults: [
          'recruitment-001', 'recruitment-002', 'recruitment-003', 'recruitment-004', 'recruitment-005',
          'recruitment-006', 'recruitment-007', 'recruitment-008', 'recruitment-009', 'recruitment-010'
        ],
        description: '採用管理関連の検索'
      },
      {
        query: 'メール通知',
        expectedResults: [
          'email-001', 'email-002', 'email-003', 'email-004', 'email-005',
          'email-006', 'email-007', 'email-008', 'email-009', 'email-010'
        ],
        description: 'メール通知関連の検索'
      }
    ];
    
    // 3. 各クエリでの品質測定
    console.log(`\n=== 3. 各クエリでの品質測定 ===`);
    
    const results = [];
    
    for (const testQuery of testQueries) {
      console.log(`\n--- ${testQuery.description} ---`);
      console.log(`クエリ: "${testQuery.query}"`);
      
      try {
        // ベクトル検索の実行
        const searchResults = await searchLanceDB({
          query: testQuery.query,
          topK: 10,
          maxDistance: 1.0, // 修正: 実際の距離分布に基づく閾値
          qualityThreshold: 0.8 // 修正: 高品質結果のフィルタリング
        });
        
        console.log(`検索結果数: ${searchResults.length}`);
        
        // 結果の分析
        const foundIds = searchResults.map(r => r.id);
        const expectedIds = testQuery.expectedResults;
        
        // True Positives (正解)
        const truePositives = foundIds.filter(id => expectedIds.includes(id));
        
        // False Positives (誤検出)
        const falsePositives = foundIds.filter(id => !expectedIds.includes(id));
        
        // False Negatives (見逃し)
        const falseNegatives = expectedIds.filter(id => !foundIds.includes(id));
        
        // メトリクスの計算
        const precision = truePositives.length / (truePositives.length + falsePositives.length) || 0;
        const recall = truePositives.length / (truePositives.length + falseNegatives.length) || 0;
        const f1Score = 2 * (precision * recall) / (precision + recall) || 0;
        
        // 距離の分析
        const distances = searchResults.map(r => r._distance || 0);
        const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length || 0;
        const minDistance = Math.min(...distances);
        const maxDistance = Math.max(...distances);
        
        const result = {
          query: testQuery.query,
          description: testQuery.description,
          totalResults: searchResults.length,
          truePositives: truePositives.length,
          falsePositives: falsePositives.length,
          falseNegatives: falseNegatives.length,
          precision: precision,
          recall: recall,
          f1Score: f1Score,
          avgDistance: avgDistance,
          minDistance: minDistance,
          maxDistance: maxDistance,
          foundIds: foundIds,
          expectedIds: expectedIds
        };
        
        results.push(result);
        
        // 結果の表示
        console.log(`✅ 正解: ${truePositives.length}件`);
        console.log(`❌ 誤検出: ${falsePositives.length}件`);
        console.log(`⚠️ 見逃し: ${falseNegatives.length}件`);
        console.log(`📊 Precision: ${precision.toFixed(3)}`);
        console.log(`📊 Recall: ${recall.toFixed(3)}`);
        console.log(`📊 F1 Score: ${f1Score.toFixed(3)}`);
        console.log(`📏 平均距離: ${avgDistance.toFixed(4)}`);
        console.log(`📏 最小距離: ${minDistance.toFixed(4)}`);
        console.log(`📏 最大距離: ${maxDistance.toFixed(4)}`);
        
        // 詳細結果の表示
        console.log(`\n--- 検索結果詳細 ---`);
        for (const result of searchResults) {
          console.log(`  ${result.id}: ${result.title} (距離: ${result._distance?.toFixed(4) || 'N/A'})`);
        }
        
      } catch (error) {
        console.error(`❌ クエリ "${testQuery.query}" の処理エラー:`, error);
      }
    }
    
    // 4. 全体の品質サマリー
    console.log(`\n=== 4. 全体の品質サマリー ===`);
    
    const avgPrecision = results.reduce((sum, r) => sum + r.precision, 0) / results.length;
    const avgRecall = results.reduce((sum, r) => sum + r.recall, 0) / results.length;
    const avgF1Score = results.reduce((sum, r) => sum + r.f1Score, 0) / results.length;
    const avgDistance = results.reduce((sum, r) => sum + r.avgDistance, 0) / results.length;
    
    console.log(`📊 平均 Precision: ${avgPrecision.toFixed(3)}`);
    console.log(`📊 平均 Recall: ${avgRecall.toFixed(3)}`);
    console.log(`📊 平均 F1 Score: ${avgF1Score.toFixed(3)}`);
    console.log(`📏 平均距離: ${avgDistance.toFixed(4)}`);
    
    // 5. 改善の判定
    console.log(`\n=== 5. 改善の判定 ===`);
    
    const qualityThresholds = {
      excellent: { precision: 0.9, recall: 0.9, f1Score: 0.9 },
      good: { precision: 0.7, recall: 0.7, f1Score: 0.7 },
      fair: { precision: 0.5, recall: 0.5, f1Score: 0.5 },
      poor: { precision: 0.3, recall: 0.3, f1Score: 0.3 }
    };
    
    let qualityLevel = 'poor';
    if (avgF1Score >= qualityThresholds.excellent.f1Score) {
      qualityLevel = 'excellent';
    } else if (avgF1Score >= qualityThresholds.good.f1Score) {
      qualityLevel = 'good';
    } else if (avgF1Score >= qualityThresholds.fair.f1Score) {
      qualityLevel = 'fair';
    }
    
    console.log(`🎯 品質レベル: ${qualityLevel.toUpperCase()}`);
    console.log(`📈 改善状況: ${avgF1Score >= 0.7 ? '✅ 良好' : avgF1Score >= 0.5 ? '⚠️ 改善中' : '❌ 要改善'}`);
    
    // 6. 推奨事項
    console.log(`\n=== 6. 推奨事項 ===`);
    
    if (avgPrecision < 0.7) {
      console.log(`🔧 Precision改善: 距離閾値を調整 (現在: 1.0)`);
    }
    if (avgRecall < 0.7) {
      console.log(`🔧 Recall改善: 品質閾値を調整 (現在: 0.8)`);
    }
    if (avgDistance > 0.8) {
      console.log(`🔧 距離改善: 埋め込みモデルの見直し`);
    }
    
  } catch (error) {
    console.error('❌ 品質メトリクス測定エラー:', error);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ 品質メトリクス測定完了');
}

if (require.main === module) {
  measureQualityMetrics();
}

export { measureQualityMetrics };
