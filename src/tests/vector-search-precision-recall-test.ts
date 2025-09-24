/**
 * ベクトル検索の精度・再現率・F1スコアを詳細に計算するテストスクリプト
 * 
 * このテストは以下の項目を詳細に評価します：
 * 1. 真陽性（True Positive）の詳細分析
 * 2. 偽陽性（False Positive）の詳細分析
 * 3. 偽陰性（False Negative）の詳細分析
 * 4. 精度・再現率・F1スコアの詳細計算
 * 5. 各クエリでの性能比較
 */

import 'dotenv/config';
import { searchLanceDB } from '../lib/lancedb-search-client';

interface GroundTruth {
  query: string;
  relevantPages: string[];
  irrelevantPages: string[];
  description: string;
}

interface DetailedMetrics {
  query: string;
  truePositives: string[];
  falsePositives: string[];
  falseNegatives: string[];
  precision: number;
  recall: number;
  f1Score: number;
  averageScore: number;
  totalResults: number;
  relevantTotal: number;
}

const GROUND_TRUTH_DATA: GroundTruth[] = [
  {
    query: '教室管理の詳細は',
    relevantPages: [
      '160_【FIX】教室管理機能',
      '161_【FIX】教室一覧閲覧機能',
      '162_【FIX】教室新規登録機能',
      '163_【FIX】教室情報編集機能',
      '168_【FIX】教室コピー機能',
      '169-1_【FIX】教室掲載フラグ切り替え機能',
      '169-2_【FIX】教室公開フラグ切り替え機能',
      '164_【FIX】教室削除機能',
      '511_【FIX】教室管理-求人一覧閲覧機能',
      '512_【FIX】教室管理-求人情報新規登録機能',
      '513_【FIX】教室管理-求人情報編集機能',
      '514_【レビュー中】教室管理-求人削除機能',
      '515_【作成中】教室管理-教室コピー機能',
      '516_【FIX】教室管理-一括更新機能',
      '【FIX】教室：基本情報／所在地',
      '【FIX】教室：応募情報転送連絡先／応募後連絡先電話番号',
      '【FIX】教室：塾チャート',
      '【FIX】教室：ロゴ・スライド画像'
    ],
    irrelevantPages: [
      '500_■教室管理機能',
      '510_■教室管理-求人管理機能',
      '010_■求人・教室管理機能',
      '塾講師ステーションドキュメントスペース',
      '710_■教室・求人情報関連バッチ',
      '910_■企業・教室グループ・教室',
      'レコメンドデータ',
      '教室アクセスデータ',
      '【作成中】塾チャート'
    ],
    description: '教室管理機能の詳細仕様に関する検索'
  },
  {
    query: '教室コピー機能でコピー可能な項目は？',
    relevantPages: [
      '168_【FIX】教室コピー機能',
      '教室コピー可能項目一覧',
      '教室コピー処理仕様',
      '【FIX】教室：基本情報／所在地',
      '【FIX】教室：応募情報転送連絡先／応募後連絡先電話番号',
      '【FIX】教室：塾チャート',
      '【FIX】教室：ロゴ・スライド画像',
      '【FIX】求人：基本情報',
      '【FIX】求人：勤務条件・指導科目',
      '【FIX】求人：応募条件・研修情報',
      '【FIX】求人：応募情報等',
      '【FIX】求人：PR情報',
      '163_【FIX】教室情報編集機能',
      '教室情報編集機能（基本情報タブ）',
      '教室情報編集機能（応募情報タブ）',
      '求人情報編集機能（基本情報タブ）',
      '求人情報編集機能（勤務条件タブ）',
      '求人情報編集機能（応募条件タブ）',
      '求人情報編集機能（応募情報タブ）',
      '求人情報編集機能（PR情報タブ）',
      '教室コピー制限事項',
      '画像コピー制限',
      'コピー件数制限',
      '非同期コピー処理',
      '教室コピー処理挙動',
      '求人数によるコピー挙動',
      '教室プラン設定'
    ],
    irrelevantPages: [
      '■教室管理機能',
      '■コピー機能',
      '■教室情報管理',
      '教室統計データ',
      '教室作成ログ',
      '【作成中】教室削除機能',
      '教室削除機能',
      '教室復元機能'
    ],
    description: '教室コピー機能のコピー可能項目に関する検索'
  },
  {
    query: 'オファー機能の種類と使い方は？',
    relevantPages: [
      'オファー機能概要',
      'スカウトオファー機能',
      'マッチオファー機能',
      '共通オファー機能',
      'オファー通知機能',
      'オファー管理機能',
      'スカウトオファー送信機能',
      'マッチオファー送信機能',
      'オファー受信機能',
      'オファー返信機能',
      'オファー履歴機能',
      'オファー統計機能'
    ],
    irrelevantPages: [
      '■オファー機能',
      'オファー統計データ',
      'オファーログ',
      '【作成中】オファー機能',
      '求人管理機能',
      '教室管理機能',
      '会員管理機能'
    ],
    description: 'オファー機能の種類と使用方法に関する検索'
  }
];

