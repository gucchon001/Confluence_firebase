/*
 * クラスベースキーワード抽出ライブラリ
 * 設計書に基づく実装、ドメイン知識活用
 */

import { DomainKnowledgeLoader } from './domain-knowledge-loader';

// インターフェース定義
export interface ExtractResult {
  keywords: string[];
  highPriority: Set<string>;
  lowPriority: Set<string>;
  quality: QualityResult;
  metadata: ExtractionMetadata;
}

export interface QualityResult {
  isValid: boolean;
  score: number;
  issues: string[];
  breakdown: {
    keywordCount: number;
    entityKeywords: boolean;
    functionKeywords: boolean;
    diversityScore: number;
  };
}

export interface ExtractionMetadata {
  timestamp: Date;
  query: string;
  processingTime: number;
  config: KeywordExtractorConfig;
}

export interface KeywordExtractorConfig {
  basic?: BasicExtractorConfig;
  domain?: DomainExtractorConfig;
  function?: FunctionExtractorConfig;
  llm?: LLMExtractorConfig;
  quality?: QualityValidatorConfig;
  selector?: SelectorConfig;
}

export interface BasicExtractorConfig {
  stopwords?: Set<string>;
  minLength?: number;
  maxLength?: number;
  splitPattern?: RegExp;
}

export interface DomainExtractorConfig {
  entityPattern?: RegExp;
  minLength?: number;
  maxLength?: number;
}

export interface FunctionExtractorConfig {
  patterns?: RegExp[];
  minLength?: number;
  maxLength?: number;
}

export interface LLMExtractorConfig {
  enabled?: boolean;
  model?: string;
  maxKeywords?: number;
  apiKey?: string;
}

export interface QualityValidatorConfig {
  minKeywordCount?: number;
  minScore?: number;
  weights?: {
    keywordCount: number;
    entityKeywords: number;
    functionKeywords: number;
    diversity: number;
  };
}

export interface SelectorConfig {
  maxKeywords?: number;
  priorities?: {
    basic: number;
    domain: number;
    function: number;
    llm: number;
  };
}

// 基本キーワード抽出クラス
export class BasicKeywordExtractor {
  private stopwords: Set<string>;
  private config: BasicExtractorConfig;

  constructor(config: BasicExtractorConfig = {}) {
    this.config = {
      stopwords: new Set([
        'こと','もの','ため','など','これ','それ','あれ','について','の','は','が','を','に','で','と','や','から','まで','より','へ','も','な','だ','です','ます','ください','教えて','件','ですか','とは'
      ]),
      minLength: 2,
      maxLength: 4,
      splitPattern: /[の・・、は？]/g,
      ...config
    };
    this.stopwords = this.config.stopwords!;
  }

  extract(query: string): string[] {
    const basicKeywords: string[] = [];
    const parts = query.split(this.config.splitPattern!).filter(part => part.trim().length > 0);
    
    for (const part of parts) {
      const words = part.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}A-Za-z0-9_.-]+/gu) || [];
      
      for (const word of words) {
        if (this.validateKeyword(word)) {
          basicKeywords.push(word);
        }
      }
    }
    
    return [...new Set(basicKeywords)];
  }

  setStopwords(stopwords: Set<string>): void {
    this.stopwords = stopwords;
    this.config.stopwords = stopwords;
  }

  private splitByParticles(query: string): string[] {
    return query.split(this.config.splitPattern!).filter(part => part.trim().length > 0);
  }

  private validateKeyword(keyword: string): boolean {
    return keyword.length >= this.config.minLength! && 
           keyword.length <= this.config.maxLength! && 
           !this.stopwords.has(keyword);
  }
}

// ドメイン特化キーワード抽出クラス
export class DomainKeywordExtractor {
  private config: DomainExtractorConfig;
  private domainKnowledgeLoader: DomainKnowledgeLoader;

