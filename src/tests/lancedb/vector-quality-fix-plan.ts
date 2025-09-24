/**
 * ベクトル検索品質改善の段階的修正プラン
 * 
 * 優先順位に基づいて段階的に検査・修正を行います：
 * 1. 距離計算方法の修正（最優先）
 * 2. 距離閾値の最適化
 * 3. 埋め込みモデルの見直し
 * 4. クエリ前処理の改善
 * 5. ランキングアルゴリズムの最適化
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../../lib/embeddings';

interface FixPlan {
  step: number;
  title: string;
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  estimatedTime: string;
  expectedImprovement: string;
  testCases: string[];
  implementation: string[];
}

interface TestResult {
  step: number;
  title: string;
  before: {
    f1Score: number;
    precision: number;
    recall: number;
    ndcg: number;
    avgDistance: number;
  };
  after: {
    f1Score: number;
    precision: number;
    recall: number;
    ndcg: number;
    avgDistance: number;
  };
  improvement: {
    f1Score: number;
    precision: number;
    recall: number;
    ndcg: number;
    avgDistance: number;
  };
}

/**
 * 段階的修正プランを生成する
 */
function generateFixPlan(): FixPlan[] {
  return [
    {
      step: 1,
      title: '距離計算方法の修正',
      description: 'ユークリッド距離からコサイン距離に変更し、距離の分布を改善する',
      priority: 'HIGH',
      estimatedTime: '2-3時間',
      expectedImprovement: 'F1スコア: 0.036 → 0.3以上 (8倍改善)',
      testCases: [
        '教室管理の詳細は',
        '教室コピー機能でコピー可能な項目は？',
        'オファー機能の種類と使い方は？'
      ],
      implementation: [
        'LanceDBの距離計算方法をコサイン距離に変更',
        '距離の正規化を実装',
        '距離分布の分析と検証',
        'テストケースでの品質評価'
      ]
    },
    {
      step: 2,
      title: '距離閾値の最適化',
      description: '距離閾値を0.7から0.5に調整し、品質閾値を0.5から0.3に調整する',
      priority: 'HIGH',
      estimatedTime: '1-2時間',
      expectedImprovement: 'F1スコア: 0.3 → 0.5以上 (67%改善)',
      testCases: [
        '教室管理の詳細は',
        '教室コピー機能でコピー可能な項目は？',
        'オファー機能の種類と使い方は？'
      ],
      implementation: [
        '距離閾値の動的調整機能を実装',
        '品質閾値の最適化',
        '閾値による品質変化の分析',
        '最適な閾値の特定と実装'
      ]
    },
    {
      step: 3,
      title: '埋め込みモデルの見直し',
      description: '現在の384次元モデルをより適切な日本語対応モデルに変更する',
      priority: 'MEDIUM',
      estimatedTime: '4-6時間',
      expectedImprovement: 'F1スコア: 0.5 → 0.7以上 (40%改善)',
      testCases: [
        '教室管理の詳細は',
        '教室コピー機能でコピー可能な項目は？',
        'オファー機能の種類と使い方は？'
      ],
      implementation: [
        '日本語対応の埋め込みモデルの調査',
        'ドメイン特化型モデルの検討',
        'モデル比較テストの実施',
        '最適なモデルの選択と実装'
      ]
    },
    {
      step: 4,
      title: 'クエリ前処理の改善',
      description: 'キーワード抽出の最適化とクエリ拡張の実装',
      priority: 'MEDIUM',
      estimatedTime: '3-4時間',
      expectedImprovement: 'F1スコア: 0.7 → 0.8以上 (14%改善)',
      testCases: [
        '教室管理の詳細は',
        '教室コピー機能でコピー可能な項目は？',
        'オファー機能の種類と使い方は？'
      ],
      implementation: [
        'キーワード抽出アルゴリズムの改善',
        'クエリ拡張機能の実装',
        '同義語辞書の構築',
        '前処理パイプラインの最適化'
      ]
    },
    {
      step: 5,
      title: 'ランキングアルゴリズムの最適化',
      description: 'RRFとMMRの調整による結果の多様性と品質向上',
      priority: 'LOW',
      estimatedTime: '2-3時間',
      expectedImprovement: 'F1スコア: 0.8 → 0.9以上 (12%改善)',
      testCases: [
        '教室管理の詳細は',
        '教室コピー機能でコピー可能な項目は？',
        'オファー機能の種類と使い方は？'
      ],
      implementation: [
        'RRF（Reciprocal Rank Fusion）の重み調整',
        'MMR（Maximal Marginal Relevance）の最適化',
        '重み付けバランスの見直し',
        'ランキング品質の評価と調整'
      ]
    }
  ];
}

/**
 * 現在のベクトル検索品質を測定する
 */
