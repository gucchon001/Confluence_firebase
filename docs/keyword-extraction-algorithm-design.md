# キーワード抽出アルゴリズム設計方針

## 概要

仕様書の理想に合わせるためのキーワード抽出アルゴリズムの設計方針です。ドメイン知識を活用し、教室管理機能に特化した高精度なキーワード抽出を実現します。

## 設計目標

### 1. 仕様書の理想キーワードとの一致
```json
{
  "keywords": [
    "教室管理", "教室", "教室一覧", "教室登録", 
    "教室編集", "教室削除", "教室コピー", "教室管理の詳細"
  ],
  "highPriority": ["教室管理", "教室"],
  "lowPriority": ["教室一覧", "教室登録", "教室編集", "教室削除", "教室コピー", "教室管理の詳細"]
}
```

### 2. 品質メトリクス目標
- **キーワード数**: 8件（理想と一致）
- **品質スコア**: 80%以上
- **基本キーワード保持率**: 100%（教室、管理、詳細）
- **機能キーワード抽出率**: 75%以上（教室一覧、教室登録、教室編集、教室削除、教室コピー）

## ドメイン知識の活用

### 1. ドメイン知識ファイルの参照
- `data/domain-knowledge-v2/final-domain-knowledge-v2.json`
- `src/lib/keyword-deduplicator-v2.ts`の`DOMAIN_PATTERNS`

### 2. 教室管理関連ドメインパターン
```typescript
const CLASSROOM_DOMAIN_PATTERNS = [
  /教室管理/,
  /教室管理機能/,
  /教室管理-求人管理機能/,
  /求人・教室管理機能/
];
```

### 3. 教室管理機能名パターン
```typescript
const CLASSROOM_FUNCTION_PATTERNS = [
  /教室一覧/,
  /教室登録/,
  /教室編集/,
  /教室削除/,
  /教室コピー/,
  /教室新規登録/,
  /教室情報編集/,
  /教室掲載フラグ/,
  /教室公開フラグ/
];
```

## アルゴリズム設計

### 1. 階層的キーワード抽出戦略

#### 1.1 基本キーワード抽出（最優先）
```typescript
function extractBasicKeywords(query: string): string[] {
  // 元のクエリから基本キーワードを抽出
  const basicKeywords = query.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}A-Za-z0-9_.-]+/u) || [];
  
  // 長さ制限（2-4文字）
  return basicKeywords.filter(kw => kw.length >= 2 && kw.length <= 4);
}
```

#### 1.2 ドメイン特化キーワード抽出（高優先度）
```typescript
function extractDomainKeywords(query: string): string[] {
  const domainKeywords: string[] = [];
  
  // 教室管理ドメインパターンマッチング
  if (/教室管理/.test(query)) {
    domainKeywords.push('教室管理');
  }
  
  // エンティティキーワード抽出
  if (/教室/.test(query)) {
    domainKeywords.push('教室');
  }
  
  return domainKeywords;
}
```

#### 1.3 機能キーワード抽出（中優先度）
```typescript
function extractFunctionKeywords(query: string): string[] {
  const functionKeywords: string[] = [];
  
  // 仕様書で定義された機能名パターン
  const functionPatterns = [
    { pattern: /教室一覧/, keyword: '教室一覧' },
    { pattern: /教室登録/, keyword: '教室登録' },
    { pattern: /教室編集/, keyword: '教室編集' },
    { pattern: /教室削除/, keyword: '教室削除' },
    { pattern: /教室コピー/, keyword: '教室コピー' },
    { pattern: /詳細/, keyword: '教室管理の詳細' }
  ];
  
  for (const { pattern, keyword } of functionPatterns) {
    if (pattern.test(query)) {
      functionKeywords.push(keyword);
    }
  }
  
  return functionKeywords;
}
```

#### 1.4 LLM拡張キーワード抽出（補完）
```typescript
async function expandWithLLM(query: string, baseKeywords: string[]): Promise<string[]> {
  // ドメイン知識を活用したLLM拡張
  const domainContext = `
    教室管理システムの機能名:
    - 教室一覧閲覧機能
    - 教室新規登録機能  
    - 教室情報編集機能
    - 教室削除機能
    - 教室コピー機能
    - 教室掲載フラグ切り替え機能
    - 教室公開フラグ切り替え機能
  `;
  
  const prompt = `
    あなたは教室管理システムの専門家です。
    以下の質問文に対し、実際の機能名に基づいた具体的なキーワードを最大8件、JSON配列で返してください。
    
    ${domainContext}
    
    重要: 汎用的すぎるキーワードは避け、実際の機能名を優先してください。
    出力はJSON配列のみ。
    質問文: ${query}
  `;
  
  // LLM API呼び出し
  const response = await callLLM(prompt);
  return parseKeywordsFromResponse(response);
}
```