/**
 * ページタイトルの類似度を計算する（部分マッチング）
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  const normalize = (str: string) => str.toLowerCase().replace(/[^\w\u3040-\u309f\u30a0-\u30ff]/g, '');
  const norm1 = normalize(title1);
  const norm2 = normalize(title2);
  
  // 完全一致
  if (norm1 === norm2) return 1.0;
  
  // 部分一致（一方が他方に含まれる）
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.8;
  
  // キーワード一致
  const words1 = norm1.split(/\s+/);
  const words2 = norm2.split(/\s+/);
  const commonWords = words1.filter(word => words2.includes(word));
  
  if (commonWords.length > 0) {
    return commonWords.length / Math.max(words1.length, words2.length);
  }
  
  return 0;
}

/**
 * 検索結果から関連ページを特定する
 */
function findRelevantPages(searchResults: any[], relevantPages: string[]): string[] {
  const found: string[] = [];
  
  for (const result of searchResults) {
    for (const relevantPage of relevantPages) {
      const similarity = calculateTitleSimilarity(result.title, relevantPage);
      if (similarity >= 0.6) { // 60%以上の類似度で関連とみなす
        found.push(result.title);
        break;
      }
    }
  }
  
  return found;
}

/**
 * 検索結果から無関連ページを特定する
 */
function findIrrelevantPages(searchResults: any[], irrelevantPages: string[]): string[] {
  const found: string[] = [];
  
  for (const result of searchResults) {
    for (const irrelevantPage of irrelevantPages) {
      const similarity = calculateTitleSimilarity(result.title, irrelevantPage);
      if (similarity >= 0.6) { // 60%以上の類似度で無関連とみなす
        found.push(result.title);
        break;
      }
    }
  }
  
  return found;
}

/**
 * 詳細な精度・再現率・F1スコアを計算する
 */
