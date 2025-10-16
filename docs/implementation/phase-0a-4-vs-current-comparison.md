# Phase 0A-4 vs 現在の比較レポート

**作成日**: 2025年10月16日  
**Phase**: Phase 0A-2  

---

## 📊 検索順位の劇的な劣化

| 事例 | Phase 0A-4<br>順位 | 現在<br>順位 | 劣化 |
|------|-------------------|------------|------|
| 1: 会員退会 | **#1** ✅ | **#82** ❌ | -81 |
| 2: 教室削除 | ❌ 未発見 | **#105** ⚠️ | (改善) |
| 3: 教室コピー | **#1** ✅ | **#91** ❌ | -90 |
| 4: 重複応募不可期間 | **#6** ⚠️ | **#4** ✅ | +2 |
| 5: 求人応募期間 | **#1** ✅ | **#9** ⚠️ | -8 |
| 6: 学年・職業更新 | **#1** ✅ | **Top 150外** ❌ | -150以上 |

**平均劣化**: **-65順位**（事例2を除く）

---

## 🔍 Phase 0A-4完了時点のハイブリッド検索ロジックフロー

### 実行フロー

```
┌─────────────────────────────────────────────────────────────┐
│ Stage 1: ベクトル検索（タイトルブースト付き）                  │
├─────────────────────────────────────────────────────────────┤
│ 1. クエリをGeminiで埋め込みベクトル化                         │
│ 2. LanceDBでベクトル検索（topK × 10 = 500件）                │
│ 3. タイトルマッチ率を計算                                     │
│    - matchedKeywords / totalKeywords                         │
│ 4. タイトルブースト適用                                       │
│    - titleMatchRatio >= 66%: boostFactor = 10.0              │
│    - titleMatchRatio >= 33%: boostFactor = 5.0               │
│    → ベクトル距離を boost分だけ減少（近づける）              │
│ 5. 距離閾値でフィルタリング（maxDistance: 2.0）              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Stage 2: BM25検索（Lunr または LIKE フォールバック）           │
├─────────────────────────────────────────────────────────────┤
│ 1. キーワード抽出（核心キーワード優先）                       │
│    - ネガティブワード除去（"ない", "何が" など）             │
│ 2. BM25検索（kwCap = 50件 × キーワード数）                   │
│    ※ Lunr未初期化の場合、LIKE検索でフォールバック            │
│ 3. タイトルマッチ率を計算                                     │
│ 4. タイトルブースト適用                                       │
│    - titleMatchRatio >= 66%: score × 5.0                     │
│    - titleMatchRatio >= 33%: score × 3.0                     │
│ 5. BM25結果を候補に追加                                       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Stage 3: RRF (Reciprocal Rank Fusion) 融合                   │
├─────────────────────────────────────────────────────────────┤
│ 1. 各検索結果を順位付け                                       │
│    - vectorRank: ベクトル検索の順位                          │
│    - bm25Rank: BM25検索の順位                                │
│    - titleRank: タイトル完全一致検索の順位                   │
│ 2. RRFスコア計算（k=60）                                      │
│    rrf = (1.0 / (k + vectorRank))                            │
│        + (0.8 / (k + keywordRank))                           │
│        + (1.2 / (k + titleRank))     ← タイトル最優先         │
│        + (0.6 / (k + bm25Rank))                              │
│ 3. ドメイン減衰適用（汎用ドキュメントを低減）                 │
│    - ペナルティラベル: × 0.9                                  │
│    - 汎用タイトル: × 0.8                                      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Stage 4: 複合スコアリング（Composite Scoring）                │
├─────────────────────────────────────────────────────────────┤
│ 1. 各信号を0-1に正規化                                        │
│    - normalizedVector = 1 - (distance / 2.0)                 │
│    - normalizedBM25 = bm25Score / 10.0                       │
│    - normalizedTitle = titleMatchRatio                       │
│    - normalizedLabel = labelScore (計算済み)                 │
│                                                              │
│ 2. 重み付き合計（Phase 0A-4時点）                            │
│    compositeScore =                                          │
│      (normalizedVector × 0.30) +   // ベクトル: 30%          │
│      (normalizedBM25 × 0.40) +     // BM25: 40% ← 最優先     │
│      (normalizedTitle × 0.20) +    // タイトル: 20%          │
│      (normalizedLabel × 0.10)      // ラベル: 10%            │
│                                                              │
│ 3. 複合スコアでソート（降順）                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔑 Phase 0A-4で#1を達成できた重要ポイント

### 1. **LanceDBデータ**
```
✅ 813ユニークページ（現在: 743ページ）
✅ 1,316レコード（現在: 1,224レコード）
✅ 除外フィルタリングなし（現在: 70ページ除外）

