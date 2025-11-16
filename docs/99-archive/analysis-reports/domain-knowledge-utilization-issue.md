# ドメイン知識活用の問題点分析

**作成日**: 2025年11月2日  
**問題**: ドメイン知識に「教室削除機能」が含まれているが、検索で活用されていない

## 📋 現状確認

### ドメイン知識ファイルの内容

`data/domain-knowledge-v2/keyword-lists-v2.json` に以下の機能名が含まれています：

- **1796行目**: `"教室削除機能"` (functionNames カテゴリ)
- **1761行目**: `"教室グループ削除機能"` (functionNames カテゴリ)

### キーワード抽出の流れ

1. **クエリ**: 「教室削除ができないのは何が原因ですか」
2. **キーワード抽出**: `unified-keyword-extraction-service.ts`
   - `extractKeywordsFromCategories()` が呼ばれる
   - `findMatchingKeywords()` で functionNames カテゴリからマッチするキーワードを抽出
3. **問題**: `findMatchingKeywords()` の実装では、以下の条件でマッチング：
   ```typescript
   // 1. 完全一致を優先（最高優先度）
   if (queryWords.some(word => keyword === word)) {
     matchedKeywords.push(keyword);
   }
   
   // 2. クエリ全体にキーワードが含まれる（2文字以上）
   if (keyword.length >= 2 && queryLower.includes(keywordLower)) {
     matchedKeywords.push(keyword);
   }
   ```

## 🔍 問題の根本原因

### 問題1: 逆方向のマッチングができない

**現在の実装**:
- クエリ: 「教室削除ができない」
- キーワード: 「教室削除機能」
- **結果**: マッチしない ❌
  - 完全一致: 「教室削除機能」は「教室削除ができない」の単語に含まれない
  - 部分一致: 「教室削除ができない」に「教室削除機能」は含まれない

**期待される動作**:
- クエリ: 「教室削除ができない」
- キーワード: 「教室削除機能」
- **結果**: マッチする ✅
  - 「教室削除」がクエリに含まれる → 「教室削除機能」を抽出

### 問題2: 機能名の優先度が反映されていない

**現在の実装**:
```typescript
// calculateDynamicPriority では、機能名カテゴリの優先度が考慮されていない
private calculateDynamicPriority(keyword: string, queryAnalysis: any): number {
  let priority = 0;
  
  // 核心単語との完全一致
  if (queryAnalysis.coreWords.includes(keyword)) {
    priority += 100;
  }
  
  // ドメインとの関連性
  if (queryAnalysis.domain !== 'unknown' && keyword.includes(queryAnalysis.domain)) {
    priority += 80;
  }
  
  // 長さによる調整
  if (keyword.length >= 2 && keyword.length <= 8) {
    priority += 20;
  }
  
  return priority;
}
```

**問題点**:
- `functionNames` カテゴリの優先度（80）が考慮されていない
- 機能名であることを認識する仕組みがない

### 問題3: タイトルマッチングで機能名が活用されていない

**現在の実装**:
```typescript
// calculateTitleMatch では、抽出されたキーワードのみをチェック
function calculateTitleMatch(title: string, keywords: string[]): {
  matchedKeywords: string[];
  titleMatchRatio: number;
} {
  const titleLower = String(title || '').toLowerCase();
  const matchedKeywords = keywords.filter(kw => titleLower.includes(kw.toLowerCase()));
  const titleMatchRatio = keywords.length > 0 ? matchedKeywords.length / keywords.length : 0;
  
  return { matchedKeywords, titleMatchRatio };
}
```

**問題点**:
- 「教室削除機能」がキーワードとして抽出されていない場合、タイトルマッチングで活用されない
- タイトルに「教室削除機能」が含まれていても、キーワードに含まれていないとスコアが低い

## 🎯 改善案

### ⚠️ 改善案1の注意点

**懸念事項**: 逆方向のマッチングを追加すると、汎用語のヒットが増加する可能性があります。

**問題のあるケース**:
- クエリ: 「削除」
- 逆方向マッチング: 「削除」がクエリに含まれる → 「削除機能」「削除管理」「削除操作」など、多くの汎用的なキーワードが抽出される
- 結果: 汎用語が大量にヒットして品質が低下する ❌

**安全な改善案は別ドキュメントを参照**: [ドメイン知識活用の安全な改善案](./domain-knowledge-utilization-issue-safe-improvement.md)

### 改善案1: 逆方向のマッチングを追加（⚠️ 注意: 汎用語ヒットのリスクあり）

