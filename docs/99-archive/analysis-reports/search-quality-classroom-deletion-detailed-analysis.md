# 検索品質問題詳細分析: 「教室削除ができないのは何が原因ですか」

**作成日**: 2025年11月2日  
**最終更新**: 2025年11月6日  
**統合元**: `search-quality-classroom-deletion-issue.md`  
**問題**: 「164__【FIX】教室削除機能」が上位に表示されず、「教室グループ削除機能」が上位に表示される

## 📋 問題の詳細

### 期待される動作
- **クエリ**: 「教室削除ができないのは何が原因ですか」
- **期待される結果**: 「164__【FIX】教室削除機能」が1位に表示される
- **理想的な回答**: NotebookLMのような詳細な説明（削除条件、制限事項、実行時の動作など）

### 実際の動作
- 「155_【FIX】教室グループ削除機能」が上位に表示される
- 「164__【FIX】教室削除機能」が上位に表示されない

## 🔍 詳細な原因分析

### 1. キーワード抽出の流れ

#### 1.1 キーワード抽出の実装
```typescript
// unified-keyword-extraction-service.ts
// クエリ: 「教室削除ができないのは何が原因ですか」
// 抽出されたキーワード: ['教室削除', '削除', 'できない', '原因', ...]

// enhanced-keyword-extractor.ts
// ネガティブワード除去: 'できない' → 除去
// 核心キーワード: ['教室削除', '削除', '原因', ...]
// 優先キーワード: ['教室削除', '削除', '原因'] (上位3つ)
```

#### 1.2 問題点
- 「教室削除」というキーワードが抽出される
- しかし、「教室削除機能」という機能名を特定する仕組みがない
- 「教室削除」は「教室削除機能」と「教室グループ削除機能」の両方にマッチする

### 2. タイトル救済検索（title-exact）の流れ

#### 2.1 タイトル候補生成
```typescript
// generateTitleCandidates関数
// キーワード: ['教室削除', '削除', '原因']
// 生成される候補:
//   - '教室削除'
//   - '削除'
//   - '原因'
//   - '教室削除削除'
//   - '教室削除原因'
//   - '削除原因'
//   - ...
```

#### 2.2 LIKE検索の実行
```typescript
// タイトル候補: '教室削除'
// LIKE検索: `title LIKE '%教室削除%'`
// マッチするタイトル:
//   - '164__【FIX】教室削除機能' ✅
//   - '155_【FIX】教室グループ削除機能' ✅
//   - その他「教室削除」を含むタイトル
```

#### 2.3 問題点
- 両方のタイトルが`_sourceType: 'title-exact'`としてマークされる
- 両方とも`_distance: 0.2`が設定される（同じスコア）
- 機能名の完全一致を優先する仕組みがない

### 3. RRF融合の流れ

#### 3.1 RRF融合の実装
```typescript
// RRF融合の重み:
//   - vector: 1.0
//   - keyword: 0.8
//   - title-exact: 1.2 (重みが高い)
//   - bm25: 0.6

// 両方ともtitle-exactとして扱われる場合:
//   - '164__【FIX】教室削除機能': rrf = 1.2 * (1 / (60 + titleRank))
//   - '155_【FIX】教室グループ削除機能': rrf = 1.2 * (1 / (60 + titleRank))
//   - titleRankが同じ場合、両方とも同じRRFスコアになる
```

#### 3.2 問題点
- `title-exact`の重みは高い（1.2）が、機能名の明確化ができない
- タイトル部分一致検索（title-partial）がRRF融合に含まれていない
- 機能名の完全一致を優先する仕組みがない

### 4. タイトル部分一致検索（title-partial）が使われていない

#### 4.1 実装状況
- `title-search-service.ts`には`searchTitlePartial`関数がある
- しかし、`lancedb-search-client.ts`では使われていない
- タイトル部分一致検索の結果がRRF融合に含まれていない

#### 4.2 問題点
- タイトル部分一致検索は、キーワードがタイトルに含まれるかどうかをチェックする
- しかし、この結果がRRF融合に含まれていないため、機能名の明確化に活用されていない

### 5. 機能名マッチングの問題

#### 5.1 現在の実装
```typescript
// calculateTitleMatch関数
// タイトル: '164__【FIX】教室削除機能'
// キーワード: ['教室削除', '削除', '原因']
// マッチするキーワード: ['教室削除', '削除']
// titleMatchRatio: 2/3 = 0.67 (66%以上 → 10倍ブースト)

// タイトル: '155_【FIX】教室グループ削除機能'
// キーワード: ['教室削除', '削除', '原因']
// マッチするキーワード: ['削除']
// titleMatchRatio: 1/3 = 0.33 (33%以上 → 5倍ブースト)
```

#### 5.2 問題点
- 「教室削除機能」の方が`titleMatchRatio`が高い（0.67 vs 0.33）
- しかし、RRF融合では`title-exact`の重みが高すぎて、この差が埋められてしまう
- 機能名の完全一致を優先する仕組みがない