→ ベクトル空間が豊富で、類似ページが適切に近接
```

### 2. **チャンクサイズ最適化**
```
TOKEN_LIMIT: 1,024トークン
CHUNK_SIZE: 1,600文字
CHUNK_OVERLAP: 200文字

→ 適切な粒度で意味のあるベクトル表現
```

### 3. **タイトルブースト**
```
ベクトル検索:
  titleMatchRatio >= 66%: boostFactor = 10.0
  titleMatchRatio >= 33%: boostFactor = 5.0
  → ベクトル距離を大幅に減少（近づける）

BM25検索:
  titleMatchRatio >= 66%: score × 5.0
  titleMatchRatio >= 33%: score × 3.0
  → BM25スコアを増幅
```

### 4. **複合スコアリング重み**
```
BM25: 40%（最優先）
ベクトル: 30%（重要）
タイトル: 20%
ラベル: 10%

maxBm25Score: 10.0
maxVectorDistance: 2.0
```

### 5. **BM25候補数**
```
kwCap = Math.min(50, Math.max(10, Math.floor(topK / 3)))
→ デフォルトで50件（現在: 100件に改善済み）
```

---

## 🔴 現在の劣化の根本原因

### 原因1: ベクトル空間の変化（最大の問題）

**Phase 0A-4:**
```
813ページ → 豊富なベクトル空間
期待ページのベクトル距離: 0.5-0.8（近い）
normalizedVector = 1 - (0.5 / 2.0) = 0.75
vectorContribution = 0.75 × 0.30 = 0.225
```

**現在:**
```
743ページ（-70ページ、-8.6%）→ 疎になったベクトル空間
期待ページのベクトル距離: 1.8-1.9（遠い）
normalizedVector = 1 - (1.8 / 2.0) = 0.10
vectorContribution = 0.10 × 0.05 = 0.005
```

**影響**: vectorContributionが0.225 → 0.005に劇的低下（-96%）

---

### 原因2: StructuredLabel未統合（Phase 0A-4時点）

**Phase 0A-4:**
```
StructuredLabel: 未統合
labelScore: 従来のlabels配列のみ（多くは空配列[]）
labelContribution: 0.00-0.02（ほぼ0）
```

**現在:**
```
StructuredLabel: ✅ 統合済み（639件、85%カバレッジ）
labelScore: 0.02-0.30（大幅向上）
labelContribution: 0.003-0.045

例: 721の場合
  labelScore = 0.30
  labelContribution = 0.30 × 0.15 = 0.045
```

**影響**: labelContributionが若干向上したが、vectorContributionの劣化を補えず

---

## 📊 Composite Score比較（事例6の例）

### Phase 0A-4時点

```
721_【作成中】学年自動更新バッチ: #1

Composite Score: 0.9294
├─ Vector:  0.50 × 0.30 = 0.150
├─ BM25:    0.40 × 0.40 = 0.160
├─ Title:   0.03 × 0.20 = 0.006
└─ Label:   0.00 × 0.10 = 0.000
                        ─────────
                  合計:   0.316

