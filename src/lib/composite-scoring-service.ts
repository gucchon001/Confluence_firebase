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
import { getLabelsAsArray } from './label-utils';
// Phase 7最適化: searchLoggerのインポートを削除（ログ出力を削減したため不要）

export interface SearchSignals {
  vectorDistance: number;      // ベクトル距離（小さいほど良い）
  bm25Score: number;            // BM25スコア（大きいほど良い）
  titleMatchRatio: number;      // タイトルマッチ率（0-1）
  labelScore: number;           // ラベルスコア（0-1）
  kgBoost?: number;             // KGブーストスコア（Phase 7: 無効化済み、常に0）
  pageRank?: number;            // ページランク（オプション）
}

export interface CompositeScore {
  finalScore: number;
  breakdown: {
    vectorContribution: number;
    bm25Contribution: number;
    titleContribution: number;
    labelContribution: number;
    kgContribution?: number;  // Phase 7: KG拡張無効化済み（常に0）
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
  kgWeight: number;         // デフォルト: 0.00 (Phase 7: 無効化済み)
  
  // 正規化パラメータ
  maxVectorDistance: number;  // デフォルト: 2.0
  maxBm25Score: number;       // デフォルト: 10.0
}

const DEFAULT_CONFIG: CompositeScoreConfig = {
  // Phase 7最適化: KG拡張無効化に伴う重み再配分
  // BM25（53%）+ タイトル（26%）+ ラベル（16%）+ ベクトル（5%）= 100%
  // 理由: KG拡張を無効化（パフォーマンス悪化のため）し、KGの5%を他のコンポーネントに再配分
  vectorWeight: 0.05,   // ベクトル: 5%（最小化：空間変化の影響を軽減）
  bm25Weight: 0.53,     // BM25: 53%（最優先：キーワード完全一致、KG分1%を追加）
  titleWeight: 0.26,    // タイトル: 26%（強化：タイトルマッチを重視、KG分1%を追加）
  labelWeight: 0.16,    // ラベル: 16%（強化：StructuredLabel活用、KG分1%を追加）
  kgWeight: 0.00,       // KG: 0%（Phase 7: 無効化済み）
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
    // Phase 7: KG拡張無効化のため、kgBoostは常に0（互換性のため変数は保持）
    const normalizedKg = 0;  // Phase 7: KG拡張無効化済み
    
    // 重み付き合計
    const vectorContribution = normalizedVector * vectorWeight;
    const bm25Contribution = normalizedBm25 * bm25Weight;
    const titleContribution = normalizedTitle * titleWeight;
    const labelContribution = normalizedLabel * labelWeight;
    const kgContribution = 0;  // Phase 7: KG拡張無効化済み（kgWeightも0のため）
    
    const finalScore = vectorContribution + bm25Contribution + titleContribution + labelContribution + kgContribution;
    
    return {
      finalScore,
      breakdown: {
        vectorContribution,
        bm25Contribution,
        titleContribution,
        labelContribution,
        kgContribution,  // Phase 7: KG拡張無効化済み（常に0）
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
      
      // Phase 7: KG拡張無効化のため、kgBoostは常に0
      const kgBoost = 0;  // Phase 7: KG拡張無効化済み
      
      const signals: SearchSignals = {
        vectorDistance,
        bm25Score,
        titleMatchRatio,
        labelScore,
        kgBoost,  // Phase 7: KG拡張無効化済み（常に0）
      };
      
      let compositeScore = this.calculateCompositeScore(signals);
      
      // タグマッチングボーナスを先に適用（減衰の前に適用して、減衰が正しく機能するようにする）
      const tagsArray = getLabelsAsArray((result as any).structured_tags);
      if (tagsArray.length > 0) {
        const tagsLower = tagsArray.map((t: string) => String(t).toLowerCase());
        let matchedTagCount = 0;
        const matchedTagsList: string[] = []; // デバッグ用: マッチしたタグのリスト
        for (const keyword of keywords) {
          const keywordLower = keyword.toLowerCase();
          const matchedTags = tagsLower.filter((tag: string) => tag.includes(keywordLower) || keywordLower.includes(tag));
          if (matchedTags.length > 0) {
            matchedTagCount++;
            // デバッグ用: マッチしたタグを記録（重複は除外）
            matchedTags.forEach(tag => {
              if (!matchedTagsList.includes(tag)) {
                matchedTagsList.push(tag);
              }
            });
          }
        }
        if (matchedTagCount > 0) {
          // 1つのタグマッチ: 3.0倍、2つ以上: 6.0倍（Composite Scoreに直接反映、タグマッチングを極めて重視）
          const tagBoost = matchedTagCount === 1 ? 3.0 : 6.0;
          compositeScore.finalScore *= tagBoost;
        }
      }
      
      // Phase 5改善: Composite Scoring段階でも減衰・ブーストを適用（タグマッチングボーナスの後に適用）
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
      // Phase 7最適化: ログ出力を削減（パフォーマンス改善）
      // DEBUG: StructuredLabelがない場合のログは削除（大量出力による遅延を防止）
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
    
    // Phase 7最適化: ログ出力を削減（パフォーマンス改善）
    // DEBUG: StructuredLabelが抽出された場合のログは削除（大量出力による遅延を防止）
    
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
      
      // StructuredLabelに基づくカテゴリ減衰・ブースト（機能クエリ時はspecを優先）
      let structuredCategory = typeof result.structured_category === 'string'
        ? result.structured_category.toLowerCase()
        : '';
      
      // フォールバック: structured_categoryが未設定の場合、タイトルから推測
      if (!structuredCategory) {
        const titleLower = title.toLowerCase();
        // メール関連のキーワードが含まれている場合はtemplate
        if (titleLower.includes('メール') || 
            titleLower.includes('mail') ||
            titleLower.includes('通知') && (titleLower.includes('宛') || titleLower.includes('送信'))) {
          structuredCategory = 'template';
        } else if (titleLower.includes('機能') || 
                   titleLower.includes('バッチ') ||
                   titleLower.includes('フロー') && !titleLower.includes('テンプレ')) {
          // 機能名が含まれている場合はspec
          structuredCategory = 'spec';
        } else if (titleLower.includes('フロー') && titleLower.includes('テンプレ')) {
          structuredCategory = 'workflow';
        } else if (titleLower.includes('情報') || 
                   titleLower.includes('データ') ||
                   titleLower.includes('帳票')) {
          structuredCategory = 'data';
        }
      }
      
      const functionalQuery = this.isFunctionalQuery(query);
      
      // ⚡ ログ削減: デバッグ時のみ詳細ログを出力
      const DEBUG_SEARCH = process.env.NODE_ENV === 'development' && process.env.DEBUG_SEARCH === 'true';
      
      // 機能クエリ時はspecカテゴリをブースト（仕様ドキュメントを優先）
      if (functionalQuery && structuredCategory === 'spec') {
        const scoreBefore = score;
        score *= 1.5; // 50%ブースト（機能クエリ時は仕様ドキュメントを優先）
        // デバッグログ（上位10件のみ）
        if (scoreBefore > 1.0 && DEBUG_SEARCH) {
          console.log(`[Spec Boost] "${title.substring(0, 50)}": ${scoreBefore.toFixed(4)} → ${score.toFixed(4)} (x1.5, functional query)`);
        }
      }
      
      // templateカテゴリの減衰（メールテンプレート優先度を大幅に低減）
      if (structuredCategory === 'template') {
        const emailLikeQuery = this.isEmailOrTemplateQuery(query);
        const scoreBefore = score;

        // 機能仕様系の質問（挙動確認、原因調査など）はメールテンプレートではなく仕様ドキュメントを期待していることが多い
        if (functionalQuery) {
          // メールに言及していても仕様確認であれば極めて強く減衰させる
          const decayFactor = emailLikeQuery ? 0.05 : 0.02; // 95%〜98%減衰（極めて強化）
          score *= decayFactor;
          // デバッグログ（上位10件のみ）
          if (scoreBefore > 1.0 && DEBUG_SEARCH) {
            console.log(`[Template Decay] "${title.substring(0, 50)}": ${scoreBefore.toFixed(4)} → ${score.toFixed(4)} (x${decayFactor}, functional=${functionalQuery}, emailLike=${emailLikeQuery})`);
          }
        } else if (!emailLikeQuery) {
          score *= 0.15;  // 通常の質問でも85%減衰（強化）
          // デバッグログ（上位10件のみ）
          if (scoreBefore > 1.0 && DEBUG_SEARCH) {
            console.log(`[Template Decay] "${title.substring(0, 50)}": ${scoreBefore.toFixed(4)} → ${score.toFixed(4)} (x0.15, non-email query)`);
          }
        }
      }
      
      // dataカテゴリも減衰（データ定義は仕様ドキュメントより優先度を下げる）
      if (structuredCategory === 'data') {
        if (functionalQuery) {
          const scoreBefore = score;
          // 機能仕様系の質問では、データ定義よりも仕様ドキュメントを優先
          score *= 0.15; // 85%減衰（強化）
          // デバッグログ（上位10件のみ）
          if (scoreBefore > 1.0 && DEBUG_SEARCH) {
            console.log(`[Data Decay] "${title.substring(0, 50)}": ${scoreBefore.toFixed(4)} → ${score.toFixed(4)} (x0.15, functional query)`);
          }
        }
      }
      
      // workflowカテゴリも減衰（ワークフローは仕様ドキュメントより優先度を下げる）
      if (structuredCategory === 'workflow') {
        if (functionalQuery) {
          const scoreBefore = score;
          // 機能仕様系の質問では、ワークフローよりも仕様ドキュメントを優先
          score *= 0.3; // 70%減衰
          // デバッグログ（上位10件のみ）
          if (scoreBefore > 1.0 && DEBUG_SEARCH) {
            console.log(`[Workflow Decay] "${title.substring(0, 50)}": ${scoreBefore.toFixed(4)} → ${score.toFixed(4)} (x0.3, functional query)`);
          }
        }
      }
      
      // deprecatedステータスの減衰（非推奨ドキュメントを大幅に減衰）
      // 注意: フィルター段階で除外されるため、ここでは減衰のみ（念のため）
      const structuredStatus = typeof result.structured_status === 'string'
        ? result.structured_status.toLowerCase()
        : '';
      if (structuredStatus === 'deprecated') {
        const scoreBefore = score;
        // 非推奨ドキュメントは95%減衰（ほぼ除外、フィルターで除外される前提）
        score *= 0.05;
        // デバッグログ（上位10件のみ）
        if (scoreBefore > 1.0 && DEBUG_SEARCH) {
          console.log(`[Deprecated Decay] "${title.substring(0, 50)}": ${scoreBefore.toFixed(4)} → ${score.toFixed(4)} (x0.05, deprecated status)`);
        }
      }
      
    } catch (error) {
      console.warn('[CompositeScoringService] Domain penalty/boost calculation failed:', error);
    }
    
    return score;
  }

  /**
   * 機能仕様・挙動を問い合わせるクエリかどうかを判定
   * 例：「どうなりますか」「可能ですか」「条件」「仕様」「エラー」など
   */
  private isFunctionalQuery(query: string): boolean {
    if (!query) {
      return false;
    }
    const normalized = query.toLowerCase();
    const functionalKeywords = [
      'どうなりますか',
      'どうなる',
      '可能ですか',
      '可能か',
      '仕様',
      '機能',
      '条件',
      '理由',
      '原因',
      '挙動',
      '対処',
      '再登録',
      '退会',
      'エラー',
      '表示され',
      '制限',
      'できる',
    ];
    return functionalKeywords.some(keyword => normalized.includes(keyword));
  }

  /**
   * メールテンプレートや通知系の質問かどうかを判定
   * 例：「メール」「テンプレート」「通知」「送信」「配信」など
   */
  private isEmailOrTemplateQuery(query: string): boolean {
    if (!query) {
      return false;
    }
    const normalized = query.toLowerCase();
    const emailTemplateKeywords = [
      'メール',
      'email',
      'テンプレート',
      'template',
      '通知',
      '送信',
      '配信',
      '差し込み',
      '本文',
      '件名',
    ];
    return emailTemplateKeywords.some(keyword => normalized.includes(keyword));
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
      const matchedLabelsSet = new Set<string>(); // 重複を避けるためSetを使用
      
      for (const keyword of lowerKeywords) {
        // 1つのキーワードに対して複数のラベルがマッチする場合も全てカウント
        for (const label of lowerLabels) {
          if (label.includes(keyword)) {
            // 重複を避けるため、既にカウントしたラベルはスキップ
            if (!matchedLabelsSet.has(label)) {
              matchCount++;
              matchedLabelsSet.add(label);
            }
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
    
    // Phase 7最適化: ログ出力を削減（パフォーマンス改善）
    // DEBUG: StructuredLabelの内容のログは削除（大量出力による遅延を防止）
    
    // StructuredLabel処理（lowerKeywordsは既に上で定義済み）
    let structuredMatchCount = 0;
    let totalChecks = 0;
      
    // ドメインマッチング（最重要）
    if (structuredLabel.domain) {
      totalChecks++;
      const domainLower = structuredLabel.domain.toLowerCase();
      if (lowerKeywords.some(k => domainLower.includes(k) || k.includes(domainLower))) {
        structuredMatchCount += 2; // ドメインは2倍重要
        // Phase 7最適化: ログ出力を削減（パフォーマンス改善）
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
        // Phase 7最適化: ログ出力を削減（パフォーマンス改善）
      } else if (lowerKeywords.some(k => featureLower.includes(k) || k.includes(featureLower))) {
        // 部分一致の場合：1.5倍重要
        structuredMatchCount += 1.5;
        // Phase 7最適化: ログ出力を削減（パフォーマンス改善）
      }
      // Phase 7最適化: 不一致のログも削除（パフォーマンス改善）
    }
    
    // タグマッチング（複数タグマッチでボーナス）
    if (Array.isArray(structuredLabel.tags) && structuredLabel.tags.length > 0) {
      const tagsLower = structuredLabel.tags.map((t: string) => t.toLowerCase());
      let matchedTagCount = 0;
      for (const keyword of lowerKeywords) {
        if (tagsLower.some((tag: string) => tag.includes(keyword) || keyword.includes(tag))) {
          matchedTagCount++;
        }
      }
      if (matchedTagCount > 0) {
        // 1つのタグマッチ: 0.8倍、2つ以上: 2.0倍（複数タグマッチで大幅ボーナス）
        structuredMatchCount += matchedTagCount === 1 ? 0.8 : 2.0;
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
      const maxPossibleScore = 2 + 3 + 2.0 + 0.3 + 0.2; // 7.5（タグマッチングの最大スコアを2.0に更新）
      const structuredScore = Math.min(structuredMatchCount / maxPossibleScore, 1.0) * 0.8; // 80%の重み
      score += structuredScore;
      
      // Phase 7最適化: ログ出力を削減（パフォーマンス改善）
      // DEBUG: スコア計算の詳細ログは削除（大量出力による遅延を防止）
    }
    
    return Math.min(score, 1.0); // 最大1.0に制限
  }
}

// シングルトンインスタンスをエクスポート
export const compositeScoringService = CompositeScoringService.getInstance();

