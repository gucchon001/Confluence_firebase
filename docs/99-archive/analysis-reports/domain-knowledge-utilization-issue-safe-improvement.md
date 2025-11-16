# ドメイン知識活用の安全な改善案

**作成日**: 2025年11月2日  
**問題**: 逆方向マッチングが汎用語のヒットを増やし、品質を低下させる可能性

## ⚠️ 懸念事項

### 問題のあるケース

**改善案1（逆方向マッチング）の問題**:
- クエリ: 「削除」
- 逆方向マッチング: 「削除」がクエリに含まれる → 「削除機能」「削除管理」「削除操作」など、多くの汎用的なキーワードが抽出される
- 結果: 汎用語が大量にヒットして品質が低下する ❌

**確認結果**:
- `keyword-lists-v2.json` には「削除機能」だけでなく、「○○削除機能」が多数存在
- 単独の「削除」だけでマッチングすると、30件以上の削除関連機能が抽出される可能性

## 🛡️ 安全な改善案

### 改善案1A: functionNames カテゴリに限定した逆方向マッチング

**実装内容**:
```typescript
import { CommonTermsHelper, GENERIC_FUNCTION_TERMS_SET } from './common-terms-config';

/**
 * functionNames カテゴリに限定した逆方向マッチング
 * 汎用語のヒットを防ぐため、functionNames のみに適用
 */
private findMatchingKeywords(query: string, keywords: string[], category: 'functionNames' | 'other'): string[] {
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
    
    // 3. 【安全版】functionNames カテゴリのみ逆方向マッチング
    if (category === 'functionNames') {
      // 複合語の部分一致のみ（単独の汎用語は除外）
      const keywordParts = this.extractKeywordPartsSafely(keyword);
      const hasPartialMatch = keywordParts.some(part => {
        // 汎用語を除外
        if (this.isGenericTerm(part)) {
          return false;
        }
        // 3文字以上の部分のみマッチング（「教室削除」→「教室削除機能」はOK、「削除」→「削除機能」はNG）
        return part.length >= 3 && queryLower.includes(part.toLowerCase());
      });
      
      if (hasPartialMatch) {
        matchedKeywords.push(keyword);
        continue;
      }
    }
    
    // 4. 最大20個までに制限
    if (matchedKeywords.length >= 20) {
      break;
    }
  }
  
  return matchedKeywords;
}

/**
 * 安全なキーワード部分抽出
 * 汎用語を除外し、意味のある複合語のみを抽出
 * 既存の common-terms-config.ts の CommonTermsHelper を使用
 */
private extractKeywordPartsSafely(keyword: string): string[] {
  const parts: string[] = [];
  
  // 「機能」「管理」などの接尾辞を除去（GENERIC_FUNCTION_TERMS から判定）
  const genericSuffixes = ['機能', '管理', '操作', '画面', 'ページ'];
  const suffixPattern = new RegExp(`(${genericSuffixes.join('|')})$`);
  const withoutSuffix = keyword.replace(suffixPattern, '');
  
  if (withoutSuffix !== keyword && withoutSuffix.length >= 3) {
    parts.push(withoutSuffix);
  }
  
  // 複合語を分割（例: 「教室削除」→「教室削除」「教室」）
  // ただし、「削除」単独は除外（汎用語のため）
  const compoundParts = this.splitCompoundWord(withoutSuffix);
  parts.push(...compoundParts.filter(p => 
    p.length >= 3 && !CommonTermsHelper.isGenericFunctionTerm(p)
  ));
  
  return [...new Set(parts)]; // 重複除去
}

/**
 * 複合語を分割
 * 例: 「教室削除機能」→「教室削除」「教室」
 */
private splitCompoundWord(word: string): string[] {
  const parts: string[] = [word]; // 全体も含める
  
  // 漢字の境界で分割（意味のある部分のみ）
  // 例: 「教室削除」→「教室削除」「教室」
  if (word.length >= 4) {
    // 前半部分を抽出（例: 「教室削除」→「教室」）
    const halfLength = Math.floor(word.length / 2);
    const firstPart = word.substring(0, halfLength);
    if (firstPart.length >= 2 && !CommonTermsHelper.isGenericFunctionTerm(firstPart)) {
      parts.push(firstPart);
    }
  }
  
  return parts;
}
```

**安全性**:
- ✅ functionNames カテゴリのみに適用 → 汎用語のヒットを制限
- ✅ 3文字以上の部分のみマッチング → 「削除」単独ではマッチしない
- ✅ 汎用語を除外 → 「削除」「管理」などの単独語は除外

### 改善案1B: 優先度付けで機能名を強化（逆方向マッチングなし）