  constructor(config: DomainExtractorConfig = {}) {
    this.config = {
      entityPattern: /[\p{Script=Han}]{2,4}/gu,
      minLength: 2,
      maxLength: 4,
      ...config
    };
    this.domainKnowledgeLoader = DomainKnowledgeLoader.getInstance();
  }

  async extract(query: string): Promise<string[]> {
    // ドメイン知識が読み込まれていない場合は初期化
    if (!this.domainKnowledgeLoader.isLoaded()) {
      try {
        await this.domainKnowledgeLoader.loadDomainKnowledge();
      } catch (error) {
        console.warn('[DomainKeywordExtractor] ドメイン知識の読み込みに失敗、フォールバックを使用');
        return this.extractFallback(query);
      }
    }
    
    // ドメイン知識からキーワードを抽出
    const domainKeywords = this.domainKnowledgeLoader.extractDomainKeywords(query);
    
    // フォールバック: 基本的なエンティティ抽出も追加
    const fallbackKeywords = this.extractFallback(query);
    
    // 重複除去して結合
    const allKeywords = [...domainKeywords, ...fallbackKeywords];
    return [...new Set(allKeywords)];
  }

  private extractFallback(query: string): string[] {
    const domainKeywords: string[] = [];
    const entityMatches = query.match(this.config.entityPattern!) || [];
    
    for (const match of entityMatches) {
      if (this.validateEntity(match)) {
        domainKeywords.push(match);
      }
    }
    
    return domainKeywords;
  }

  private extractEntities(query: string): string[] {
    return query.match(this.config.entityPattern!) || [];
  }

  private validateEntity(entity: string): boolean {
    return entity.length >= this.config.minLength! && 
           entity.length <= this.config.maxLength!;
  }
}

// 機能キーワード抽出クラス
export class FunctionKeywordExtractor {
  private patterns: RegExp[];
  private config: FunctionExtractorConfig;

  constructor(config: FunctionExtractorConfig = {}) {
    this.config = {
      patterns: [
        /一覧/, /閲覧/, /登録/, /編集/, /削除/, /コピー/, /複製/,
        /機能/, /管理/, /設定/, /詳細/, /仕様/, /情報/, /データ/,
        /制限/, /条件/, /方法/, /手順/, /問題/, /原因/, /エラー/
      ],
      minLength: 2,
      maxLength: 6,
      ...config
    };
    this.patterns = this.config.patterns!;
  }

  extract(query: string): string[] {
    const functionKeywords: string[] = [];
    
    for (const pattern of this.patterns) {
      const matches = query.match(pattern);
      if (matches) {
        for (const match of matches) {
          if (match.length >= this.config.minLength! && match.length <= this.config.maxLength!) {
            functionKeywords.push(match);
          }
        }
      }
    }
    
    return functionKeywords;
  }

  addPattern(pattern: RegExp): void {
    this.patterns.push(pattern);
  }

  removePattern(pattern: RegExp): void {
    this.patterns = this.patterns.filter(p => p.source !== pattern.source);
  }

  private matchPatterns(query: string): string[] {
    const matches: string[] = [];
    for (const pattern of this.patterns) {
      const patternMatches = query.match(pattern);
      if (patternMatches) {
        matches.push(...patternMatches);
      }
    }
    return matches;
  }
}

// LLMキーワード抽出クラス
export class LLMKeywordExtractor {
  private apiKey: string;
  private model: string;
  private config: LLMExtractorConfig;

  constructor(config: LLMExtractorConfig = {}) {
    this.config = {
      enabled: process.env.USE_LLM_EXPANSION === 'true',
      model: 'gemini-1.5-flash',
      maxKeywords: 8,
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
      ...config
    };
    this.apiKey = this.config.apiKey!;
    this.model = this.config.model!;
  }

  async extract(query: string, baseKeywords: string[]): Promise<string[]> {
    if (!this.config.enabled || !this.apiKey) {
      return [];
    }

    try {
      return await this.callLLM(query, baseKeywords);
    } catch (error) {
      console.warn('[LLMKeywordExtractor] LLM expansion failed:', error);
      return [];
    }
  }

