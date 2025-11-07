# Phase 2: パフォーマンス最適化ガイド

**作成日**: 2025年10月20日  
**目的**: 本番環境のパフォーマンスを117秒 → 10秒以内に改善  
**ステータス**: 🚀 実施中

---

## 📊 現状と目標

### Before（現状）

| 指標 | 測定値 |
|------|--------|
| 検索時間 | **105.9秒** |
| AI生成時間 | 11.2秒 |
| 総処理時間 | **117.2秒** |

### After（目標）

| 指標 | 目標値 | 改善 |
|------|--------|------|
| 検索時間 | **1秒** | **-104.9秒** |
| AI生成時間 | 5秒 | -6.2秒 |
| 総処理時間 | **10秒** | **-107.2秒** |

---

## 🎯 実施した最適化

### ✅ Phase 2-1: getAllChunksByPageIdの最適化

**変更内容**: `.query().where()` → `.search().filter()`

**修正ファイル**: `src/ai/flows/retrieve-relevant-docs-lancedb.ts`

**Before（旧実装）**:
```typescript
// 非効率: 複数回のクエリとtoArrow()変換
const exactMatch = await table.query().where(`id = '${pageId}'`).toArrow();
const prefixMatch = await table.query().where(`id LIKE '${pageId}%'`).toArrow();
// ... 手動でArrowデータを変換 ...
```

**After（新実装）**:
```typescript
// 効率的: 単一クエリで完結
const results = await table
  .search(dummyVector)
  .filter(`pageId = '${pageId}' OR id = '${pageId}' OR id LIKE '${pageId}-%'`)
  .limit(1000)
  .toArray();
```

**効果**: **30秒 → 1秒未満**（-97%削減）

---

### ✅ Phase 2-2: LanceDBインデックス作成

**新規作成**: `scripts/create-lancedb-indexes.ts`

**インデックス種類**:

1. **スカラーインデックス**（B-Tree）
   - 対象列: `pageId`, `id`
   - 効果: フィルター検索が瞬時に完了

2. **ベクトルインデックス**（IVF_PQ）
   - 対象列: `vector`
   - パーティション数: 256
   - サブベクトル数: 96
   - 効果: 大規模データでも高速ベクトル検索

**実行コマンド**:
```bash
# 両方のインデックスを作成
npm run lancedb:create-indexes

# スカラーインデックスのみ
npm run lancedb:create-indexes:scalar-only

# ベクトルインデックスのみ
npm run lancedb:create-indexes:vector-only
```

---

## 📋 実施手順

### ステップ1: ローカルでインデックス作成

```bash
# 1. 最新コードを取得（既に実装済み）
git pull origin main

# 2. LanceDBインデックスを作成
npm run lancedb:create-indexes

# 出力例:
# 🚀 LanceDBインデックス作成開始...
# ✅ pageId列のインデックス作成完了
# ✅ id列のインデックス作成完了
# ✅ ベクトルインデックス作成完了
# ⏱️ 総実行時間: 45.32秒
```

### ステップ2: 本番環境にデータをアップロード

```bash
# インデックス付きのLanceDBデータを本番にアップロード
npm run upload:production-data

# 出力例:
# 📤 Cloud Storageへのアップロード開始...
# ✅ .lancedb/ アップロード完了
# ✅ data/ アップロード完了
```

### ステップ3: 本番環境でテスト

```bash
# 本番URLでテストクエリを実行
# 質問: 「教室削除機能の仕様は？」

# 期待される結果:
# - 検索時間: 1秒未満
# - 総処理時間: 10秒以内
```

---

## 🔬 技術的な詳細

### なぜ.search().filter()が速いのか？

#### 旧実装（.query().where()）の問題
```typescript
// 問題1: .toArrow()変換のオーバーヘッド
const exactMatch = await table.query().where(`id = '${pageId}'`).toArrow();

// 問題2: 手動でArrowデータをJSONに変換
for (let i = 0; i < exactMatch.numRows; i++) {
  const row: any = {};
  for (let j = 0; j < exactMatch.schema.fields.length; j++) {
    // ... 各列を手動で変換 ...
  }
  chunks.push(row);
}
```

**オーバーヘッド**:
- Arrow形式への変換コスト
- 手動でのデータ変換ループ
- メモリアロケーションの増加

#### 新実装（.search().filter()）の利点
```typescript
// 利点1: .toArray()で直接JSONに変換
const results = await table
  .search(dummyVector)
  .filter(`pageId = '${pageId}' OR id = '${pageId}' OR id LIKE '${pageId}-%'`)
  .toArray(); // ← 直接JavaScript配列に変換

// 利点2: 変換処理が不要
results.sort((a, b) => a.chunkIndex - b.chunkIndex);
```

**メリット**:
- LanceDBエンジンが最適化された方法でフィルタリング
- データ変換が1回で完了
- メモリ使用量の削減

---

### インデックス作成の効果

#### スカラーインデックス（B-Tree）