### 6. ベクトル検索とBM25検索の影響

#### 6.1 ベクトル検索
- ベクトル検索では、タイトルにキーワードが含まれる場合、距離をブースト
- しかし、「教室削除機能」と「教室グループ削除機能」の両方が類似度が高い可能性がある

#### 6.2 BM25検索
- BM25検索では、タイトルにキーワードが含まれる場合、スコアをブースト
- しかし、機能名の完全一致を優先する仕組みがない

## 🎯 根本原因の特定

### 根本原因1: 機能名の完全一致を優先する仕組みがない

**問題**:
- 「教室削除」というキーワードは、「教室削除機能」と「教室グループ削除機能」の両方にマッチ
- しかし、「教室削除ができない」というクエリでは、「教室削除機能」がより関連性が高いはず
- 機能名の完全一致を優先する仕組みがない

**影響**:
- 両方のドキュメントが同じスコアになり、区別ができない
- 機能名の明確化ができない

### 根本原因2: タイトル部分一致検索がRRF融合に含まれていない

**問題**:
- `title-search-service.ts`には`searchTitlePartial`関数がある
- しかし、`lancedb-search-client.ts`では使われていない
- タイトル部分一致検索の結果がRRF融合に含まれていない

**影響**:
- 機能名の明確化に活用されていない
- タイトル部分一致検索の結果が検索結果に反映されない

### 根本原因3: 機能名マッチングの強化が必要

**問題**:
- クエリから機能名を抽出する仕組みがない
- 機能名の完全一致を優先する仕組みがない
- 機能名の類似度を計算する仕組みがない

**影響**:
- 機能名の明確化ができない
- より関連性の高いドキュメントが上位に表示されない

## 📊 データフロー分析

### クエリ処理の流れ

```
1. クエリ入力: 「教室削除ができないのは何が原因ですか」
   ↓
2. キーワード抽出
   - unified-keyword-extraction-service.extractKeywordsConfigured()
   - 抽出されたキーワード: ['教室削除', '削除', 'できない', '原因', ...]
   ↓
3. ネガティブワード除去
   - enhanced-keyword-extractor.extractCoreKeywords()
   - 核心キーワード: ['教室削除', '削除', '原因', ...]
   ↓
4. タイトル候補生成
   - generateTitleCandidates(['教室削除', '削除', '原因'])
   - 生成される候補: ['教室削除', '削除', '原因', ...]
   ↓
5. タイトル救済検索（LIKE検索）
   - `title LIKE '%教室削除%'`
   - マッチ: '164__【FIX】教室削除機能', '155_【FIX】教室グループ削除機能', ...
   - 両方とも _sourceType: 'title-exact', _distance: 0.2
   ↓
6. ベクトル検索
   - タイトルブースト適用
   - '164__【FIX】教室削除機能': titleMatchRatio = 0.67 → 10倍ブースト
   - '155_【FIX】教室グループ削除機能': titleMatchRatio = 0.33 → 5倍ブースト
   ↓
7. BM25検索
   - タイトルブースト適用
   - '164__【FIX】教室削除機能': titleMatchRatio = 0.67 → 5倍ブースト
   - '155_【FIX】教室グループ削除機能': titleMatchRatio = 0.33 → 3倍ブースト
   ↓
8. RRF融合
   - '164__【FIX】教室削除機能': rrf = 1.0 * vectorRank + 0.8 * keywordRank + 1.2 * titleRank + 0.6 * bm25Rank
   - '155_【FIX】教室グループ削除機能': rrf = 1.0 * vectorRank + 0.8 * keywordRank + 1.2 * titleRank + 0.6 * bm25Rank
   - 両方ともtitleRankが同じ場合、同じRRFスコアになる
   ↓
9. Composite Scoring
   - 両方ともtitle-exactとして扱われ、titleMatchRatio = 0.9に設定される
   - 機能名の完全一致を優先する仕組みがない
   ↓
10. 最終結果
    - 両方とも同じスコアになり、区別ができない
    - 「教室グループ削除機能」が上位に表示される可能性がある
```

## 🔧 改善案の詳細

### 改善案1: 機能名抽出とマッチング強化

**実装内容**:
```typescript
/**
 * クエリから機能名を抽出
 * 例: 「教室削除ができない」→「教室削除機能」
 */
function extractFunctionName(query: string, keywords: string[]): string | null {
  // 1. キーワードから機能名を推測
  //    - 「教室削除」→「教室削除機能」
  //    - 「教室グループ削除」→「教室グループ削除機能」
  
  // 2. 機能名パターンを検出
  //    - 「削除」を含む場合、「○○削除機能」を推測
  //    - 「登録」を含む場合、「○○登録機能」を推測
  
  // 3. 機能名の完全一致を優先
  if (functionName) {
    // タイトルに機能名が完全一致する場合、スコアをブースト
    if (title.includes(functionName)) {
      // 機能名完全一致ブースト
      return functionName;
    }
  }
  
  return null;
}
```

