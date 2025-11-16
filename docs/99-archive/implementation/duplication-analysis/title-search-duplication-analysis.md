# タイトル検索関連処理の重複コード・未使用コード分析

## 📋 分析概要

タイトル検索関連処理（タイトル厳格一致、部分一致、ラベル一致、タイトルマッチング計算）における重複コードと未使用コードを調査しました。

**分析日**: 2024年12月
**対象範囲**: タイトル検索サービス、タイトルマッチング計算、タイトル候補生成

---

## 🔍 調査結果サマリー

### ⚠️ 未使用コードあり
- `src/lib/title-search-service.ts`の全機能が未使用
  - `searchTitleExact`: 未使用
  - `searchTitlePartial`: 未使用
  - `searchByLabel`: 未使用
  - `searchTitleCombined`: 未使用

### ✅ 重複コードなし
- `lancedb-search-client.ts`内のタイトル検索実装は統一されている
- `calculateTitleMatch`は共通関数として使用中
- `generateTitleCandidates`は統一実装

---

## 📁 ファイル別分析

### 1. 現在使用中のファイル

#### `src/lib/lancedb-search-client.ts`
**状態**: ✅ 使用中（本番コードの主要なタイトル検索実装）

**機能**:
- **タイトル厳格一致検索**: Lunr検索を使用した高速タイトル検索（477-599行目）
  - キャッシュ機能付き
  - 並列実行による最適化
  - キーワードから自動的にタイトル候補を生成
- **`calculateTitleMatch`関数** (1497-1615行目): タイトルキーワードマッチング計算
  - ベクトル検索・BM25検索両方で使用
  - 複合語（DOMAIN_SPECIFIC_KEYWORDS）のブースト処理
  - クエリ全体一致の優先処理
  - 余分な単語に対するペナルティ処理
- **`generateTitleCandidates`関数** (1621-1636行目): キーワードからタイトル候補を生成
  - 2語の組み合わせを生成
  - 単一キーワードも追加

**使用箇所**:
- `executeVectorSearch`: `calculateTitleMatch`を使用（1244行目）
- `executeBM25Search`: `calculateTitleMatch`を使用（1419行目）
- `searchLanceDB`: タイトル厳格一致検索と`generateTitleCandidates`を使用（477-599行目、483行目）

**重複**: なし（統一された実装として機能）

---

### 2. 未使用ファイル（削除推奨）

#### `src/lib/title-search-service.ts`
**状態**: ❌ 完全に未使用（削除可能）

**機能**:
- **`searchTitleExact`** (96-139行目): タイトル厳格一致検索（Levenshtein距離ベース）
- **`searchTitlePartial`** (146-198行目): タイトル部分一致検索（キーワードベース）
- **`searchByLabel`** (205-260行目): ラベル一致検索
- **`searchTitleCombined`** (265-309行目): 統合タイトル検索（厳格一致 + 部分一致 + ラベル一致）

**使用状況**: 
- すべてのメソッドが未使用
- grep検索で使用箇所が見つからず
- ドキュメント内での言及のみ（実際のコードでは使用されていない）

**削除推奨**: ✅ はい

**理由**:
1. `lancedb-search-client.ts`で既にタイトル検索が実装されている
2. 実装方法が異なる（`title-search-service.ts`はLevenshtein距離ベース、`lancedb-search-client.ts`はLunr検索ベース）
3. 本番コードでは`lancedb-search-client.ts`の実装が使用されている

---

## 🔄 重複コードの確認

### タイトル部分一致検索の実装比較

#### `title-search-service.ts`の`searchTitlePartial`:
```typescript
const title = String(record.title || '').toLowerCase();
const matchedKeywords = keywords.filter(kw => 
  title.includes(kw.toLowerCase())
);
const matchRatio = keywords.length > 0 
  ? matchedKeywords.length / keywords.length 
  : 0;
```

#### `lancedb-search-client.ts`の`calculateTitleMatch`:
```typescript
const cleanTitle = String(title || '').replace(/\uFEFF/g, '');
const titleLower = cleanTitle.toLowerCase();
const matchedKeywords = keywords.filter(kw => titleLower.includes(kw.toLowerCase()));
let titleMatchRatio = keywords.length > 0 ? matchedKeywords.length / keywords.length : 0;
// + 複合語ブースト、クエリ全体一致優先、ペナルティ処理など追加ロジック
```