async function measureCurrentQuality(query: string, expectedPages: string[]): Promise<{
  f1Score: number;
  precision: number;
  recall: number;
  ndcg: number;
  avgDistance: number;
}> {
  try {
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tbl = await db.openTable('confluence');
    
    const vector = await getEmbeddings(query);
    const results = await tbl.search(vector).limit(50).toArray();
    
    const distances = results.map(r => r._distance || 0);
    const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    
    const foundPages = results
      .map(r => r.title)
      .filter(title => expectedPages.some(expected => title?.includes(expected)));
    
    const precision = results.length > 0 ? foundPages.length / results.length : 0;
    const recall = expectedPages.length > 0 ? foundPages.length / expectedPages.length : 0;
    const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
    
    // NDCGの計算
    const actualOrder = results.map(r => r.title || '');
    const dcg = actualOrder.slice(0, 10).reduce((sum, item, index) => {
      const relevance = expectedPages.includes(item) ? 1 : 0;
      return sum + relevance / Math.log2(index + 2);
    }, 0);
    
    const idcg = expectedPages.slice(0, 10).reduce((sum, _, index) => {
      return sum + 1 / Math.log2(index + 2);
    }, 0);
    
    const ndcg = idcg > 0 ? dcg / idcg : 0;
    
    return {
      f1Score,
      precision,
      recall,
      ndcg,
      avgDistance
    };
    
  } catch (error) {
    console.error('品質測定エラー:', error);
    return {
      f1Score: 0,
      precision: 0,
      recall: 0,
      ndcg: 0,
      avgDistance: 0
    };
  }
}

/**
 * 修正プランを実行する
 */
