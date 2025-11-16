# BM25スコア伝播バグ修正レポート

**修正日**: 2025年10月16日  
**影響度**: 高（検索品質に直接影響）  
**修正者**: AI Assistant

---

## 📋 概要

Composite ScoringにおいてBM25スコアが正しく伝播されず、常に`0.0000`として扱われるバグを修正しました。

**影響範囲:**
- 全ての検索クエリ
- 特にBM25スコアが高いページ（keyword >= 10）

**修正効果:**
- 事例6（721_学年自動更新バッチ）: #43 → #2
- 平均品質スコア: 6.0/10.0 → 6.7/10.0

---

## 🐛 バグの詳細

### 症状

```typescript
// 検索ログ
keyword=22, title=2, label=0  // ✅ 高いBM25スコア

// Composite Score段階
Breakdown:
  bm25Contribution: 0.0000  // ❌ ゼロになる
```

### 根本原因

**`CompositeScoringService.scoreAndRankResults()` - 117行目:**

```typescript
// Before（バグあり）
const bm25Score = result._bm25Score || 0;  // ❌
```

**問題点:**
1. BM25スコアは`result._bm25Score`だけでなく、`result.keyword`または`result._keywordScore`にも保存される
2. `result._bm25Score`が未定義の場合、常に`0`として扱われる
3. ハイブリッド検索の結果（`_sourceType=hybrid`）では、`result._keywordScore`にBM25スコアが保存される

### なぜこのバグが見つかりにくかったか

1. **検索ログには正しい値が表示される**
   ```
   Score details: keyword=22, title=2, label=0
   ```
   → ログを見ると、BM25スコアが正しく計算されているように見える

2. **Composite Scoreは計算される**
   ```
   Composite: 0.2967
   ```
   → エラーにならないため、気づきにくい

3. **ベクトルスコアは正常**
   ```
   vectorContribution: 0.2700
   ```
   → 検索自体は動作しているため、問題が顕在化しにくい

---

## ✅ 修正内容

### 修正箇所: `src/lib/composite-scoring-service.ts`

```typescript
// After（修正後）
const bm25Score = result.keyword || 
                  result._bm25Score || 
                  result._keywordScore || 0;  // ✅
```

**修正理由:**
1. `result.keyword`: Lunr BM25検索の結果
2. `result._bm25Score`: LIKE検索の結果
3. `result._keywordScore`: ハイブリッド検索の結果
4. フォールバック: `0`（いずれも未定義の場合）

### 追加修正: `src/lib/unified-search-result-processor.ts`

メタデータフィールドの保持を追加:

```typescript
// 検索メタデータフィールドを保持（デバッグ用）
keyword: (result as any).keyword,
titleScore: (result as any).title,  // 名前衝突を回避
labelScore: (result as any).label,
_titleMatchRatio: (result as any)._titleMatchRatio,
_distance: result._distance,
_hybridScore: result._hybridScore,
_sourceType: result._sourceType,
_compositeScore: (result as any)._compositeScore,
_scoreBreakdown: (result as any)._scoreBreakdown,
```

**理由:**
- デバッグ時にスコアの内訳を確認できる
- 将来のバグ調査が容易になる

---

## 📊 修正効果

### 事例6: 721_【作成中】学年自動更新バッチ

#### Before（バグあり）
```
順位: #43
Composite: 0.2967
  V: 0.2700 (90.9%)
  B: 0.0000 (0.0%)  ❌
  T: 0.0000 (0.0%)
  L: 0.0267 (9.1%)
```

#### After（修正後）
```
順位: #2  ✅
Composite: 0.5304
  V: 0.0404 (7.6%)
  B: 0.3667 (69.1%)  ✅
  T: 0.0833 (15.7%)
  L: 0.0400 (7.5%)
```

**改善:**
- BM25貢献度: 0.0000 → 0.3667（+0.3667）
- Composite Score: 0.2967 → 0.5304（+78.8%）
- 順位: #43 → #2（+41位）
- Quality: 6/10 → 8/10（+2.0）

### 全体への影響