  private async callLLM(query: string, baseKeywords: string[]): Promise<string[]> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI: any = new (GoogleGenerativeAI as any)(this.apiKey);
    const model = genAI.getGenerativeModel({ model: this.model });
    
    const prompt = [
      'あなたは社内ドキュメント検索のためのキーワード抽出補助を行います。',
      '以下の質問文に対し、実際のシステム機能名に基づいた具体的なキーワードを最大10件、JSON配列で返してください。',
      '重要: 汎用的すぎるキーワード（予約、確保、割り当てなど）は避け、実際の機能名（一覧、登録、編集、削除、コピーなど）を優先してください。',
      '機能関連の場合: 一覧、登録、編集、削除、コピー、管理、詳細、仕様、処理、実行 など',
      '問題・制限関連の場合: 制限、条件、チェック、エラー、失敗、不具合、障害、異常 など',
      'データ関連の場合: データ、情報、詳細、仕様、管理、処理 など',
      '出力はJSON配列のみ。',
      `質問文: ${query}`
    ].join('\n');
    
    const resp: any = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    const text = resp?.response?.text?.() || '';
    return this.parseLLMResponse(text, baseKeywords);
  }

  private parseLLMResponse(response: string, baseKeywords: string[]): string[] {
    const jsonText = (response.match(/\[[\s\S]*\]/) || [])[0] || '[]';
    const arr = JSON.parse(jsonText);
    
    if (!Array.isArray(arr)) return [];
    
    const expanded = arr
      .map((x: any) => String(x || '').trim())
      .filter((x: string) => x && x.length >= 2);
    
    // 原語と重複を除去
    const baseSet = new Set(baseKeywords.map(k => k.toLowerCase()));
    const unique = expanded.filter(x => !baseSet.has(x.toLowerCase()));
    
    return unique.slice(0, this.config.maxKeywords!);
  }
}

// キーワード品質検証クラス
export class KeywordQualityValidator {
  private config: QualityValidatorConfig;

  constructor(config: QualityValidatorConfig = {}) {
    this.config = {
      minKeywordCount: 3,
      minScore: 70,
      weights: {
        keywordCount: 30,
        entityKeywords: 30,
        functionKeywords: 30,
        diversity: 10
      },
      ...config
    };
  }

  validate(keywords: string[]): QualityResult {
    const issues: string[] = [];
    let score = 0;
    
    // キーワード数のチェック
    const keywordCount = keywords.length;
    const hasMinKeywords = keywordCount >= this.config.minKeywordCount!;
    if (hasMinKeywords) {
      score += this.config.weights!.keywordCount;
    } else {
      issues.push(`キーワード数が不足（${this.config.minKeywordCount}個以上必要）`);
    }
    
    // エンティティキーワードのチェック
    const hasEntityKeywords = keywords.some(kw => 
      kw.length >= 2 && kw.length <= 4 && /[\p{Script=Han}]{2,4}/u.test(kw)
    );
    if (hasEntityKeywords) {
      score += this.config.weights!.entityKeywords;
    } else {
      issues.push('エンティティキーワードが不足');
    }
    
    // 機能キーワードのチェック
    const hasFunctionKeywords = keywords.some(kw => 
      /[一覧閲覧登録編集削除コピー機能管理詳細仕様情報データ制限条件方法手順問題原因エラー]/u.test(kw)
    );
    if (hasFunctionKeywords) {
      score += this.config.weights!.functionKeywords;
    } else {
      issues.push('機能キーワードが不足');
    }
    
    // 多様性スコア
    const diversityScore = this.calculateDiversityScore(keywords);
    score += diversityScore;
    
    const isValid = hasMinKeywords && hasEntityKeywords && hasFunctionKeywords;
    
    return {
      isValid,
      score,
      issues,
      breakdown: {
        keywordCount,
        entityKeywords: hasEntityKeywords,
        functionKeywords: hasFunctionKeywords,
        diversityScore
      }
    };
  }