async function calculateDetailedMetrics(groundTruth: GroundTruth): Promise<DetailedMetrics> {
  console.log(`\n=== 詳細メトリクス計算: "${groundTruth.query}" ===`);
  console.log(`説明: ${groundTruth.description}`);
  
  try {
    // ベクトル検索を実行
    const searchResults = await searchLanceDB({
      query: groundTruth.query,
      topK: 30, // より多くの結果を取得
      useLunrIndex: false, // ベクトル検索のみを使用
      labelFilters: {
        includeMeetingNotes: false,
        includeArchived: false,
        includeFolders: false
      }
    });
    
    console.log(`検索結果数: ${searchResults.length}件`);
    console.log(`関連ページ総数: ${groundTruth.relevantPages.length}件`);
    console.log(`無関連ページ総数: ${groundTruth.irrelevantPages.length}件`);
    
    // 真陽性（True Positive）: 検索結果に含まれ、かつ関連であるページ
    const truePositives = findRelevantPages(searchResults, groundTruth.relevantPages);
    
    // 偽陽性（False Positive）: 検索結果に含まれ、かつ無関連であるページ
    const falsePositives = findIrrelevantPages(searchResults, groundTruth.irrelevantPages);
    
    // 偽陰性（False Negative）: 検索結果に含まれないが、関連であるページ
    const foundRelevantTitles = truePositives.map(tp => {
      // 元の関連ページリストから対応するタイトルを見つける
      for (const relevantPage of groundTruth.relevantPages) {
        if (calculateTitleSimilarity(tp, relevantPage) >= 0.6) {
          return relevantPage;
        }
      }
      return tp;
    });
    
    const falseNegatives = groundTruth.relevantPages.filter(relevantPage => 
      !foundRelevantTitles.some(found => 
        calculateTitleSimilarity(found, relevantPage) >= 0.6
      )
    );
    
    // メトリクスを計算
    const precision = searchResults.length > 0 ? truePositives.length / searchResults.length : 0;
    const recall = groundTruth.relevantPages.length > 0 ? truePositives.length / groundTruth.relevantPages.length : 0;
    const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
    const averageScore = searchResults.length > 0 ? 
      searchResults.reduce((sum, r) => sum + (r.score || 0), 0) / searchResults.length : 0;
    
    console.log(`\n--- 詳細分析結果 ---`);
    console.log(`真陽性 (TP): ${truePositives.length}件`);
    console.log(`偽陽性 (FP): ${falsePositives.length}件`);
    console.log(`偽陰性 (FN): ${falseNegatives.length}件`);
    console.log(`精度 (Precision): ${precision.toFixed(3)}`);
    console.log(`再現率 (Recall): ${recall.toFixed(3)}`);
    console.log(`F1スコア: ${f1Score.toFixed(3)}`);
    console.log(`平均スコア: ${averageScore.toFixed(2)}`);
    
    // 真陽性の詳細表示
    if (truePositives.length > 0) {
      console.log(`\n--- 真陽性ページ (${truePositives.length}件) ---`);
      truePositives.forEach((tp, index) => {
        console.log(`${index + 1}. ${tp}`);
      });
    }
    
    // 偽陽性の詳細表示
    if (falsePositives.length > 0) {
      console.log(`\n--- 偽陽性ページ (${falsePositives.length}件) ---`);
      falsePositives.forEach((fp, index) => {
        console.log(`${index + 1}. ${fp}`);
      });
    }
    
    // 偽陰性の詳細表示
    if (falseNegatives.length > 0) {
      console.log(`\n--- 偽陰性ページ (${falseNegatives.length}件) ---`);
      falseNegatives.forEach((fn, index) => {
        console.log(`${index + 1}. ${fn}`);
      });
    }
    
    return {
      query: groundTruth.query,
      truePositives,
      falsePositives,
      falseNegatives,
      precision,
      recall,
      f1Score,
      averageScore,
      totalResults: searchResults.length,
      relevantTotal: groundTruth.relevantPages.length
    };
    
  } catch (error) {
    console.error(`メトリクス計算エラー: ${error}`);
    return {
      query: groundTruth.query,
      truePositives: [],
      falsePositives: [],
      falseNegatives: [],
      precision: 0,
      recall: 0,
      f1Score: 0,
      averageScore: 0,
      totalResults: 0,
      relevantTotal: groundTruth.relevantPages.length
    };
  }
}

/**
 * 全体的な性能分析を実行する
 */
