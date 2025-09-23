# キーワード抽出機能 クラス設計書

## 概要

キーワード抽出機能を関数ベースからクラスベースに変更し、より保守性と拡張性の高い設計を実現する。

## 設計方針

### 1. 単一責任の原則
- 各クラスは明確な責任を持つ
- キーワード抽出の各段階を独立したクラスで管理

### 2. 開放閉鎖の原則
- 新しい抽出方法を追加する際、既存コードを変更せずに拡張可能
- インターフェースベースの設計

### 3. 依存性逆転の原則
- 抽象に依存し、具象に依存しない設計

## クラス構成

### 1. KeywordExtractor (メインクラス)
**責任**: キーワード抽出の全体制御と結果の統合

```typescript
class KeywordExtractor {
  private basicExtractor: BasicKeywordExtractor;
  private domainExtractor: DomainKeywordExtractor;
  private functionExtractor: FunctionKeywordExtractor;
  private llmExtractor: LLMKeywordExtractor;
  private qualityValidator: KeywordQualityValidator;
  
  constructor(config?: KeywordExtractorConfig);
  async extract(query: string): Promise<ExtractResult>;
  setConfig(config: KeywordExtractorConfig): void;
}
```

### 2. BasicKeywordExtractor
**責任**: 基本キーワードの抽出

```typescript
class BasicKeywordExtractor {
  private stopwords: Set<string>;
  private config: BasicExtractorConfig;
  
  constructor(config?: BasicExtractorConfig);
  extract(query: string): string[];
  setStopwords(stopwords: Set<string>): void;
  private splitByParticles(query: string): string[];
  private validateKeyword(keyword: string): boolean;
}
```

### 3. DomainKeywordExtractor
**責任**: ドメイン特化キーワードの抽出

```typescript
class DomainKeywordExtractor {
  private config: DomainExtractorConfig;
  
  constructor(config?: DomainExtractorConfig);
  extract(query: string): string[];
  private extractEntities(query: string): string[];
  private validateEntity(entity: string): boolean;
}
```

### 4. FunctionKeywordExtractor
**責任**: 機能キーワードの抽出

```typescript
class FunctionKeywordExtractor {
  private patterns: RegExp[];
  private config: FunctionExtractorConfig;
  
  constructor(config?: FunctionExtractorConfig);
  extract(query: string): string[];
  addPattern(pattern: RegExp): void;
  removePattern(pattern: RegExp): void;
  private matchPatterns(query: string): string[];
}
```

### 5. LLMKeywordExtractor
**責任**: LLMによるキーワード拡張

```typescript
class LLMKeywordExtractor {
  private apiKey: string;
  private model: string;
  private config: LLMExtractorConfig;
  
  constructor(config: LLMExtractorConfig);
  extract(query: string, baseKeywords: string[]): Promise<string[]>;
  private callLLM(query: string, baseKeywords: string[]): Promise<string[]>;
  private parseLLMResponse(response: string): string[];
}
```

### 6. KeywordQualityValidator
**責任**: キーワード品質の検証

```typescript
class KeywordQualityValidator {
  private config: QualityValidatorConfig;
  
  constructor(config?: QualityValidatorConfig);
  validate(keywords: string[]): QualityResult;
  private checkKeywordCount(keywords: string[]): boolean;
  private checkEntityKeywords(keywords: string[]): boolean;
  private checkFunctionKeywords(keywords: string[]): boolean;
  private calculateDiversityScore(keywords: string[]): number;
}
```

### 7. KeywordSelector
**責任**: 優先度に基づくキーワード選択

```typescript
class KeywordSelector {
  private config: SelectorConfig;
  
  constructor(config?: SelectorConfig);
  select(
    basicKeywords: string[],
    domainKeywords: string[],
    functionKeywords: string[],
    llmKeywords: string[]
  ): string[];
  private prioritizeKeywords(keywords: string[]): string[];
  private limitKeywords(keywords: string[], maxCount: number): string[];
}
```

## インターフェース定義