  private checkKeywordCount(keywords: string[]): boolean {
    return keywords.length >= this.config.minKeywordCount!;
  }

  private checkEntityKeywords(keywords: string[]): boolean {
    return keywords.some(kw => 
      kw.length >= 2 && kw.length <= 4 && /[\p{Script=Han}]{2,4}/u.test(kw)
    );
  }

  private checkFunctionKeywords(keywords: string[]): boolean {
    return keywords.some(kw => 
      /[一覧閲覧登録編集削除コピー機能管理詳細仕様情報データ制限条件方法手順問題原因エラー]/u.test(kw)
    );
  }

  private calculateDiversityScore(keywords: string[]): number {
    if (keywords.length === 0) return 0;
    const uniqueKeywords = [...new Set(keywords)];
    return (uniqueKeywords.length / keywords.length) * this.config.weights!.diversity;
  }
}

// キーワード選択クラス
export class KeywordSelector {
  private config: SelectorConfig;

  constructor(config: SelectorConfig = {}) {
    this.config = {
      maxKeywords: 8,
      priorities: {
        basic: 1,
        domain: 2,
        function: 3,
        llm: 4
      },
      ...config
    };
  }

  select(
    basicKeywords: string[],
    domainKeywords: string[],
    functionKeywords: string[],
    llmKeywords: string[]
  ): string[] {
    const selectedKeywords: string[] = [];
    const maxKeywords = this.config.maxKeywords!;
    
    // 優先度順にキーワードを追加
    const allKeywords = [
      ...basicKeywords.map(kw => ({ keyword: kw, priority: this.config.priorities!.basic })),
      ...domainKeywords.map(kw => ({ keyword: kw, priority: this.config.priorities!.domain })),
      ...functionKeywords.map(kw => ({ keyword: kw, priority: this.config.priorities!.function })),
      ...llmKeywords.map(kw => ({ keyword: kw, priority: this.config.priorities!.llm }))
    ];
    
    // 優先度順にソート
    allKeywords.sort((a, b) => a.priority - b.priority);
    
    // 重複を除去しながら選択
    const seen = new Set<string>();
    for (const { keyword } of allKeywords) {
      if (selectedKeywords.length < maxKeywords && !seen.has(keyword.toLowerCase())) {
        selectedKeywords.push(keyword);
        seen.add(keyword.toLowerCase());
      }
    }
    
    return selectedKeywords;
  }

  private prioritizeKeywords(keywords: string[]): string[] {
    return keywords;
  }

  private limitKeywords(keywords: string[], maxCount: number): string[] {
    return keywords.slice(0, maxCount);
  }
}

// メインキーワード抽出クラス
export class KeywordExtractor {
  private basicExtractor: BasicKeywordExtractor;
  private domainExtractor: DomainKeywordExtractor;
  private functionExtractor: FunctionKeywordExtractor;
  private llmExtractor: LLMKeywordExtractor;
  private qualityValidator: KeywordQualityValidator;
  private selector: KeywordSelector;
  private config: KeywordExtractorConfig;

  constructor(config: KeywordExtractorConfig = {}) {
    this.config = config;
    this.basicExtractor = new BasicKeywordExtractor(config.basic);
    this.domainExtractor = new DomainKeywordExtractor(config.domain);
    this.functionExtractor = new FunctionKeywordExtractor(config.function);
    this.llmExtractor = new LLMKeywordExtractor(config.llm);
    this.qualityValidator = new KeywordQualityValidator(config.quality);
    this.selector = new KeywordSelector(config.selector);
  }

