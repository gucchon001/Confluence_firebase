# Phase 0A-2 パフォーマンス分析レポート

**作成日**: 2025年10月15日  
**Phase**: Phase 0A-2  
**ステータス**: パフォーマンス悪化の原因分析と改善戦略

---

## 📊 パフォーマンス比較

### Phase別パフォーマンス推移

| Phase | 平均検索時間 | 合計時間 | 発見率 | 主な変更点 |
|-------|------------|---------|--------|----------|
| **Phase 0A-2 (初期)** | 8,707ms | 18,982ms | 17% | 初回スマートチャンキング |
| **Phase 0A-2.5** | 2,341ms | 10,390ms | 83% | BM25複数キーワード検索 |
| **Phase 0A-2 (現在)** | **4,914.5ms** | **15,801.0ms** | 83% | **StructuredLabel統合** |

### 悪化の詳細

```
Phase 0A-2.5 → Phase 0A-2 (現在):
   検索時間:       2,341ms → 4,914.5ms (+110% 🔴)
   合計時間:      10,390ms → 15,801.0ms (+52% 🔴)
   発見率:            83% →      83% (維持 ✅)
```

---

## 🕵️ ボトルネック分析

### 1. 検索時間の内訳（事例1: 教室削除条件）

| フェーズ | Phase 0A-2.5 | Phase 0A-2 (現在) | 変化 |
|---------|--------------|------------------|------|
| **検索** | 2,341ms | **10,835ms** | **+362%** 🔴 |
| チャンク統合 | 373ms | 1,685ms | +352% |
| フィルタリング | 154ms | 145ms | -6% ✅ |
| KG拡張 | 7,522ms | 9,214ms | +22% |
| **合計** | 10,390ms | **20,501ms** | **+97%** 🔴 |

**結論**: **検索フェーズが最大のボトルネック（362%悪化）**

---

## 🔬 原因の特定

### 原因1: LanceDBスキーマ拡張によるクエリパフォーマンス低下

**影響度**: 🔴🔴🔴 **高**

#### 証拠:
- 新規追加フィールド: 10個（`structured_*`）
- LanceDBのレコードサイズ: 増加
- ベクトル検索時のスキャンコスト: 増加

#### スキーマ比較:

```typescript
// Phase 0A-2.5（旧スキーマ）
{
  id, pageId, title, content, vector,
  isChunked, chunkIndex, totalChunks,
  labels, spaceKey, lastUpdated
}
// 11フィールド

// Phase 0A-2（新スキーマ）
{
  id, pageId, title, content, vector,
  isChunked, chunkIndex, totalChunks,
  labels, spaceKey, lastUpdated,
  structured_category, structured_domain,
  structured_feature, structured_priority,
  structured_status, structured_version,
  structured_tags, structured_confidence,
  structured_content_length, structured_is_valid
}
// 21フィールド（+10フィールド、+91%増）
```

**推定影響**:
- ベクトル検索の候補取得（500件）で、各レコードのメモリフットプリントが増加
- LanceDBの内部スキャンコストが増加

---

### 原因2: 複合スコアリングの計算コスト

**影響度**: 🟡 **中**

#### 新規追加処理:

```typescript
// StructuredLabelマッチング（各結果に対して実行）
private calculateLabelScore(labels, keywords, structuredLabel) {
  // Part 1: 従来のラベルマッチング (20%)
  // Part 2: StructuredLabelマッチング (80%)
  //   - ドメインマッチング
  //   - 機能名マッチング
  //   - タグマッチング
  //   - カテゴリマッチング
  //   - ステータスボーナス
  // 合計: 約10-15のstring比較処理
}
```

**推定影響**:
- 50件の結果 × 10-15の文字列比較 = **500-750回の追加処理**
- 計算コスト: 約50-100ms（推定）

---

### 原因3: チャンク統合の悪化

**影響度**: 🟡 **中**