**実装内容**:
```typescript
/**
 * 機能名カテゴリの優先度を反映
 * 逆方向マッチングは行わず、既存のマッチング結果を優先度付けで強化
 */
private extractKeywordsFromCategories(query: string): {
  domainNames: string[];
  functionNames: string[];
  operationNames: string[];
  systemFields: string[];
  systemTerms: string[];
  relatedKeywords: string[];
  allKeywords: string[];
} {
  if (!this.keywordCategories) {
    return {
      domainNames: [],
      functionNames: [],
      operationNames: [],
      systemFields: [],
      systemTerms: [],
      relatedKeywords: [],
      allKeywords: []
    };
  }

  const result = {
    domainNames: this.findMatchingKeywords(query, this.keywordCategories.domainNames, 'other'),
    functionNames: this.findMatchingKeywords(query, this.keywordCategories.functionNames, 'functionNames'),
    operationNames: this.findMatchingKeywords(query, this.keywordCategories.operationNames, 'other'),
    systemFields: this.findMatchingKeywords(query, this.keywordCategories.systemFields, 'other'),
    systemTerms: this.findMatchingKeywords(query, this.keywordCategories.systemTerms, 'other'),
    relatedKeywords: this.findMatchingKeywords(query, this.keywordCategories.relatedKeywords, 'other'),
    allKeywords: [] as string[]
  };

  // 全キーワードを結合（functionNames を優先）
  result.allKeywords = [
    ...result.functionNames, // functionNames を先頭に配置
    ...result.domainNames,
    ...result.operationNames,
    ...result.systemFields,
    ...result.systemTerms,
    ...result.relatedKeywords
  ];

  // 重複除去
  result.allKeywords = [...new Set(result.allKeywords)];

  return result;
}

/**
 * 機能名カテゴリの優先度を反映
 */
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

**安全性**:
- ✅ 逆方向マッチングなし → 汎用語のヒットを完全に防止
- ✅ 機能名カテゴリの優先度を反映 → 既存のマッチング結果を強化
- ✅ 既存のマッチングロジックを維持 → デグレードのリスクが低い

### 改善案1C: タイトルマッチングで機能名を直接チェック（推奨）

**実装内容**:
```typescript
/**
 * タイトルマッチングで機能名を直接チェック
 * 逆方向マッチングは行わず、タイトルマッチング時にドメイン知識の機能名を直接参照
 */
function calculateTitleMatch(
  title: string, 
  keywords: string[],
  functionNames?: string[] // 新規追加
): {
  matchedKeywords: string[];
  titleMatchRatio: number;
  functionNameMatch?: boolean;
} {
  const titleLower = String(title || '').toLowerCase();
  const matchedKeywords = keywords.filter(kw => titleLower.includes(kw.toLowerCase()));
  
  let functionNameMatch = false;
  
  // 【新規】機能名の直接チェック
  if (functionNames && functionNames.length > 0) {
    const exactFunctionMatch = functionNames.find(fn => 
      titleLower.includes(fn.toLowerCase())
    );
    
    if (exactFunctionMatch) {
      functionNameMatch = true;
      // 機能名がマッチした場合、キーワードリストに追加（重複除去）
      if (!matchedKeywords.includes(exactFunctionMatch)) {
        matchedKeywords.push(exactFunctionMatch);
      }
    }
  }
  
  const titleMatchRatio = keywords.length > 0 
    ? matchedKeywords.length / keywords.length 
    : 0;
  
  return { 
    matchedKeywords: [...new Set(matchedKeywords)], 
    titleMatchRatio,
    functionNameMatch 
  };
}

/**
 * タイトルマッチングで機能名を直接チェック（呼び出し側）
 */
// lancedb-search-client.ts で使用
const functionNames = this.keywordCategories?.functionNames || [];
const { matchedKeywords, titleMatchRatio, functionNameMatch } = calculateTitleMatch(
  result.title, 
  finalKeywords,
  functionNames // 機能名リストを渡す
);

if (functionNameMatch) {
  // 機能名完全一致の場合はスコアをブースト
  result._functionNameExactMatch = true;
  result._titleMatchRatio = Math.max(titleMatchRatio, 0.9); // 最低90%
}
```

**安全性**:
- ✅ 逆方向マッチングなし → 汎用語のヒットを完全に防止
- ✅ タイトルマッチング時に機能名を直接チェック → より正確なマッチング
- ✅ 既存のキーワード抽出ロジックを変更しない → デグレードのリスクが低い

## 📊 改善案の比較

| 改善案 | 汎用語ヒット防止 | 実装難易度 | デグレードリスク | 効果 |
|--------|----------------|-----------|----------------|------|
| 1A: functionNames限定逆方向 | ⚠️ 中（フィルタリング必要） | 高 | 中 | 高 |
| 1B: 優先度付け強化 | ✅ 高（逆方向なし） | 低 | 低 | 中 |
| 1C: タイトルマッチング直接チェック | ✅ 高（逆方向なし） | 中 | 低 | 高 |

## 🎯 推奨改善案

**改善案1C（タイトルマッチングで機能名を直接チェック）を推奨**

**理由**:
1. ✅ 汎用語のヒットを完全に防止
2. ✅ 既存のキーワード抽出ロジックを変更しない
3. ✅ タイトルマッチング時に機能名を直接チェックするため、より正確
4. ✅ デグレードのリスクが低い

**実装手順**:
1. `calculateTitleMatch` 関数に `functionNames` パラメータを追加
2. タイトルマッチング時に機能名を直接チェック
3. 機能名がマッチした場合、スコアをブースト
4. 既存のキーワード抽出ロジックは変更しない

## 🔗 関連ドキュメント

- [ドメイン知識活用の問題点分析](./domain-knowledge-utilization-issue.md)
- [検索品質問題詳細分析](./search-quality-classroom-deletion-detailed-analysis.md)
- [統一キーワード抽出サービス実装](../src/lib/unified-keyword-extraction-service.ts)
- [タイトル検索サービス実装](../src/lib/title-search-service.ts)