async function runOverallPerformanceAnalysis(): Promise<void> {
  console.log('\n=== 全体的な性能分析 ===');
  
  const allMetrics: DetailedMetrics[] = [];
  
  for (const groundTruth of GROUND_TRUTH_DATA) {
    const metrics = await calculateDetailedMetrics(groundTruth);
    allMetrics.push(metrics);
  }
  
  // 全体の統計を計算
  const totalTP = allMetrics.reduce((sum, m) => sum + m.truePositives.length, 0);
  const totalFP = allMetrics.reduce((sum, m) => sum + m.falsePositives.length, 0);
  const totalFN = allMetrics.reduce((sum, m) => sum + m.falseNegatives.length, 0);
  const totalResults = allMetrics.reduce((sum, m) => sum + m.totalResults, 0);
  const totalRelevant = allMetrics.reduce((sum, m) => sum + m.relevantTotal, 0);
  
  const overallPrecision = totalResults > 0 ? totalTP / totalResults : 0;
  const overallRecall = totalRelevant > 0 ? totalTP / totalRelevant : 0;
  const overallF1Score = overallPrecision + overallRecall > 0 ? 
    2 * (overallPrecision * overallRecall) / (overallPrecision + overallRecall) : 0;
  
  const avgPrecision = allMetrics.reduce((sum, m) => sum + m.precision, 0) / allMetrics.length;
  const avgRecall = allMetrics.reduce((sum, m) => sum + m.recall, 0) / allMetrics.length;
  const avgF1Score = allMetrics.reduce((sum, m) => sum + m.f1Score, 0) / allMetrics.length;
  const avgScore = allMetrics.reduce((sum, m) => sum + m.averageScore, 0) / allMetrics.length;
  
  console.log(`\n--- 全体統計 ---`);
  console.log(`総真陽性: ${totalTP}件`);
  console.log(`総偽陽性: ${totalFP}件`);
  console.log(`総偽陰性: ${totalFN}件`);
  console.log(`総検索結果: ${totalResults}件`);
  console.log(`総関連ページ: ${totalRelevant}件`);
  
  console.log(`\n--- 全体メトリクス ---`);
  console.log(`全体精度: ${overallPrecision.toFixed(3)}`);
  console.log(`全体再現率: ${overallRecall.toFixed(3)}`);
  console.log(`全体F1スコア: ${overallF1Score.toFixed(3)}`);
  
  console.log(`\n--- 平均メトリクス ---`);
  console.log(`平均精度: ${avgPrecision.toFixed(3)}`);
  console.log(`平均再現率: ${avgRecall.toFixed(3)}`);
  console.log(`平均F1スコア: ${avgF1Score.toFixed(3)}`);
  console.log(`平均スコア: ${avgScore.toFixed(2)}`);
  
  // 性能評価
  console.log(`\n--- 性能評価 ---`);
  if (overallPrecision >= 0.8) {
    console.log('✅ 精度: 良好 (>= 0.8)');
  } else if (overallPrecision >= 0.6) {
    console.log('⚠️ 精度: 普通 (0.6-0.8)');
  } else {
    console.log('❌ 精度: 低い (< 0.6)');
  }
  
  if (overallRecall >= 0.7) {
    console.log('✅ 再現率: 良好 (>= 0.7)');
  } else if (overallRecall >= 0.5) {
    console.log('⚠️ 再現率: 普通 (0.5-0.7)');
  } else {
    console.log('❌ 再現率: 低い (< 0.5)');
  }
  
  if (overallF1Score >= 0.75) {
    console.log('✅ F1スコア: 良好 (>= 0.75)');
  } else if (overallF1Score >= 0.6) {
    console.log('⚠️ F1スコア: 普通 (0.6-0.75)');
  } else {
    console.log('❌ F1スコア: 低い (< 0.6)');
  }
}

/**
 * メインテスト実行関数
 */
async function runPrecisionRecallTest(): Promise<void> {
  console.log('🚀 ベクトル検索精度・再現率テスト開始');
  console.log('='.repeat(60));
  console.log(`テスト実行時刻: ${new Date().toISOString()}`);
  
  try {
    // 詳細メトリクス計算
    await runOverallPerformanceAnalysis();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ ベクトル検索精度・再現率テスト完了');
    
  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
    process.exit(1);
  }
}

// テスト実行
if (require.main === module) {
  runPrecisionRecallTest();
}

export { runPrecisionRecallTest, calculateDetailedMetrics };