**期待される効果**:
- 「教室削除機能」が「教室グループ削除機能」より優先される
- 機能名の完全一致を優先できる

### 改善案2: タイトル部分一致検索の統合

**実装内容**:
```typescript
// lancedb-search-client.ts に追加
import { titleSearchService } from './title-search-service';

// タイトル部分一致検索を実行
const titlePartialResults = titleSearchService.searchTitlePartial(
  finalKeywords,
  vectorResults, // または全レコード
  0.33 // minMatchRatio
);

// タイトル部分一致検索の結果を _sourceType: 'title-partial' としてマーク
titlePartialResults.forEach(r => {
  r._sourceType = 'title-partial';
  r._titlePartialMatchRatio = r.matchRatio;
});

// RRF融合に title-partial を追加
const byTitlePartial = resultsWithHybridScore.filter(r => r._sourceType === 'title-partial');
const titlePartialRank = new Map<string, number>();
byTitlePartial.forEach((r, idx) => titlePartialRank.set(r.id, idx + 1));

// RRF融合の重みを調整
//   - title-exact: 1.2 (現在)
//   - title-partial: 1.0 (新規追加)
let rrf = (1.0 / (kRrf + vr)) 
  + 0.8 * (1 / (kRrf + kr)) 
  + (tr ? 1.2 * (1 / (kRrf + tr)) : 0) 
  + (tp ? 1.0 * (1 / (kRrf + tp)) : 0)  // title-partialを追加
  + (br ? 0.6 * (1 / (kRrf + br)) : 0);
```

**期待される効果**:
- タイトル部分一致検索の結果がRRF融合に含まれる
- 機能名の明確化に活用される

### 改善案3: 機能名完全一致の優先度ブースト

**実装内容**:
```typescript
/**
 * 機能名完全一致の優先度ブースト
 */
function applyFunctionNameBoost(result: any, functionName: string | null): void {
  if (!functionName) return;
  
  const title = String(result.title || '').toLowerCase();
  const functionNameLower = functionName.toLowerCase();
  
  // 機能名がタイトルに完全一致する場合
  if (title.includes(functionNameLower)) {
    // 機能名完全一致ブースト
    result._functionNameExactMatch = true;
    result._functionNameMatchRatio = 1.0;
    
    // RRFスコアを追加ブースト
    result._rrfScore = (result._rrfScore || 0) * 1.5; // 50%追加ブースト
  } else {
    // 機能名がタイトルに部分一致する場合
    const partialMatch = title.includes(functionNameLower.replace('機能', ''));
    if (partialMatch) {
      result._functionNamePartialMatch = true;
      result._functionNameMatchRatio = 0.5;
      
      // RRFスコアを軽微にブースト
      result._rrfScore = (result._rrfScore || 0) * 1.1; // 10%追加ブースト
    }
  }
}
```

**期待される効果**:
- 「教室削除機能」が「教室グループ削除機能」より優先される
- 機能名の完全一致を優先できる

### 改善案4: タイトル救済検索の改善

**実装内容**:
```typescript
// タイトル救済検索の改善
// 1. 機能名を抽出
const functionName = extractFunctionName(params.query, finalKeywords);

// 2. 機能名がある場合、機能名を優先して検索
if (functionName) {
  // 機能名の完全一致を優先
  const functionNameExact = `%${functionName}%`;
  const exactRows = await tbl.query().where(`title LIKE '${functionNameExact}'`).limit(20).toArray();
  
  // 機能名完全一致の結果に特別なフラグを付与
  exactRows.forEach(row => {
    row._functionNameExactMatch = true;
    row._sourceType = 'title-exact';
    row._distance = 0.1; // より高いスコア（0.2 → 0.1）
  });
  
  // 機能名部分一致の結果も検索
  const functionNamePartial = functionName.replace('機能', '');
  const partialRows = await tbl.query().where(`title LIKE '%${functionNamePartial}%'`).limit(20).toArray();
  
  partialRows.forEach(row => {
    if (!row._functionNameExactMatch) {
      row._functionNamePartialMatch = true;
      row._sourceType = 'title-partial';
      row._distance = 0.2; // 通常のスコア
    }
  });
}
```

**期待される効果**:
- 機能名の完全一致を優先できる
- タイトル救済検索の精度が向上する

## 📈 期待される改善効果

### 改善前
- 「教室削除機能」と「教室グループ削除機能」が同じスコア
- 「教室グループ削除機能」が上位に表示される可能性がある

### 改善後
- 「教室削除機能」が「教室グループ削除機能」より優先される
- 「教室削除機能」が1位に表示される
- 機能名の完全一致を優先できる

## 🔗 関連ドキュメント

- [ハイブリッド検索仕様書](../architecture/hybrid-search-specification-latest.md)
- [タイトル検索サービス実装](../src/lib/title-search-service.ts)
- [LanceDB検索クライアント実装](../src/lib/lancedb-search-client.ts)
- [キーワード抽出サービス実装](../src/lib/unified-keyword-extraction-service.ts)