async function executeFixPlan(): Promise<void> {
  console.log('🔧 ベクトル検索品質改善の段階的修正プラン');
  console.log('='.repeat(80));
  console.log(`開始時刻: ${new Date().toISOString()}`);
  
  const fixPlan = generateFixPlan();
  
  // 修正プランの表示
  console.log('\n📋 修正プラン概要');
  console.log('='.repeat(80));
  
  fixPlan.forEach(plan => {
    console.log(`\nステップ ${plan.step}: ${plan.title}`);
    console.log(`優先度: ${plan.priority}`);
    console.log(`予想時間: ${plan.estimatedTime}`);
    console.log(`期待改善: ${plan.expectedImprovement}`);
    console.log(`説明: ${plan.description}`);
    console.log(`実装項目:`);
    plan.implementation.forEach(item => {
      console.log(`  - ${item}`);
    });
  });
  
  // 現在の品質測定
  console.log('\n📊 現在の品質測定');
  console.log('='.repeat(80));
  
  const testCases = [
    {
      query: '教室管理の詳細は',
      expectedPages: [
        '160_【FIX】教室管理機能',
        '161_【FIX】教室一覧閲覧機能',
        '162_【FIX】教室新規登録機能',
        '163_【FIX】教室情報編集機能',
        '168_【FIX】教室コピー機能'
      ]
    },
    {
      query: '教室コピー機能でコピー可能な項目は？',
      expectedPages: [
        '168_【FIX】教室コピー機能',
        '教室コピー可能項目一覧',
        '教室コピー処理仕様',
        '【FIX】教室：基本情報／所在地',
        '【FIX】教室：応募情報転送連絡先／応募後連絡先電話番号'
      ]
    },
    {
      query: 'オファー機能の種類と使い方は？',
      expectedPages: [
        'オファー機能概要',
        'スカウトオファー機能',
        'マッチオファー機能',
        '共通オファー機能',
        'オファー通知機能'
      ]
    }
  ];
  
  const currentQuality = {
    f1Score: 0,
    precision: 0,
    recall: 0,
    ndcg: 0,
    avgDistance: 0
  };
  
  for (const testCase of testCases) {
    console.log(`\n--- ${testCase.query} ---`);
    const quality = await measureCurrentQuality(testCase.query, testCase.expectedPages);
    
    console.log(`F1スコア: ${quality.f1Score.toFixed(3)}`);
    console.log(`精度: ${quality.precision.toFixed(3)}`);
    console.log(`再現率: ${quality.recall.toFixed(3)}`);
    console.log(`NDCG: ${quality.ndcg.toFixed(3)}`);
    console.log(`平均距離: ${quality.avgDistance.toFixed(4)}`);
    
    currentQuality.f1Score += quality.f1Score;
    currentQuality.precision += quality.precision;
    currentQuality.recall += quality.recall;
    currentQuality.ndcg += quality.ndcg;
    currentQuality.avgDistance += quality.avgDistance;
  }
  
  // 平均値の計算
  const avgQuality = {
    f1Score: currentQuality.f1Score / testCases.length,
    precision: currentQuality.precision / testCases.length,
    recall: currentQuality.recall / testCases.length,
    ndcg: currentQuality.ndcg / testCases.length,
    avgDistance: currentQuality.avgDistance / testCases.length
  };
  
  console.log(`\n--- 現在の平均品質 ---`);
  console.log(`平均F1スコア: ${avgQuality.f1Score.toFixed(3)}`);
  console.log(`平均精度: ${avgQuality.precision.toFixed(3)}`);
  console.log(`平均再現率: ${avgQuality.recall.toFixed(3)}`);
  console.log(`平均NDCG: ${avgQuality.ndcg.toFixed(3)}`);
  console.log(`平均距離: ${avgQuality.avgDistance.toFixed(4)}`);
  
  // 修正の優先順位
  console.log('\n🎯 修正の優先順位');
  console.log('='.repeat(80));
  
  console.log('\n1. 【最優先】距離計算方法の修正');
  console.log('   理由: 最小距離0.5213が高すぎる（目標: 0.3以下）');
  console.log('   対策: ユークリッド距離 → コサイン距離');
  console.log('   期待効果: F1スコア 0.036 → 0.3以上');
  
  console.log('\n2. 【高優先】距離閾値の最適化');
  console.log('   理由: 品質閾値0.8070が高すぎる（目標: 0.5以下）');
  console.log('   対策: 閾値を0.7→0.5、品質閾値を0.5→0.3に調整');
  console.log('   期待効果: F1スコア 0.3 → 0.5以上');
  
  console.log('\n3. 【中優先】埋め込みモデルの見直し');
  console.log('   理由: 日本語技術文書に対する表現力不足');
  console.log('   対策: より適切な日本語対応モデルの選択');
  console.log('   期待効果: F1スコア 0.5 → 0.7以上');
  
  console.log('\n4. 【中優先】クエリ前処理の改善');
  console.log('   理由: キーワード抽出の精度が低い');
  console.log('   対策: キーワード抽出の最適化とクエリ拡張');
  console.log('   期待効果: F1スコア 0.7 → 0.8以上');
  
  console.log('\n5. 【低優先】ランキングアルゴリズムの最適化');
  console.log('   理由: 結果の多様性と品質の向上');
  console.log('   対策: RRFとMMRの調整');
  console.log('   期待効果: F1スコア 0.8 → 0.9以上');
  
  // 具体的な実装手順
  console.log('\n🛠️ 具体的な実装手順');
  console.log('='.repeat(80));
  
  console.log('\n【ステップ1: 距離計算方法の修正】');
  console.log('1. LanceDBの設定を確認');
  console.log('2. コサイン距離への変更を実装');
  console.log('3. 距離分布の分析と検証');
  console.log('4. テストケースでの品質評価');
  console.log('5. 改善効果の測定');
  
  console.log('\n【ステップ2: 距離閾値の最適化】');
  console.log('1. 現在の閾値設定を確認');
  console.log('2. 動的閾値調整機能を実装');
  console.log('3. 閾値による品質変化の分析');
  console.log('4. 最適な閾値の特定');
  console.log('5. 新しい閾値でのテスト');
  
  console.log('\n【ステップ3: 埋め込みモデルの見直し】');
  console.log('1. 日本語対応モデルの調査');
  console.log('2. ドメイン特化型モデルの検討');
  console.log('3. モデル比較テストの実施');
  console.log('4. 最適なモデルの選択');
  console.log('5. 新しいモデルでのテスト');
  
  console.log('\n【ステップ4: クエリ前処理の改善】');
  console.log('1. 現在のキーワード抽出を分析');
  console.log('2. 改善されたアルゴリズムを実装');
  console.log('3. クエリ拡張機能を追加');
  console.log('4. 同義語辞書を構築');
  console.log('5. 前処理パイプラインを最適化');
  
  console.log('\n【ステップ5: ランキングアルゴリズムの最適化】');
  console.log('1. 現在のRRF設定を分析');
  console.log('2. 重み付けを調整');
  console.log('3. MMRの最適化');
  console.log('4. ランキング品質を評価');
  console.log('5. 最終的な調整');
  
  // 成功指標
  console.log('\n📈 成功指標');
  console.log('='.repeat(80));
  
  console.log('\n【目標値】');
  console.log('F1スコア: 0.036 → 0.9以上 (25倍改善)');
  console.log('NDCG: 0.149 → 0.9以上 (6倍改善)');
  console.log('精度: 0.020 → 0.9以上 (45倍改善)');
  console.log('再現率: 0.200 → 0.9以上 (4.5倍改善)');
  console.log('平均距離: 0.8602 → 0.3以下 (65%改善)');
  
  console.log('\n【段階的目標】');
  console.log('ステップ1完了後: F1スコア 0.3以上');
  console.log('ステップ2完了後: F1スコア 0.5以上');
  console.log('ステップ3完了後: F1スコア 0.7以上');
  console.log('ステップ4完了後: F1スコア 0.8以上');
  console.log('ステップ5完了後: F1スコア 0.9以上');
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ 修正プラン完了');
  console.log('次のステップ: ステップ1（距離計算方法の修正）から開始');
}

// テスト実行
if (require.main === module) {
  executeFixPlan();
}

export { executeFixPlan };