### 2. キーワード優先度制御

#### 2.1 優先度定義
```typescript
enum KeywordPriority {
  CRITICAL = 1,    // 基本キーワード（教室、管理、詳細）
  HIGH = 2,        // ドメインキーワード（教室管理）
  MEDIUM = 3,      // 機能キーワード（教室一覧、教室登録等）
  LOW = 4          // LLM拡張キーワード
}
```

#### 2.2 優先度別キーワード選択
```typescript
function selectKeywordsByPriority(
  basicKeywords: string[],
  domainKeywords: string[],
  functionKeywords: string[],
  llmKeywords: string[]
): string[] {
  const selectedKeywords: string[] = [];
  const maxKeywords = 8;
  
  // 1. 基本キーワードを最優先で追加
  for (const kw of basicKeywords) {
    if (selectedKeywords.length < maxKeywords && !selectedKeywords.includes(kw)) {
      selectedKeywords.push(kw);
    }
  }
  
  // 2. ドメインキーワードを追加
  for (const kw of domainKeywords) {
    if (selectedKeywords.length < maxKeywords && !selectedKeywords.includes(kw)) {
      selectedKeywords.push(kw);
    }
  }
  
  // 3. 機能キーワードを追加
  for (const kw of functionKeywords) {
    if (selectedKeywords.length < maxKeywords && !selectedKeywords.includes(kw)) {
      selectedKeywords.push(kw);
    }
  }
  
  // 4. LLM拡張キーワードで補完
  for (const kw of llmKeywords) {
    if (selectedKeywords.length < maxKeywords && !selectedKeywords.includes(kw)) {
      selectedKeywords.push(kw);
    }
  }
  
  return selectedKeywords;
}
```

### 3. 品質保証メカニズム

#### 3.1 キーワード長さ制御
```typescript
function validateKeywordLength(keyword: string): boolean {
  // 2-8文字の範囲内
  return keyword.length >= 2 && keyword.length <= 8;
}
```

#### 3.2 重複除去
```typescript
function removeDuplicates(keywords: string[]): string[] {
  const seen = new Set<string>();
  return keywords.filter(kw => {
    const normalized = kw.toLowerCase();
    if (seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}
```

#### 3.3 品質チェック
```typescript
function validateKeywordQuality(keywords: string[]): {
  isValid: boolean;
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0;
  
  // 基本キーワードチェック
  const hasClassroom = keywords.some(kw => kw.includes('教室'));
  const hasManagement = keywords.some(kw => kw.includes('管理'));
  const hasDetail = keywords.some(kw => kw.includes('詳細'));
  
  if (hasClassroom) score += 25;
  else issues.push('教室キーワードが不足');
  
  if (hasManagement) score += 25;
  else issues.push('管理キーワードが不足');
  
  if (hasDetail) score += 25;
  else issues.push('詳細キーワードが不足');
  
  // 機能キーワードチェック
  const functionKeywords = ['教室一覧', '教室登録', '教室編集', '教室削除', '教室コピー'];
  const foundFunctions = functionKeywords.filter(fk => 
    keywords.some(kw => kw.includes(fk))
  );
  
  score += (foundFunctions.length / functionKeywords.length) * 25;
  
  if (foundFunctions.length < 3) {
    issues.push('機能キーワードが不足');
  }
  
  return {
    isValid: issues.length === 0,
    score,
    issues
  };
}
```

## 実装計画

### Phase 1: 基本構造の実装（1-2日）
1. 階層的キーワード抽出関数の実装
2. 優先度制御メカニズムの実装
3. 品質保証メカニズムの実装

### Phase 2: ドメイン知識統合（2-3日）
1. ドメイン知識ファイルの読み込み機能
2. ドメインパターンマッチングの実装
3. LLM拡張のドメイン知識活用

### Phase 3: テストと最適化（1-2日）
1. 仕様書の理想キーワードとの一致テスト
2. 品質メトリクスの検証
3. パラメータの調整

## 期待される効果

### 1. キーワード抽出精度の向上
- 理想キーワードとの一致率: 47.1% → 80%以上
- 機能キーワード抽出率: 25% → 75%以上

### 2. 検索品質の向上
- 教室管理機能ページの検索精度向上
- 関連性の低いページの除外精度向上

### 3. ドメイン知識の活用
- 実際のシステム機能名に基づくキーワード抽出
- 汎用語による過度なヒットの抑制

## 継続的改善

### 1. 定期的な品質評価
- 週次でのキーワード抽出品質テスト
- 月次でのドメイン知識更新

### 2. フィードバックループ
- 検索結果の品質評価
- ユーザーフィードバックの収集
- アルゴリズムの継続的改善

### 3. ドメイン知識の拡張
- 新しい機能の追加に伴うキーワードパターンの更新
- システム仕様変更への対応