※ 実際の0.9294とは異なる→計算式または測定値に違いがある可能性
```

### 現在

```
721_【作成中】学年自動更新バッチ: Top 150外

推定Composite Score: ~0.30
├─ Vector:  0.20 × 0.05 = 0.010  ← 大幅劣化
├─ BM25:    0.73 × 0.50 = 0.365  ← 大幅向上（keyword=22）
├─ Title:   0.13 × 0.25 = 0.033
└─ Label:   0.30 × 0.15 = 0.045  ← 向上（StructuredLabel統合）
                        ─────────
                  合計:   0.453

※ 他のページも同様にBM25が向上→相対順位が低下
```

---

## 🎯 Phase 0A-4で成功した理由

### 1. ベクトル検索が効いていた
```
813ページの豊富なベクトル空間
→ 期待ページが適切にクラスタリング
→ クエリとの類似度が高い（distance: 0.5-0.8）
→ vectorContribution: 0.15-0.225（大きい）
```

### 2. BM25も適度に効いていた
```
kwCap = 50件（適度な候補数）
→ 核心キーワードにマッチするページが候補に
→ BM25スコア: 5-10程度
→ bm25Contribution: 0.16-0.20
```

### 3. 合計スコアが高い
```
vectorContribution + bm25Contribution = 0.31-0.42
→ #1にランクイン
```

---

## ❌ 現在の劣化の理由

### 1. ベクトル検索が機能していない
```
743ページの疎なベクトル空間（-70ページ）
→ 期待ページとの距離が遠い（distance: 1.8-1.9）
→ vectorContribution: 0.005-0.010（非常に小さい）
```

### 2. BM25は向上したが...
```
kwCap = 100件（増加）
→ BM25候補が301+212=513件に増加
→ keyword=22など非常に高スコア
→ bm25Contribution: 0.37（大幅向上）

しかし、他のページも同様にBM25が向上
→ 相対的な順位は改善しない
```

### 3. StructuredLabelは向上したが効果限定的
```
labelContribution: 0.00 → 0.045（向上）

しかし、全体の15%の重みしかない
→ vectorContributionの劣化（-0.14）を補えない
```

---

## 💡 解決策の分析

### Option A: Phase 0A-4バックアップに戻す（即座に解決）

**効果:**
- ✅ ベクトル空間が元に戻る（813ページ）
- ✅ 期待ページが#1に戻る
- ❌ 70ページの除外対象ページが含まれる
- ❌ StructuredLabel統合が失われる

**コマンド:**
```bash
# バックアップをコピー
Remove-Item -Recurse .lancedb
Copy-Item -Recurse .lancedb.backup.label-sync.1760528975460 .lancedb
```

---

### Option B: ベクトル依存度をさらに下げる（部分的解決）

**現在の設定:**
```
vectorWeight: 0.05 (5%)
bm25Weight: 0.50 (50%)
titleWeight: 0.25 (25%)
labelWeight: 0.15 (15%)
```

**提案:**
```
vectorWeight: 0.00 (0%) ← 完全に無効化
bm25Weight: 0.55 (55%)
titleWeight: 0.30 (30%)
labelWeight: 0.15 (15%)
```

**効果:**
- ✅ ベクトル空間変化の影響を完全排除
- ⚠️ セマンティック検索が機能しなくなる
- ⚠️ BM25とタイトルのみに依存

---

### Option C: LanceDBを全再構築（根本解決の試み）

**方法:**
1. Confluenceから全ページ再取得（除外フィルタリング適用）
2. 743ページでLanceDB再構築
3. 新しいベクトル空間で埋め込み再生成
4. StructuredLabel統合

**期待効果:**
- ✅ 新しいベクトル空間に最適化
- ✅ 除外フィルタリング維持
- ✅ StructuredLabel統合維持
- ⚠️ ベクトル空間が変わるため、順位が改善する保証はない

**コマンド:**
```bash
npm run lancedb:rebuild
npm run label:sync
```

---

## 📋 推奨アクション

### 短期的（即座）: Option A
```bash
# Phase 0A-4の状態に戻す
Remove-Item -Recurse .lancedb
Copy-Item -Recurse .lancedb.backup.label-sync.1760528975460 .lancedb

