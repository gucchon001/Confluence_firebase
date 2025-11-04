/**
 * 複合スコアリングサービス（Phase 0A-4）
 * 
 * 複数の検索信号を統合的に評価し、最適なランキングを生成
 * 参考: 
 * - https://zenn.dev/yumefuku/articles/llm-neo4j-hybrid
 * - https://actionbridge.io/ja-JP/llmtutorial/p/llm-rag-chapter7-2-hybrid-multivector-search
 */

import { calculateLabelMatchScore } from './structured-label-scorer';
import { GENERIC_DOCUMENT_TERMS, CommonTermsHelper } from './common-terms-config';
import { searchLogger } from './search-logger';

export interface SearchSignals {
  vectorDistance: number;      // ベクトル距離（小さいほど良い）
  bm25Score: number;            // BM25スコア（大きいほど良い）
  titleMatchRatio: number;      // タイトルマッチ率（0-1）
  labelScore: number;           // ラベルスコア（0-1）
  kgBoost?: number;             // KGブーストスコア（0-1、Phase 4）
  pageRank?: number;            // ページランク（オプション）
}

export interface CompositeScore {
  finalScore: number;
  breakdown: {
    vectorContribution: number;
    bm25Contribution: number;
    titleContribution: number;
    labelContribution: number;
    kgContribution?: number;  // Phase 4: KGブースト
  };
}

/**
 * 複合スコアリング設定
 */
export interface CompositeScoreConfig {
  vectorWeight: number;     // デフォルト: 0.4
  bm25Weight: number;       // デフォルト: 0.3
  titleWeight: number;      // デフォルト: 0.2
  labelWeight: number;      // デフォルト: 0.1
  kgWeight: number;         // デフォルト: 0.05 (Phase 4)
  
  // 正規化パラメータ
  maxVectorDistance: number;  // デフォルト: 2.0
  maxBm25Score: number;       // デフォルト: 10.0
}

const DEFAULT_CONFIG: CompositeScoreConfig = {
  // Phase 0A-2改善: ベクトル空間変化対策
  // BM25（50%）+ タイトル（25%）+ ラベル（15%）+ ベクトル（5%）+ KG（5%）= 100%
  // 理由: 70ページ除外によりベクトル空間が変化したため、BM25とタイトルを最優先
  vectorWeight: 0.05,   // ベクトル: 5%（最小化：空間変化の影響を軽減）
  bm25Weight: 0.50,     // BM25: 50%（最優先：キーワード完全一致）
  titleWeight: 0.25,    // タイトル: 25%（強化：タイトルマッチを重視）
  labelWeight: 0.15,    // ラベル: 15%（強化：StructuredLabel活用）
  kgWeight: 0.05,       // KG: 5%（Phase 4: 参照関係ブースト）
  maxVectorDistance: 2.0,
  maxBm25Score: 30.0,   // 10.0→30.0: BM25高スコア（keyword=22など）を適切に評価
};

/**
 * 複合スコアリングサービス
 */
export class CompositeScoringService {
  private static instance: CompositeScoringService;
  private config: CompositeScoreConfig;
  