**実装内容**:
```typescript
private findMatchingKeywords(query: string, keywords: string[]): string[] {
  const matchedKeywords: string[] = [];
  const queryWords = this.extractQueryWords(query);
  const queryLower = query.toLowerCase();
  
  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase();
    
    // 1. 完全一致を優先（最高優先度）
    if (queryWords.some(word => keyword === word)) {
      matchedKeywords.push(keyword);
      continue;
    }
    
    // 2. クエリ全体にキーワードが含まれる（2文字以上）
    if (keyword.length >= 2 && queryLower.includes(keywordLower)) {
      matchedKeywords.push(keyword);
      continue;
    }
    
    // 3. 【新規】逆方向マッチング: キーワードの一部がクエリに含まれる
    // 例: 「教室削除」がクエリに含まれる → 「教室削除機能」を抽出
    const keywordParts = this.extractKeywordParts(keyword);
    const hasPartialMatch = keywordParts.some(part => 
      part.length >= 2 && queryLower.includes(part.toLowerCase())
    );
    
    if (hasPartialMatch) {
      matchedKeywords.push(keyword);
      continue;
    }
    
    // 4. 最大20個までに制限
    if (matchedKeywords.length >= 20) {
      break;
    }
  }
  
  return matchedKeywords;
}

/**
 * キーワードから意味のある部分を抽出
 * 例: 「教室削除機能」→「教室削除」「削除」「機能」
 */
private extractKeywordParts(keyword: string): string[] {
  const parts: string[] = [keyword]; // 全体も含める
  
  // 「機能」を除去して部分を抽出
  const withoutSuffix = keyword.replace(/機能$/, '');
  if (withoutSuffix !== keyword) {
    parts.push(withoutSuffix);
  }
  
  // 複合語を分割（例: 「教室削除」→「教室」「削除」）
  const words = withoutSuffix.split(/(?=[A-Z])|(?<=[A-Z])/); // キャメルケース対応
  parts.push(...words.filter(w => w.length >= 2));
  
  return [...new Set(parts)]; // 重複除去
}
```

### 改善案2: 機能名カテゴリの優先度を反映

**実装内容**:
```typescript
private calculateDynamicPriority(keyword: string, queryAnalysis: any): number {
  let priority = 0;
  
  // 核心単語との完全一致
  if (queryAnalysis.coreWords.includes(keyword)) {
    priority += 100;
  }
  
  // 【新規】機能名カテゴリの優先度を反映
  if (this.keywordCategories?.functionNames.includes(keyword)) {
    priority += 80; // functionNames の basePriority
  }
  
  // ドメインとの関連性
  if (queryAnalysis.domain !== 'unknown' && keyword.includes(queryAnalysis.domain)) {
    priority += 80;
  }
  
  // 長さによる調整
  if (keyword.length >= 2 && keyword.length <= 8) {
    priority += 20;
  }
  
  return priority;
}
```

### 改善案3: タイトルマッチングで機能名を直接チェック

**実装内容**:
```typescript
function calculateTitleMatch(title: string, keywords: string[]): {
  matchedKeywords: string[];
  titleMatchRatio: number;
  functionNameMatch?: boolean; // 新規追加
} {
  const titleLower = String(title || '').toLowerCase();
  const matchedKeywords = keywords.filter(kw => titleLower.includes(kw.toLowerCase()));
  
  // 【新規】機能名の完全一致をチェック
  // ドメイン知識から機能名を直接取得してチェック
  let functionNameMatch = false;
  if (this.keywordCategories?.functionNames) {
    const exactFunctionMatch = this.keywordCategories.functionNames.find(fn => 
      titleLower.includes(fn.toLowerCase())
    );
    if (exactFunctionMatch) {
      functionNameMatch = true;
      // 機能名がマッチした場合、スコアをブースト
      matchedKeywords.push(exactFunctionMatch);
    }
  }
  
  const titleMatchRatio = keywords.length > 0 ? matchedKeywords.length / keywords.length : 0;
  
  return { 
    matchedKeywords: [...new Set(matchedKeywords)], 
    titleMatchRatio,
    functionNameMatch 
  };
}
```

## 📊 期待される改善効果

### 改善前
- 「教室削除ができない」というクエリから「教室削除機能」が抽出されない
- 「教室削除機能」がタイトルマッチングで活用されない
- 「教室グループ削除機能」と「教室削除機能」が区別できない

### 改善後
- 「教室削除ができない」というクエリから「教室削除機能」が抽出される ✅
- 「教室削除機能」がタイトルマッチングで優先される ✅
- 「教室削除機能」が「教室グループ削除機能」より優先される ✅

## 🔗 関連ドキュメント

- [検索品質問題詳細分析](./search-quality-classroom-deletion-detailed-analysis.md)
- [統一キーワード抽出サービス実装](../src/lib/unified-keyword-extraction-service.ts)
- [タイトル検索サービス実装](../src/lib/title-search-service.ts)
- [LanceDB検索クライアント実装](../src/lib/lancedb-search-client.ts)