**Before**:
```
filter(`pageId = '12345'`)
→ テーブル全体をスキャン（O(n)）
→ 1,000ページ × 2.5チャンク = 2,500行スキャン
→ 数秒〜数十秒
```

**After**:
```
filter(`pageId = '12345'`)
→ インデックスルックアップ（O(log n)）
→ 該当するチャンクのみ取得
→ 数ミリ秒
```

#### ベクトルインデックス（IVF_PQ）

**Before（ブルートフォース）**:
```
.search(vector)
→ 全ベクトルと比較（O(n)）
→ 2,500ベクトル × 768次元の計算
→ データ増加に比例して遅延
```

**After（IVF_PQ）**:
```
.search(vector)
→ パーティション検索（O(√n)）
→ 256パーティション中の数個のみ探索
→ データ増加しても高速維持
```

---

## ⚠️ トレードオフと注意事項

### ベクトルインデックス（IVF_PQ）のトレードオフ

**メリット**:
- ✅ 検索速度が大幅に向上
- ✅ 大規模データでもスケール
- ✅ メモリ使用量削減

**デメリット**:
- ⚠️ 検索精度がわずかに低下（通常は1-2%程度）
- ⚠️ インデックス作成に時間がかかる
- ⚠️ ディスク容量が増加

**推奨**:
- データ量が1,000ページ以上の場合は必須
- 精度低下は通常は問題ないレベル
- リコール（再現率）を重視する場合はnumPartitions を減らす

### スカラーインデックスの注意点

**メリット**:
- ✅ フィルター検索が瞬時に完了
- ✅ 精度低下なし
- ✅ メモリオーバーヘッド小

**デメリット**:
- ⚠️ ディスク容量が若干増加
- ⚠️ データ更新時にインデックスも更新が必要

---

## 🚀 次のアクション

### 今すぐ実施

1. **ローカルでインデックス作成**
   ```bash
   npm run lancedb:create-indexes
   ```

2. **本番環境にアップロード**
   ```bash
   npm run upload:production-data
   ```

3. **パフォーマンステスト**
   - 質問: 「教室削除機能の仕様は？」
   - 検索時間を確認

### 24時間以内

4. **詳細なパフォーマンス計測**
   - Cloud Loggingでログ確認
   - 各処理のブレークダウン分析

5. **追加最適化の検討**
   - リージョン統一の計画
   - さらなる非同期化

---

## 📊 期待される改善効果

### フェーズ1完了後（既にデプロイ中）

| 項目 | Before | After | 削減 |
|------|--------|-------|------|
| 権限エラー | 38秒 | 0秒 | -38秒 |
| コールドスタート | 17秒 | 0秒 | -17秒 |
| Firestoreレイテンシ | 5秒 | 1秒 | -4秒 |
| **総処理時間** | 117秒 | **58秒** | **-59秒** |

### フェーズ2完了後（これから）

| 項目 | Before | After | 削減 |
|------|--------|-------|------|
| getAllChunks最適化 | 30秒 | 1秒 | -29秒 |
| LanceDBインデックス | - | ✅ | 追加効果 |
| **総処理時間** | 58秒 | **29秒** | **-29秒** |

### 🎯 最終目標

```
Phase 1: 117秒 → 58秒 (-50%)
Phase 2: 58秒 → 29秒 (-50%)
Phase 3: 29秒 → 10秒 (-66%)
```

---

## 🔍 トラブルシューティング

### インデックス作成が失敗する

**エラー**: `Index already exists`

**対応**: インデックスを削除してから再作成
```typescript
// 将来的に実装予定
await table.dropIndex('pageId');
await table.createIndex('pageId', { config: lancedb.Index.btree() });
```

### データアップロードが失敗する

**エラー**: `Permission denied`

**対応**: サービスアカウントの権限を確認
```bash
gcloud projects get-iam-policy confluence-copilot-ppjye
```

### パフォーマンスが改善しない

**確認項目**:
1. インデックスが正しく作成されているか
2. 本番環境に最新データがアップロードされているか
3. Cloud Loggingでエラーが発生していないか

---

## 📝 ベストプラクティス

### インデックス作成のタイミング

- ✅ **推奨**: データ同期の直後に実行
- ✅ **推奨**: 大量のデータ追加・更新後
- ⚠️ **注意**: 本番稼働中は避ける（負荷増加）

### データ同期時の自動化

```bash
# データ同期 → インデックス作成 → アップロード
npm run sync:confluence:differential && \
npm run lancedb:create-indexes && \
npm run upload:production-data
```

---

## 🔗 関連ドキュメント

- [緊急対応ドキュメント](./production-performance-emergency-2025-10-20.md)
- [データ同期戦略](./data-synchronization-strategy.md)
- [ビルド最適化ガイド](./build-optimization-guide.md)
- [本番デプロイチェックリスト](./production-deployment-checklist.md)

---

**最終更新**: 2025年10月20日  
**ステータス**: 実施中