```
Phase 0A-2.5: 373ms
Phase 0A-2:   1,685ms (+352%)
```

#### 考えられる原因:
- LanceDBの`WHERE`句パフォーマンス低下（新スキーマ）
- 全レコードスキャンによるフォールバック処理

---

## 🎯 改善戦略（優先度順）

### 🚀 **短期戦略（即効性: 1-3日）**

#### 戦略1: ベクトル検索候補数の削減 ⚡ **最優先**

**現状**: 
```typescript
vectorResults = await table.search(vector).limit(500).toArray();
```

**改善案**:
```typescript
// 候補数を500 → 200に削減
vectorResults = await table.search(vector).limit(200).toArray();
```

**期待効果**:
- ベクトル検索: **-60%削減** (10,835ms → 4,334ms)
- 合計時間: **-30%削減** (20,501ms → 14,350ms)

**トレードオフ**:
- 発見率への影響: 小（RRF融合でBM25が補完）

---

#### 戦略2: 複合スコアリングの最適化 ⚡

**改善箇所**:

```typescript
// Before: 毎回StructuredLabelを抽出
private calculateLabelScore(labels, keywords, structuredLabel) {
  // 10-15回の文字列比較
}

// After: 事前計算・キャッシング
private calculateLabelScore(labels, keywords, structuredLabel) {
  // キーワードを事前に正規化
  const normalizedKeywords = keywords.map(k => k.toLowerCase());
  
  // 早期リターン（StructuredLabelなし）
  if (!structuredLabel) {
    return this.calculateSimpleLabelScore(labels, normalizedKeywords);
  }
  
  // StructuredLabelフィールドも事前に正規化
  // ...
}
```

**期待効果**:
- 複合スコアリング: **-40%削減** (100ms → 60ms)

---

#### 戦略3: LanceDB SELECT最適化 ⚡

**現状**: 全フィールドを取得

**改善案**: 必要なフィールドのみ取得

```typescript
// Before: すべてのフィールドを取得
const results = await table.search(vector).limit(200).toArray();

// After: 初期段階では軽量フィールドのみ
const results = await table.search(vector)
  .select([
    'id', 'pageId', 'title', 'content', 'vector',
    'structured_domain', 'structured_feature', 'structured_status',
    '_distance'
  ])
  .limit(200)
  .toArray();
```

**期待効果**:
- データ転送量: **-50%削減**
- 検索時間: **-20%削減** (10,835ms → 8,668ms)

---

### 📅 **中期戦略（1-2週間）**

#### 戦略4: LanceDBインデックス最適化

**方法**:
1. ベクトルインデックスの再構築
2. IVF (Inverted File) インデックスの導入
3. PQ (Product Quantization) の検討

**期待効果**:
- ベクトル検索: **-70%削減** (大規模データセット対応)

---

#### 戦略5: 段階的フィルタリング

**アイデア**: 
- StructuredLabelフィルタを検索前に適用
- 無効ページ・アーカイブを事前除外

```typescript
// Before: 検索後にフィルタリング
const allResults = await table.search(vector).limit(500).toArray();
const filtered = allResults.filter(r => r.structured_is_valid !== false);

// After: 検索前にフィルタリング
const results = await table.search(vector)
  .where("structured_is_valid IS NULL OR structured_is_valid = true")
  .limit(200)
  .toArray();
```

**期待効果**:
- 無駄な候補取得を削減
- フィルタリング時間: **-80%削減**

---

#### 戦略6: Phase 3 実装（未生成ラベルの生成）

**目的**: 残り276件（21%）のページにStructuredLabelを生成

**期待効果**:
- ラベル付与率: 79% → **100%**
- ラベルスコア貢献度: 0.03 → **0.10** (+233%)
- 発見率の向上: 83% → **90%+**

---

### 🔮 **長期戦略（1ヶ月以上）**

#### 戦略7: マルチステージ検索の導入