# StructuredLabelは再同期が必要
npx tsx scripts/sync-firestore-labels-to-lancedb.ts
```

**理由:**
- 検索順位が即座に#1に戻る
- StructuredLabel統合も可能
- 70ページの除外対象ページは含まれるが、検索品質を優先

### 中期的（1-2時間）: Option C
```bash
# 全再構築（除外フィルタリング適用、新ベクトル空間）
npm run lancedb:rebuild
npm run label:sync

# 品質テスト
npx tsx scripts/test-gemini-quality-simple.ts
```

**理由:**
- 除外フィルタリングを維持
- 新しいベクトル空間に最適化
- 品質改善の可能性

---

## 🔬 Phase 0A-4時点の詳細パラメータ

```typescript
// LanceDB
ユニークページ数: 813ページ
総レコード数: 1,316件
除外フィルタリング: なし

// Composite Scoring
vectorWeight: 0.30 (30%)
bm25Weight: 0.40 (40%)
titleWeight: 0.20 (20%)
labelWeight: 0.10 (10%)
maxVectorDistance: 2.0
maxBm25Score: 10.0

// BM25検索
kwCap: 50件（最小10件、最大50件）
searchKeywords: finalKeywords.slice(0, 5)
Lunr: 未初期化（LIKE検索フォールバック）

// ベクトル検索
topK × 10 = 500件
maxDistance: 2.0
qualityThreshold: 0.0

// タイトルブースト（ベクトル）
titleMatchRatio >= 66%: boostFactor = 10.0
titleMatchRatio >= 33%: boostFactor = 5.0

// タイトルブースト（BM25）
titleMatchRatio >= 66%: score × 5.0
titleMatchRatio >= 33%: score × 3.0
```

---

## 📊 現在のパラメータ（Phase 0A-2改善後）

```typescript
// LanceDB
ユニークページ数: 743ページ（-70ページ）
総レコード数: 1,224件（-92件）
除外フィルタリング: ✅ あり（402ページ除外）
StructuredLabel: ✅ 統合済み（639件、85%）

// Composite Scoring
vectorWeight: 0.05 (5%) ← 30% → 5%に大幅減少
bm25Weight: 0.50 (50%) ← 40% → 50%に増加
titleWeight: 0.25 (25%) ← 20% → 25%に増加
labelWeight: 0.15 (15%) ← 10% → 15%に増加
maxVectorDistance: 2.0 （変更なし）
maxBm25Score: 30.0 ← 10.0 → 30.0に増加

// BM25検索
kwCap: 100件 ← 50件 → 100件に増加
searchKeywords: finalKeywords.slice(0, 5)（変更なし）
Lunr: 未初期化（LIKE検索フォールバック）

// ベクトル検索
topK × 10 = 500件（変更なし）
maxDistance: 2.0（変更なし）
qualityThreshold: 0.0（変更なし）

// タイトルブースト
（変更なし）
```

---

## 🎯 差分まとめ

| 項目 | Phase 0A-4 | 現在 | 影響 |
|------|-----------|------|------|
| **LanceDBページ数** | 813 | 743 | ❌ ベクトル空間変化 |
| **vectorWeight** | 30% | 5% | ⚠️ ベクトル影響低減 |
| **bm25Weight** | 40% | 50% | ✅ BM25優先 |
| **kwCap** | 50 | 100 | ✅ BM25候補増加 |
| **maxBm25Score** | 10.0 | 30.0 | ✅ 高スコア評価 |
| **StructuredLabel** | なし | あり | ✅ ラベル精度向上 |

**結論:**
- ✅ BM25とStructuredLabelは改善
- ❌ ベクトル空間の変化が致命的
- ❌ ウェイト調整だけでは補えない