  async extract(query: string): Promise<ExtractResult> {
    const startTime = Date.now();
    
    try {
      // 1. 各段階のキーワード抽出
      const basicKeywords = this.basicExtractor.extract(query);
      const domainKeywords = await this.domainExtractor.extract(query);
      const functionKeywords = this.functionExtractor.extract(query);
      const llmKeywords = await this.llmExtractor.extract(query, basicKeywords);
      
      // 2. キーワード選択
      const selectedKeywords = this.selector.select(
        basicKeywords,
        domainKeywords,
        functionKeywords,
        llmKeywords
      );
      
      // 3. 品質検証
      const quality = this.qualityValidator.validate(selectedKeywords);
      
      // 4. 優先度セットの構成
      const highPriority = new Set<string>();
      const lowPriority = new Set<string>();
      
      [...basicKeywords, ...domainKeywords].forEach(kw => {
        if (selectedKeywords.includes(kw)) {
          highPriority.add(kw.toLowerCase());
        }
      });
      
      [...functionKeywords, ...llmKeywords].forEach(kw => {
        if (selectedKeywords.includes(kw) && !highPriority.has(kw.toLowerCase())) {
          lowPriority.add(kw.toLowerCase());
        }
      });
      
      const processingTime = Date.now() - startTime;
      
      return {
        keywords: selectedKeywords,
        highPriority,
        lowPriority,
        quality,
        metadata: {
          timestamp: new Date(),
          query,
          processingTime,
          config: this.config
        }
      };
      
    } catch (error) {
      console.error('[KeywordExtractor] Error in extract:', error);
      
      // エラー時はフォールバック
      const fallbackKeywords = this.basicExtractor.extract(query);
      const quality = this.qualityValidator.validate(fallbackKeywords);
      
      return {
        keywords: fallbackKeywords,
        highPriority: new Set(fallbackKeywords.map(k => k.toLowerCase())),
        lowPriority: new Set(),
        quality,
        metadata: {
          timestamp: new Date(),
          query,
          processingTime: Date.now() - startTime,
          config: this.config
        }
      };
    }
  }

  setConfig(config: KeywordExtractorConfig): void {
    this.config = config;
    this.basicExtractor = new BasicKeywordExtractor(config.basic);
    this.domainExtractor = new DomainKeywordExtractor(config.domain);
    this.functionExtractor = new FunctionKeywordExtractor(config.function);
    this.llmExtractor = new LLMKeywordExtractor(config.llm);
    this.qualityValidator = new KeywordQualityValidator(config.quality);
    this.selector = new KeywordSelector(config.selector);
  }
}

// 設定管理クラス
export class ConfigManager {
  static getProductionConfig(): KeywordExtractorConfig {
    return {
      basic: {
        stopwords: new Set([
          'こと','もの','ため','など','これ','それ','あれ','について','の','は','が','を','に','で','と','や','から','まで','より','へ','も','な','だ','です','ます','ください','教えて','件','ですか','とは'
        ]),
        minLength: 2,
        maxLength: 4
      },
      domain: {
        entityPattern: /[\p{Script=Han}]{2,4}/gu,
        minLength: 2,
        maxLength: 4
      },
      function: {
        patterns: [
          /一覧/, /閲覧/, /登録/, /編集/, /削除/, /コピー/, /複製/,
          /機能/, /管理/, /設定/, /詳細/, /仕様/, /情報/, /データ/,
          /制限/, /条件/, /方法/, /手順/, /問題/, /原因/, /エラー/
        ],
        minLength: 2,
        maxLength: 6
      },
      llm: {
        enabled: process.env.USE_LLM_EXPANSION === 'true',
        model: 'gemini-1.5-flash',
        maxKeywords: 8
      },
      quality: {
        minKeywordCount: 3,
        minScore: 70,
        weights: {
          keywordCount: 30,
          entityKeywords: 30,
          functionKeywords: 30,
          diversity: 10
        }
      },
      selector: {
        maxKeywords: 8,
        priorities: {
          basic: 1,
          domain: 2,
          function: 3,
          llm: 4
        }
      }
    };
  }

  static getDevelopmentConfig(): KeywordExtractorConfig {
    const config = this.getProductionConfig();
    // 開発環境用の追加設定
    return config;
  }

  static getTestConfig(): KeywordExtractorConfig {
    return {
      ...this.getProductionConfig(),
      llm: { enabled: false },
      quality: { minKeywordCount: 1, minScore: 0 }
    };
  }
}
