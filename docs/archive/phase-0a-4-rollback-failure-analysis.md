# Phase 0A-4設定ロールバック失敗の根本原因分析

**作成日**: 2025年10月16日  
**目的**: Phase 0A-4設定に戻しても721が#43である理由を特定

---

## 📊 現状

| 項目 | Phase 0A-4完了時 | Phase 0A-4設定<br>復元後 | 差分 |
|------|----------------|----------------------|------|
| LanceDBレコード数 | 1,316 | 1,316 | ✅ 同じ |
| LanceDBページ数 | 813 | 813 | ✅ 同じ |
| kwCap | 50 | 50 | ✅ 同じ |
| vectorWeight | 30% | 30% | ✅ 同じ |
| bm25Weight | 40% | 40% | ✅ 同じ |
| maxBm25Score | 10.0 | 10.0 | ✅ 同じ |
| **事例6の順位** | **#1** | **#43** | ❌ -42 |

---

## 🔍 根本原因

### 721のComposite Score内訳

```
Composite: 0.2967 (非常に低い)

Breakdown:
  V: 0.2700 (90.9%) ← ベクトルのみで構成
  B: 0.0000 (0.0%)  ← BM25が完全にゼロ ❌
  T: 0.0000 (0.0%)  ← タイトルマッチもゼロ
  L: 0.0267 (9.1%)  ← ラベルのみ有効
```

### Top 1のComposite Score内訳

```
Composite: 0.7802 (高い)

Breakdown:
  V: 0.38 (48.7%)   ← ベクトル
  B: 0.40 (51.3%)   ← BM25が有効 ✅
  T: 0.00 (0.0%)
  L: 0.00 (0.0%)
```

---

## ⚠️ 問題

### 1. BM25スコアが失われている

検索ログでは721は`keyword=22`という高いBM25スコアを持っているのに、Composite Scoring段階で`B: 0.0000`になっています。

#### 検索ログ

```
[searchLanceDB] Processing result 251:
  Title: 721_【作成中】学年自動更新バッチ
  keyword=22, title=2, label=0
  Hybrid score: 0.48
  _sourceType=hybrid
```

#### Composite Score段階

```
タイトル: 721_【作成中】学年自動更新バッチ
Composite: 0.2967
Breakdown:
  B: 0.0000 ❌
```

### 2. ベクトル検索でTop 100外

721はベクトル検索単独では**Top 100外**です。つまり、ベクトル距離が非常に遠い（~1.9）ため、ベクトルだけでは発見できません。

**Phase 0A-4で#1だった理由は、BM25スコアの高さのおかげでした。**

---

## 🧐 仮説

### 仮説1: `_sourceType=hybrid`の問題

721は`_sourceType=hybrid`になっていますが、Top 5のページは`_sourceType=bm25`です。

**可能性:**
- `hybrid`タイプの結果は、BM25スコアが正しく伝播されていない？
- `bm25`タイプの結果のみ、BM25スコアが正しく計算されている？

### 仮説2: RRF融合で`keyword`フィールドが失われる

RRF融合後、`keyword`フィールドが失われるか、未定義になっている可能性があります。

### 仮説3: Composite Scoring のバグ

`CompositeScoringService.calculateCompositeScore()`で、`result.keyword`が未定義の場合に0として扱われている可能性があります。

---

## 🔬 検証すべきこと

1. **`_sourceType=bm25` vs `_sourceType=hybrid`の違い**
   - それぞれのタイプでBM25スコアがどう扱われるか確認

2. **RRF融合後の`keyword`フィールドの有無**
   - RRF融合前後で`keyword`フィールドが保持されているか確認

3. **Composite Scoring の`result.keyword`の扱い**
   - `result.keyword`が未定義の場合のデフォルト値を確認

4. **Phase 0A-4完了時点のログとの比較**
   - Phase 0A-4完了時点で721のBM25スコアがどう計算されていたか確認

---

## 📋 次のアクション

1. `CompositeScoringService.calculateCompositeScore()`のコードを確認
2. `result.keyword`フィールドの伝播を確認
3. `_sourceType=hybrid`と`_sourceType=bm25`の違いを確認
4. Phase 0A-4完了時点のログ（あれば）を確認

---

## 🎯 期待される修正

BM25スコアが正しく伝播されるようにすれば、721のComposite Scoreは：

```
721のBM25スコア: 22
normalizedBm25: min(1.0, 22 / 10.0) = 1.0
bm25Contribution: 1.0 × 0.40 = 0.40

期待されるComposite:
  V: 0.27 (30%)
  B: 0.40 (40%) ✅
  T: 0.04 (title=2, titleWeight=0.20)
  L: 0.03 (label=0.30, labelWeight=0.10)
  = 0.74

順位: #1-3に入る可能性が高い
```

---

## 📊 結論

**Phase 0A-4設定に戻しただけでは不十分です。**

**BM25スコアが正しく伝播されていないバグ**があり、これを修正する必要があります。

このバグはPhase 0A-4完了後に導入された可能性が高いです（おそらくStructuredLabel統合やUnifiedSearchResultProcessor修正時）。