**コンセプト**: 
1. **Stage 1**: 軽量フィールドでの高速スクリーニング（StructuredLabelフィルタ）
2. **Stage 2**: ベクトル検索（候補100件）
3. **Stage 3**: 詳細スコアリング（上位20件のみ）

**期待効果**:
- 検索時間: **-80%削減** (4,914ms → 983ms)

---

#### 戦略8: エッジキャッシング

**アイデア**: 
- 頻繁なクエリをRedis/Memcachedでキャッシュ
- StructuredLabelインデックスをメモリに保持

**期待効果**:
- キャッシュヒット率50%で、検索時間: **-50%削減**

---

#### 戦略9: 代替ベクトルDBの検討

**候補**:
- **Milvus**: 大規模データセット対応、高速検索
- **Qdrant**: 高度なフィルタリング機能
- **Weaviate**: ハイブリッド検索に特化

**期待効果**:
- 検索時間: **-90%削減** (次世代最適化)

---

## 🎯 推奨実装順序

### Week 1: 即効性の高い改善（短期戦略）

```
Day 1-2: 戦略1 + 戦略2 実装
  ├─ ベクトル検索候補数削減 (500 → 200)
  ├─ 複合スコアリング最適化
  └─ 期待効果: 検索時間 -50%

Day 3: テスト・検証
  └─ パフォーマンステスト実行

Day 4-5: 戦略3 実装（オプション）
  └─ LanceDB SELECT最適化
```

**目標**: 検索時間を **2,500ms以下**に削減

---

### Week 2-3: 中期戦略

```
Week 2:
  ├─ 戦略4: LanceDBインデックス最適化
  └─ 戦略5: 段階的フィルタリング

Week 3:
  └─ 戦略6: Phase 3 実装（未生成ラベル生成）
```

**目標**: 発見率を **90%+**、検索時間を **1,500ms以下**に

---

### Month 2-3: 長期戦略（オプション）

```
Month 2:
  └─ 戦略7: マルチステージ検索
  
Month 3:
  ├─ 戦略8: エッジキャッシング
  └─ 戦略9: 代替ベクトルDB検討（PoC）
```

**目標**: 検索時間を **500ms以下**に、発見率 **95%+**

---

## 📋 次のアクション

### 🚀 **即座に実装すべき項目**

1. ✅ **ベクトル検索候補数削減** (500 → 200)
   - ファイル: `src/lib/lancedb-search-client.ts`
   - 行数: 1行変更
   - リスク: 低

2. ✅ **複合スコアリング最適化**
   - ファイル: `src/lib/composite-scoring-service.ts`
   - 早期リターン追加
   - リスク: 低

3. ⚠️ **パフォーマンステスト**
   - 改善効果の測定
   - 発見率への影響確認

---

## 💡 結論

### パフォーマンス悪化の主因

1. **ベクトル検索候補数が多すぎる** (500件 → 推奨200件)
2. **LanceDBスキーマ拡張によるスキャンコスト増加** (+91%フィールド増)
3. **複合スコアリングの計算コスト** (最適化の余地あり)

### 推奨アクション

**短期（1-3日）**:
- ✅ ベクトル検索候補数削減 ← **最優先**
- ✅ 複合スコアリング最適化

**中期（1-2週間）**:
- LanceDBインデックス最適化
- Phase 3: 未生成ラベル生成（276件）

**長期（1ヶ月以上）**:
- マルチステージ検索
- 代替ベクトルDB検討

### 期待される改善効果

```
現状:   検索時間 4,914ms、発見率 83%
短期後: 検索時間 2,500ms (-49%)、発見率 83%
中期後: 検索時間 1,500ms (-69%)、発見率 90%+
長期後: 検索時間   500ms (-90%)、発見率 95%+
```

---

**次のステップ**: 短期戦略1-2を即座に実装し、パフォーマンステストで効果を検証します。