**分析**:
- 基本ロジックは類似しているが、実装場所が異なる
- `calculateTitleMatch`の方が高度な機能（複合語ブースト、ペナルティ処理など）を持っている
- `title-search-service.ts`は未使用のため、実質的な重複ではない

### タイトル厳格一致検索の実装比較

#### `title-search-service.ts`の`searchTitleExact`:
- Levenshtein距離ベースの類似度計算
- 全レコードをメモリ内でフィルタリング・ソート
- しきい値（デフォルト0.85）以上の結果を返す

#### `lancedb-search-client.ts`のタイトル厳格一致検索:
- Lunr検索エンジンを使用したインデックスベース検索
- キャッシュ機能付き
- 並列実行による最適化
- LanceDBと統合された実装

**分析**:
- 実装方法が根本的に異なる
- `lancedb-search-client.ts`の実装が本番で使用されている
- `title-search-service.ts`は未使用のため、実質的な重複ではない

---

## 📊 削除推奨ファイル一覧

| ファイル | 理由 | 削除推奨 |
|---------|------|---------|
| `src/lib/title-search-service.ts` | 完全に未使用、`lancedb-search-client.ts`で代替実装済み | ✅ |

---

## 🎯 推奨アクション

### 1. 未使用ファイルの削除（優先度: 中）

**問題**: `src/lib/title-search-service.ts`が完全に未使用

**対応方法**: ファイルを削除

**理由**:
- すべての機能が未使用であることを確認
- `lancedb-search-client.ts`で既にタイトル検索が実装されている
- コードベースをクリーンに保つため

**注意事項**:
- 削除前に、他のプロジェクトや将来の計画で使用予定がないか確認
- ドキュメントで言及されている場合は、ドキュメントも更新

### 2. コード品質の維持

- ✅ `lancedb-search-client.ts`のタイトル検索実装は適切
- ✅ `calculateTitleMatch`は共通関数として統一されている
- ✅ `generateTitleCandidates`は統一実装
- ✅ タイトル検索キャッシュは効果的に使用されている

---

## 📝 補足情報

### 現在のタイトル検索フロー

```
ユーザークエリ
  ↓
キーワード抽出
  ↓
generateTitleCandidates (タイトル候補生成)
  ↓
Lunr検索 (タイトル厳格一致検索)
  ├─ キャッシュチェック
  ├─ Lunr検索実行
  └─ LanceDBからレコード取得
  ↓
calculateTitleMatch (タイトルマッチング計算)
  ├─ 基本マッチ比率計算
  ├─ 複合語ブースト処理
  ├─ クエリ全体一致優先処理
  └─ 余分な単語ペナルティ処理
  ↓
スコア計算・ランキング
  ↓
検索結果を返却
```

### タイトル検索の役割

1. **救済検索**: ベクトル検索で見つからないページを発見
2. **ランキング改善**: タイトルにキーワードが含まれる結果をブースト
3. **早期終了**: 厳格一致が見つかった場合、他の検索をスキップ（現在は実装されていないが、`title-search-service.ts`にその機能があった）

---

## ✅ 結論

1. **重複コード**: 実質的な重複は確認されませんでした
   - `title-search-service.ts`と`lancedb-search-client.ts`の実装は異なるアプローチ
   - `title-search-service.ts`は未使用のため、実質的な重複ではない

2. **未使用コード**: `title-search-service.ts`が完全に未使用
   - すべてのメソッドが使用されていない
   - `lancedb-search-client.ts`で代替実装済み

3. **推奨**: `title-search-service.ts`を削除してコードベースをクリーンに保つ

---

## 🔗 関連ドキュメント

- [ベクトル関連処理重複分析](./vector-processing-duplication-analysis.md)
- [キーワード抽出重複分析](./keyword-extraction-duplication-analysis.md)
- [RRF処理重複分析](./rrf-duplication-analysis.md)
- [LanceDB取得処理重複分析](./lancedb-duplication-analysis.md)