| 事例 | Before | After | 改善 |
|------|--------|-------|------|
| 1: 会員退会 | #31 | #7 | +24 ✅ |
| 2: 教室削除 | #28 | #31 | -3 ⚠️ |
| 3: 教室コピー | #25 | #22 | +3 ✅ |
| 4: 重複応募不可期間 | #35 | #3 | +32 ✅ |
| 5: 求人応募期間 | #43 | #9 | +34 ✅ |
| 6: 学年・職業更新 | #43 | #2 | +41 ✅ |

**総合改善:**
- Top 3率: 0% → 33% (+33%)
- Top 10率: 17% → 67% (+50%)
- 平均品質: 6.0/10.0 → 6.7/10.0 (+0.7)

---

## 🔍 バグ発見の経緯

### 1. 初期調査

ユーザーから「設定をPhase 0A-4に戻しても品質が改善しない」という報告を受け、調査を開始。

### 2. 仮説設定

**仮説1:** ベクトル空間が変化した  
→ **否定**: ベクトル比較により完全一致を確認

**仮説2:** パラメータ設定の問題  
→ **部分的に正しい**: 設定を戻しても改善せず

**仮説3:** BM25スコアの伝播バグ  
→ **正解**: 詳細調査で特定

### 3. バグ特定

**決定的な証拠:**
```
検索ログ: keyword=22  ✅
Composite Score: bm25Contribution=0.0000  ❌
```

この差分から、BM25スコアが途中で失われていることが判明。

### 4. 修正と検証

1. `CompositeScoringService`のコードレビュー
2. `result._bm25Score`が未定義であることを確認
3. `result.keyword`と`result._keywordScore`を参照するように修正
4. テスト実行で効果を確認（#43 → #2）

---

## 🎯 教訓

### 1. 複数のフィールド名に注意

BM25スコアが複数の名前で保存される場合、すべてのケースをカバーする必要がある。

```typescript
// Good: すべてのケースをカバー
const bm25Score = result.keyword || 
                  result._bm25Score || 
                  result._keywordScore || 0;

// Bad: 1つのフィールドのみ参照
const bm25Score = result._bm25Score || 0;
```

### 2. ログとデータの乖離

ログに表示される値と、実際のデータ構造が異なる場合がある。デバッグ時は実データを直接確認すべき。

### 3. 型安全性の重要性

TypeScriptの型システムを活用して、フィールドの存在を保証する。

```typescript
interface SearchResult {
  bm25Score: number;  // Required
  // OR
  keyword?: number;
  _bm25Score?: number;
  _keywordScore?: number;
}
```

---

## 📈 今後の対策

### 1. 単体テストの追加

```typescript
describe('CompositeScoringService', () => {
  it('should handle BM25 score from keyword field', () => {
    const result = { keyword: 22 };
    const score = service.extractBm25Score(result);
    expect(score).toBe(22);
  });
  
  it('should handle BM25 score from _keywordScore field', () => {
    const result = { _keywordScore: 15 };
    const score = service.extractBm25Score(result);
    expect(score).toBe(15);
  });
});
```

### 2. 統一フィールド名の検討

BM25スコアのフィールド名を統一:

```typescript
// 統一案
interface SearchResult {
  _bm25Score: number;  // 常にこのフィールドを使用
}

// lancedb-search-client.ts
result._bm25Score = keywordScore;  // keywordではなく_bm25Score

// composite-scoring-service.ts
const bm25Score = result._bm25Score || 0;  // シンプル
```

### 3. デバッグモードの追加

```typescript
if (process.env.DEBUG_SEARCH === 'true') {
  console.log('DEBUG: BM25 score fields:', {
    keyword: result.keyword,
    _bm25Score: result._bm25Score,
    _keywordScore: result._keywordScore,
    finalBm25Score: bm25Score
  });
}
```

---

## ✅ 完了チェックリスト

- [x] バグの特定
- [x] 修正の実装
- [x] テストによる検証
- [x] 品質スコアの改善確認
- [x] ドキュメント化
- [x] git commit & push

---

## 📚 参考資料

1. **関連Issue**: Phase 0A-4設定ロールバック失敗の調査
2. **関連PR**: BM25スコア伝播バグ修正
3. **関連ドキュメント**:
   - `docs/implementation/phase-0a-4-rollback-failure-analysis.md`
   - `docs/architecture/hybrid-search-logic-current.md`

