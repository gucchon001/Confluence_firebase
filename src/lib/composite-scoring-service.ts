/**
 * 複合スコアリングサービス（Phase 0A-4）
 * 
 * 複数の検索信号を統合的に評価し、最適なランキングを生成
 * 参考: 
 * - https://zenn.dev/yumefuku/articles/llm-neo4j-hybrid
 * - https://actionbridge.io/ja-JP/llmtutorial/p/llm-rag-chapter7-2-hybrid-multivector-search
 */

export interface SearchSignals {
  vectorDistance: number;      // ベクトル距離（小さいほど良い）
  bm25Score: number;            // BM25スコア（大きいほど良い）
  titleMatchRatio: number;      // タイトルマッチ率（0-1）
  labelScore: number;           // ラベルスコア（0-1）
  pageRank?: number;            // ページランク（オプション）
}

export interface CompositeScore {
  finalScore: number;
  breakdown: {
    vectorContribution: number;
    bm25Contribution: number;
    titleContribution: number;
    labelContribution: number;
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
  
  // 正規化パラメータ
  maxVectorDistance: number;  // デフォルト: 2.0
  maxBm25Score: number;       // デフォルト: 10.0
}

const DEFAULT_CONFIG: CompositeScoreConfig = {
  // Phase 3実装（実測ベスト）: BM25最優先 + タイトルブーストで発見率83%達成
  // BM25（40%）+ ベクトル（30%）+ タイトル（20%）+ ラベル（10%）= 100%
  vectorWeight: 0.3,    // ベクトル: 30%（セマンティック検索）
  bm25Weight: 0.4,      // BM25: 40%（キーワード完全一致を最優先）
  titleWeight: 0.2,     // タイトル: 20%（ブースト内で強化済み）
  labelWeight: 0.1,     // ラベル: 10%（補助）
  maxVectorDistance: 2.0,
  maxBm25Score: 10.0,
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
    const { vectorWeight, bm25Weight, titleWeight, labelWeight, maxVectorDistance, maxBm25Score } = this.config;
    
    // 各信号を0-1に正規化
    const normalizedVector = 1.0 - Math.min(signals.vectorDistance / maxVectorDistance, 1.0);
    const normalizedBm25 = Math.min(signals.bm25Score / maxBm25Score, 1.0);
    const normalizedTitle = signals.titleMatchRatio;
    const normalizedLabel = signals.labelScore;
    
    // 重み付き合計
    const vectorContribution = normalizedVector * vectorWeight;
    const bm25Contribution = normalizedBm25 * bm25Weight;
    const titleContribution = normalizedTitle * titleWeight;
    const labelContribution = normalizedLabel * labelWeight;
    
    const finalScore = vectorContribution + bm25Contribution + titleContribution + labelContribution;
    
    return {
      finalScore,
      breakdown: {
        vectorContribution,
        bm25Contribution,
        titleContribution,
        labelContribution,
      },
    };
  }
  
  /**
   * 複数の結果に対してスコアを計算し、ソート（StructuredLabel対応）
   */
  public scoreAndRankResults(results: any[], keywords: string[]): any[] {
    const scoredResults = results.map(result => {
      // 各信号を抽出
      const vectorDistance = result._distance || result._hybridScore || 2.0;
      const bm25Score = result._bm25Score || 0;
      const titleMatchRatio = result._titleMatchRatio || 0;
      
      // ラベルスコアを計算（キーワードとラベルの一致度）
      const labels: string[] = Array.isArray(result.labels) ? result.labels : [];
      
      // StructuredLabel を抽出（LanceDB Extended Schema）
      const structuredLabel = this.extractStructuredLabel(result);
      
      const labelScore = this.calculateLabelScore(labels, keywords, structuredLabel);
      
      const signals: SearchSignals = {
        vectorDistance,
        bm25Score,
        titleMatchRatio,
        labelScore,
      };
      
      const compositeScore = this.calculateCompositeScore(signals);
      
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
      return null;
    }
    
    return {
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
    
    // StructuredLabel処理（lowerKeywordsは既に上で定義済み）
    let structuredMatchCount = 0;
    let totalChecks = 0;
      
    // ドメインマッチング（最重要）
    if (structuredLabel.domain) {
      totalChecks++;
      const domainLower = structuredLabel.domain.toLowerCase();
      if (lowerKeywords.some(k => domainLower.includes(k) || k.includes(domainLower))) {
        structuredMatchCount += 2; // ドメインは2倍重要
      }
    }
    
    // 機能名マッチング（重要）
    if (structuredLabel.feature) {
      totalChecks++;
      const featureLower = structuredLabel.feature.toLowerCase();
      if (lowerKeywords.some(k => featureLower.includes(k) || k.includes(featureLower))) {
        structuredMatchCount += 1.5; // 機能名は1.5倍重要
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
    if (structuredLabel.category) {
      totalChecks++;
      const categoryLower = structuredLabel.category.toLowerCase();
      if (lowerKeywords.some(k => categoryLower.includes(k) || k.includes(categoryLower))) {
        structuredMatchCount += 0.3;
      }
    }
    
    // ステータスボーナス（承認済みページを優先）
    if (structuredLabel.status === 'approved') {
      structuredMatchCount += 0.2;
    }
    
    // 正規化して0-1の範囲に
    if (totalChecks > 0) {
      const maxPossibleScore = 2 + 1.5 + 0.5 + 0.3 + 0.2; // 4.5
      score += Math.min(structuredMatchCount / maxPossibleScore, 1.0) * 0.8; // 80%の重み
    }
    
    return Math.min(score, 1.0); // 最大1.0に制限
  }
}

// シングルトンインスタンスをエクスポート
export const compositeScoringService = CompositeScoringService.getInstance();