### 1. KeywordExtractorConfig
```typescript
interface KeywordExtractorConfig {
  basic?: BasicExtractorConfig;
  domain?: DomainExtractorConfig;
  function?: FunctionExtractorConfig;
  llm?: LLMExtractorConfig;
  quality?: QualityValidatorConfig;
  selector?: SelectorConfig;
}
```

### 2. ExtractResult
```typescript
interface ExtractResult {
  keywords: string[];
  highPriority: Set<string>;
  lowPriority: Set<string>;
  quality: QualityResult;
  metadata: ExtractionMetadata;
}
```

### 3. QualityResult
```typescript
interface QualityResult {
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
```

## 設定管理

### 1. 環境別設定
```typescript
class ConfigManager {
  static getProductionConfig(): KeywordExtractorConfig;
  static getDevelopmentConfig(): KeywordExtractorConfig;
  static getTestConfig(): KeywordExtractorConfig;
  static loadFromFile(filePath: string): KeywordExtractorConfig;
  static saveToFile(config: KeywordExtractorConfig, filePath: string): void;
}
```

### 2. 設定ファイル例
```json
{
  "basic": {
    "stopwords": ["こと", "もの", "ため"],
    "minLength": 2,
    "maxLength": 4
  },
  "domain": {
    "entityPattern": "/[\\p{Script=Han}]{2,4}/gu",
    "minLength": 2,
    "maxLength": 4
  },
  "function": {
    "patterns": ["一覧", "登録", "編集", "削除"],
    "minLength": 2,
    "maxLength": 6
  },
  "llm": {
    "enabled": true,
    "model": "gemini-1.5-flash",
    "maxKeywords": 8
  },
  "quality": {
    "minKeywordCount": 3,
    "minScore": 70,
    "weights": {
      "keywordCount": 30,
      "entityKeywords": 30,
      "functionKeywords": 30,
      "diversity": 10
    }
  },
  "selector": {
    "maxKeywords": 8,
    "priorities": {
      "basic": 1,
      "domain": 2,
      "function": 3,
      "llm": 4
    }
  }
}
```

## 使用例

### 1. 基本的な使用
```typescript
const extractor = new KeywordExtractor();
const result = await extractor.extract("教室管理の詳細は");
console.log(result.keywords);
```

### 2. カスタム設定での使用
```typescript
const config: KeywordExtractorConfig = {
  basic: { stopwords: new Set(["カスタム"]) },
  llm: { enabled: false }
};
const extractor = new KeywordExtractor(config);
const result = await extractor.extract("教室管理の詳細は");
```

### 3. 個別コンポーネントの使用
```typescript
const basicExtractor = new BasicKeywordExtractor();
const basicKeywords = basicExtractor.extract("教室管理の詳細は");

const qualityValidator = new KeywordQualityValidator();
const quality = qualityValidator.validate(basicKeywords);
```

## メリット

### 1. 保守性の向上
- 各機能が独立したクラスで管理される
- 単一責任の原則により、変更の影響範囲が明確

### 2. 拡張性の向上
- 新しい抽出方法を追加する際、既存コードを変更せずに拡張可能
- インターフェースベースの設計により、実装の差し替えが容易

### 3. テスト性の向上
- 各クラスを独立してテスト可能
- モックオブジェクトの使用が容易

### 4. 設定管理の改善
- 環境別の設定管理が容易
- 設定ファイルによる外部設定が可能

## 移行計画

### Phase 1: クラス設計の実装
1. インターフェース定義
2. 各クラスの実装
3. 設定管理クラスの実装

### Phase 2: 既存コードの移行
1. 関数ベースからクラスベースへの移行
2. 既存のテストの更新
3. ドキュメントの更新

### Phase 3: 最適化とテスト
1. パフォーマンステスト
2. 統合テスト
3. 本番環境での検証

## 注意事項

1. **後方互換性**: 既存の関数ベースのAPIも維持
2. **パフォーマンス**: クラス化によるオーバーヘッドを最小限に抑制
3. **設定の複雑性**: 設定項目の増加による複雑性を管理