  private constructor(config?: Partial<CompositeScoreConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  public static getInstance(config?: Partial<CompositeScoreConfig>): CompositeScoringService {
    if (!CompositeScoringService.instance) {
      CompositeScoringService.instance = new CompositeScoringService(config);
    }
    return CompositeScoringService.instance;
  }
  
  /**
   * 複合スコアを計算
   */
  public calculateCompositeScore(signals: SearchSignals): CompositeScore {
    const { vectorWeight, bm25Weight, titleWeight, labelWeight, kgWeight, maxVectorDistance, maxBm25Score } = this.config;
    
    // 各信号を0-1に正規化
    const normalizedVector = 1.0 - Math.min(signals.vectorDistance / maxVectorDistance, 1.0);
    const normalizedBm25 = Math.min(signals.bm25Score / maxBm25Score, 1.0);
    const normalizedTitle = signals.titleMatchRatio;
    const normalizedLabel = signals.labelScore;
    const normalizedKg = signals.kgBoost || 0;  // Phase 4: KGブースト
    
    // 重み付き合計
    const vectorContribution = normalizedVector * vectorWeight;
    const bm25Contribution = normalizedBm25 * bm25Weight;
    const titleContribution = normalizedTitle * titleWeight;
    const labelContribution = normalizedLabel * labelWeight;
    const kgContribution = normalizedKg * kgWeight;  // Phase 4
    
    const finalScore = vectorContribution + bm25Contribution + titleContribution + labelContribution + kgContribution;
    
    return {
      finalScore,
      breakdown: {
        vectorContribution,
        bm25Contribution,
        titleContribution,
        labelContribution,
        kgContribution,  // Phase 4
      },
    };
  }
  
  /**
   * 複数の結果に対してスコアを計算し、ソート（StructuredLabel対応）
   */
  public scoreAndRankResults(results: any[], keywords: string[], query?: string): any[] {
    // クエリを再構築（キーワードから）
    const searchQuery = query || keywords.join(' ');
    const scoredResults = results.map(result => {
      // 各信号を抽出
      const vectorDistance = result._distance || result._hybridScore || 2.0;
      // BUG FIX: BM25スコアは複数のフィールドに保存されている可能性がある
      // keyword (Lunr), _bm25Score (BM25), _keywordScore (hybrid)
      const bm25Score = result.keyword || result._bm25Score || result._keywordScore || 0;
      let titleMatchRatio = result._titleMatchRatio || 0;
      
      // Phase 4: タイトル救済検索の結果は超強力ブースト
      if (result._sourceType === 'title-exact') {
        titleMatchRatio = Math.max(titleMatchRatio, 0.9); // タイトル救済は最低90%扱い
      }
      
      // ラベルスコアを計算（キーワードとラベルの一致度）
      const labels: string[] = Array.isArray(result.labels) ? result.labels : [];
      
      // StructuredLabel を抽出（LanceDB Extended Schema）
      const structuredLabel = this.extractStructuredLabel(result);
      
      const labelScore = this.calculateLabelScore(labels, keywords, structuredLabel);
      
      // Phase 4: KGブーストスコアを抽出
      let kgBoost = 0;
      if (result._sourceType === 'kg-reference') {
        // KG参照からの結果は0.7-1.0のブースト
        kgBoost = result._kgWeight || 0.7;
      } else if (result._kgRelated) {
        // ドメイン関連の場合は0.3-0.5のブースト
        kgBoost = 0.3;
      }
      
      const signals: SearchSignals = {
        vectorDistance,
        bm25Score,
        titleMatchRatio,
        labelScore,
        kgBoost,  // Phase 4
      };
      
      let compositeScore = this.calculateCompositeScore(signals);
      
      // Phase 5改善: Composite Scoring段階でも減衰・ブーストを適用
      compositeScore.finalScore = this.applyDomainPenaltyAndBoost(
        compositeScore.finalScore, 
        result,
        searchQuery  // クエリを渡す
      );
      
      return {
        ...result,
        _compositeScore: compositeScore.finalScore,
        _scoreBreakdown: compositeScore.breakdown,
      };
    });
    
    // 複合スコアでソート（降順）
    return scoredResults.sort((a, b) => b._compositeScore - a._compositeScore);
  }
  
  /**
   * LanceDBレコードからStructuredLabelを抽出
   */
  private extractStructuredLabel(record: any): any | null {
    // すべてのstructured_*フィールドがundefinedの場合はnullを返す
    if (
      !record.structured_category &&
      !record.structured_domain &&
      !record.structured_feature
    ) {
      // DEBUG: StructuredLabelがない場合もログ出力
      if (process.env.NODE_ENV === 'development' && record.title) {
        const logMessage = `[CompositeScoring] ❌ No StructuredLabel for: "${record.title}"`;
        console.log(logMessage);
        searchLogger.addDebugLog(logMessage);
      }
      return null;
    }
    
    const structuredLabel = {
      category: record.structured_category,
      domain: record.structured_domain,
      feature: record.structured_feature,
      priority: record.structured_priority,
      status: record.structured_status,
      version: record.structured_version,
      tags: record.structured_tags,
      confidence: record.structured_confidence,
      content_length: record.structured_content_length,
      is_valid: record.structured_is_valid,
    };
    
    // DEBUG: StructuredLabelが抽出された場合もログ出力
    if (process.env.NODE_ENV === 'development' && record.title) {
      const logMessage = `[CompositeScoring] ✅ StructuredLabel extracted for: "${record.title}" - feature: ${structuredLabel.feature}, domain: ${structuredLabel.domain}, category: ${structuredLabel.category}`;
      console.log(logMessage);
      searchLogger.addDebugLog(logMessage);
    }
    
    return structuredLabel;
  }
  
  /**
   * ドメイン減衰・ブースト適用（Composite Scoring段階）
   * Phase 5改善: クエリに関連するドメイン固有キーワードのみをブースト
   */
  private applyDomainPenaltyAndBoost(score: number, result: any, query: string): number {
    const originalScore = score;
    const title = String(result.title || '');
    
    try {
      const titleStr = title.toLowerCase();
      const isGenericDoc = GENERIC_DOCUMENT_TERMS.some(t => titleStr.includes(t.toLowerCase()));
      
      // 減衰適用（汎用文書を大幅に減衰）
      if (isGenericDoc) {
        score *= 0.5;  // 50%減衰
        // Phase 6最適化: デバッグログを削減（パフォーマンス改善）
        // console.log(`[Composite] 🔽 汎用文書減衰: "${title.substring(0, 40)}" ${originalScore.toFixed(4)} → ${score.toFixed(4)} (×0.5)`);
      }
      
      // Phase 5改善: クエリとタイトルの両方に含まれるドメイン固有キーワードのみをブースト
      const matchingKeywordCount = CommonTermsHelper.countMatchingDomainKeywords(query, title);
      
      // ブースト適用（クエリと関連するドメイン固有キーワードのみ）
      if (matchingKeywordCount > 0 && !isGenericDoc) {
        // マッチしたキーワード数に応じてブースト（最大2倍）
        // 係数を0.3 → 0.5に強化（より強力にブースト）
        const boostFactor = 1.0 + (matchingKeywordCount * 0.5);
        const actualBoost = Math.min(boostFactor, 2.0);
        score *= actualBoost;
        // Phase 6最適化: デバッグログを削減（パフォーマンス改善）
        // console.log(`[Composite] 🔼 クエリ関連ブースト: "${title.substring(0, 40)}" ${originalScore.toFixed(4)} → ${score.toFixed(4)} (×${actualBoost.toFixed(2)}, matched: ${matchingKeywordCount})`);
      }
      
    } catch (error) {
      console.warn('[CompositeScoringService] Domain penalty/boost calculation failed:', error);
    }
    
    return score;
  }
  
  /**
   * ラベルスコアを計算（StructuredLabel強化版 + パフォーマンス最適化）
   */
  private calculateLabelScore(labels: string[], keywords: string[], structuredLabel?: any): number {
    // 早期リターン: キーワードがない場合
    if (keywords.length === 0) {
      return 0;
    }
    
    // キーワードの事前正規化（1回だけ実行）
    const lowerKeywords = keywords.map(k => k.toLowerCase());
    
    let score = 0;
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Part 1: 従来の文字列ラベルマッチング（20%の重み）
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (labels.length > 0) {
      const lowerLabels = labels.map(l => l.toLowerCase());
      
      let matchCount = 0;
      for (const keyword of lowerKeywords) {
        for (const label of lowerLabels) {
          if (label.includes(keyword)) {
            matchCount++;
            break; // 1つのキーワードにつき1回だけカウント
          }
        }
      }
      
      score += (matchCount / lowerKeywords.length) * 0.2; // 20%の重み
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Part 2: StructuredLabelマッチング（80%の重み）
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (!structuredLabel) {
      // StructuredLabelがない場合は早期リターン（Part 1のスコアのみ）
      return Math.min(score, 1.0);
    }
    
    // DEBUG: StructuredLabelの内容をログ出力
    if (process.env.NODE_ENV === 'development') {
      const logMessage = `[CompositeScoring] StructuredLabel found: feature=${structuredLabel.feature}, domain=${structuredLabel.domain}, category=${structuredLabel.category}, keywords=${lowerKeywords.join(',')}`;
      console.log(logMessage);
      searchLogger.addDebugLog(logMessage);
    }
    
    // StructuredLabel処理（lowerKeywordsは既に上で定義済み）
    let structuredMatchCount = 0;
    let totalChecks = 0;
      
    // ドメインマッチング（最重要）
    if (structuredLabel.domain) {
      totalChecks++;
      const domainLower = structuredLabel.domain.toLowerCase();
      if (lowerKeywords.some(k => domainLower.includes(k) || k.includes(domainLower))) {
        structuredMatchCount += 2; // ドメインは2倍重要
        if (process.env.NODE_ENV === 'development') {
          const logMessage = `[CompositeScoring] ✅ Domain match: "${structuredLabel.domain}" with keywords`;
          console.log(logMessage);
          searchLogger.addDebugLog(logMessage);
        }
      }
    }
    
    // 機能名マッチング（重要） - 完全一致を優先
    if (structuredLabel.feature) {
      totalChecks++;
      const featureLower = structuredLabel.feature.toLowerCase();
      
      // キーワードを結合してクエリ全体をチェック（順序と空白を考慮）
      // 例：["削除", "教室"] → "削除 教室" と "教室削除" の両方をチェック
      const queryLowerWithSpace = lowerKeywords.join(' ').toLowerCase();
      const queryLowerWithoutSpace = lowerKeywords.join('').toLowerCase();
      // キーワードの順序を逆にした場合もチェック
      const queryLowerReversed = lowerKeywords.slice().reverse().join('').toLowerCase();
      
      // 完全一致を最優先（例：「教室削除機能」と「教室削除」の部分一致）
      // 空白あり・なし・逆順のすべてのパターンをチェック
      const isFullMatch = featureLower.includes(queryLowerWithSpace) || 
                          featureLower.includes(queryLowerWithoutSpace) ||
                          featureLower.includes(queryLowerReversed) ||
                          queryLowerWithSpace.includes(featureLower) ||
                          queryLowerWithoutSpace.includes(featureLower) ||
                          queryLowerReversed.includes(featureLower);
      
      if (isFullMatch) {
        // 完全一致またはクエリが機能名に含まれる場合：3倍重要
        structuredMatchCount += 3;
        // 本番環境以外でログ出力
        if (process.env.NODE_ENV !== 'production') {
          const logMessage = `[CompositeScoring] ✅✅✅ Feature FULL match: "${structuredLabel.feature}" with query "${queryLowerWithoutSpace}" (score: +3)`;
          console.log(logMessage);
          searchLogger.addDebugLog(logMessage);
        }
      } else if (lowerKeywords.some(k => featureLower.includes(k) || k.includes(featureLower))) {
        // 部分一致の場合：1.5倍重要
        structuredMatchCount += 1.5;
        // 本番環境以外でログ出力
        if (process.env.NODE_ENV !== 'production') {
          const logMessage = `[CompositeScoring] ✅ Feature partial match: "${structuredLabel.feature}" with keywords (score: +1.5)`;
          console.log(logMessage);
          searchLogger.addDebugLog(logMessage);
        }
      } else {
        // 本番環境以外でログ出力
        if (process.env.NODE_ENV !== 'production') {
          const logMessage = `[CompositeScoring] ❌ Feature NO match: "${structuredLabel.feature}" with query "${queryLowerWithoutSpace}"`;
          console.log(logMessage);
          searchLogger.addDebugLog(logMessage);
        }
      }
    }
    
    // タグマッチング
    if (Array.isArray(structuredLabel.tags) && structuredLabel.tags.length > 0) {
      const tagsLower = structuredLabel.tags.map((t: string) => t.toLowerCase());
      for (const keyword of lowerKeywords) {
        if (tagsLower.some((tag: string) => tag.includes(keyword) || keyword.includes(tag))) {
          structuredMatchCount += 0.5; // タグは0.5倍
          break;
        }
      }
      totalChecks++;
    }
    
    // カテゴリマッチング（補助）
    // 機能仕様に関する質問の場合は、メールテンプレート（template）のスコアを下げる
    if (structuredLabel.category) {
      totalChecks++;
      const categoryLower = structuredLabel.category.toLowerCase();
      
      // 機能仕様に関する質問のキーワード（「どうなりますか」「可能ですか」など）
      const functionalQueryKeywords = ['どうなりますか', 'どうなる', '可能ですか', '可能', '方法', '仕様', '機能', '条件', '原因', '理由'];
      const isFunctionalQuery = lowerKeywords.some(k => 
        functionalQueryKeywords.some(fqk => k.includes(fqk) || fqk.includes(k))
      );
      
      if (lowerKeywords.some(k => categoryLower.includes(k) || k.includes(categoryLower))) {
        // メールテンプレート（template）カテゴリの場合、スコアを大幅に下げる
        if (categoryLower === 'template') {
          // 機能仕様に関する質問の場合は、スコアをほぼゼロに
          if (isFunctionalQuery) {
            structuredMatchCount += 0.05; // ほぼゼロ（機能仕様質問ではメールテンプレートを優先しない）
          } else {
            structuredMatchCount += 0.1; // 通常のメール質問でも低めに
          }
        } else {
          // その他のカテゴリは通常通り
          structuredMatchCount += 0.3;
        }
      }
    }
    
    // ステータスボーナス（承認済みページを優先）
    if (structuredLabel.status === 'approved') {
      structuredMatchCount += 0.2;
    }
    
    // 正規化して0-1の範囲に
    if (totalChecks > 0) {
      const maxPossibleScore = 2 + 3 + 0.5 + 0.3 + 0.2; // 6.0（機能名の最大スコアを3に更新）
      const structuredScore = Math.min(structuredMatchCount / maxPossibleScore, 1.0) * 0.8; // 80%の重み
      score += structuredScore;
      
      // DEBUG: スコア計算の詳細をログ出力
      if (process.env.NODE_ENV === 'development') {
        const logMessage = `[CompositeScoring] Label score breakdown: structuredMatchCount=${structuredMatchCount}, maxPossibleScore=${maxPossibleScore}, structuredScore=${structuredScore.toFixed(4)}, totalScore=${Math.min(score, 1.0).toFixed(4)}`;
        console.log(logMessage);
        searchLogger.addDebugLog(logMessage);
      }
    }
    
    return Math.min(score, 1.0); // 最大1.0に制限
  }
}

// シングルトンインスタンスをエクスポート
export const compositeScoringService = CompositeScoringService.getInstance();

