# pageId → page_id マイグレーション影響分析サマリー

## 📊 総合分析結果

### 統計情報
- **総発生数**: 658 occurrences
- **影響ファイル数**: 73 files
- **カテゴリ別**:
  - Type定義: 148 occurrences
  - Query (クエリ): 28 occurrences
  - API (レスポンス): 55 occurrences
  - Schema (スキーマ): 1 occurrence
  - Test (テスト): 69 occurrences
  - Other (その他): 357 occurrences

### 重要度別
- **Critical (重要)**: 177 occurrences
- **High (高)**: 55 occurrences
- **Medium (中)**: 426 occurrences

## 🔍 主要な発見

### 1. APIレスポンスへの影響: ✅ **低い**

**発見**:
- APIレスポンスでは`pageId`フィールドを直接返していない
- `id`フィールドとして`${result.pageId}-0`形式で使用している
- `src/lib/search-result-formatter.ts`で`pageId`がオプショナルフィールドとして定義されているが、実際のレスポンスには含まれていない

**結論**: 
- ✅ APIレスポンスの互換性への影響は**低い**
- ⚠️ 内部処理での`pageId`参照の変更は必要

### 2. 型定義への影響: ⚠️ **高い**

**主要な型定義**:
1. `src/types/search.ts`: `SearchResult`, `LanceDBRow`
2. `src/lib/hybrid-search-engine.ts`: `HybridSearchResult`
3. `src/lib/lunr-search-client.ts`: `LunrSearchResult`
4. `src/types/knowledge-graph.ts`: `KGNode`
5. `src/lib/search-result-formatter.ts`: `BaseSearchResult`, `FormattedSearchResult`

**結論**: 
- ⚠️ 型定義の変更が必要（148 occurrences）
- ⚠️ 型安全性の確保が重要

### 3. データベースクエリへの影響: 🚨 **高い**

**主要なクエリ箇所**:
1. `src/ai/flows/retrieve-relevant-docs-lancedb.ts`: `.where(\`pageId\` = ...)` (8 critical)
2. `src/lib/lancedb-search-client.ts`: `.where(\`pageId\` = ...)` (9 critical)
3. `src/lib/confluence-sync-service.ts`: フィルタリング条件 (13 critical)

**結論**: 
- 🚨 クエリ条件の変更が必要（28 occurrences）
- 🚨 パフォーマンスへの影響が大きい（スカラーインデックス作成のため）

### 4. スキーマ定義への影響: 🚨 **高い**

**主要なスキーマ定義**:
1. `src/lib/lancedb-schema-extended.ts`: Arrowスキーマ定義
2. `src/lib/lancedb-schema.ts`: スキーマ定義
3. `src/lib/lancedb-client.ts`: スキーマ定義

**結論**: 
- 🚨 スキーマ定義の変更が必要（1 occurrence、しかし重要度が高い）
- 🚨 データベースの再構築が必要

### 5. テストコードへの影響: ⚠️ **中程度**

**統計**:
- テストコード: 69 occurrences
- 重要度: 主にMedium

**結論**: 
- ⚠️ テストコードの更新が必要
- ⚠️ テストデータの更新が必要

## 🎯 推奨マイグレーション戦略

### オプション1: 内部処理のみ変更（推奨）

**アプローチ**:
- **内部処理**: `page_id`を使用（データベースフィールド名）
- **APIレスポンス**: `pageId`を維持（互換性を保つ）
- **変換レイヤー**: データベースから取得時に`page_id`→`pageId`に変換

**メリット**:
- ✅ フロントエンド側への影響なし
- ✅ 既存のAPIクライアントとの互換性維持
- ✅ 段階的な移行が可能
- ✅ スカラーインデックスを作成できる（パフォーマンス向上）

**デメリット**:
- ⚠️ 変換レイヤーの実装が必要
- ⚠️ コードの複雑性が増加

**実装手順**:
1. Phase 1: データベーススキーマとクエリの変更（`pageId` → `page_id`）
2. Phase 2: 内部型定義の変更（`pageId` → `page_id`）
3. Phase 3: 変換レイヤーの実装（`page_id` → `pageId`）
4. Phase 4: APIレスポンスでは`pageId`を維持
5. Phase 5: テストコードの更新

### オプション2: 全面的な変更

**アプローチ**:
- **内部処理**: `page_id`を使用
- **APIレスポンス**: `page_id`に変更
- **フロントエンド**: `page_id`に変更

**メリット**:
- ✅ 一貫性がある
- ✅ 変換レイヤーが不要

**デメリット**:
- ❌ フロントエンド側の修正が必要
- ❌ 既存のAPIクライアントとの互換性が失われる
- ❌ 段階的な移行が困難

## 📋 実装優先度

### 最優先（Critical）
1. ✅ **スキーマ定義の変更**: `src/lib/lancedb-schema-extended.ts`
2. ✅ **データベースクエリの変更**: `src/ai/flows/retrieve-relevant-docs-lancedb.ts`
3. ✅ **データベースクエリの変更**: `src/lib/lancedb-search-client.ts`

### 高優先度（High）
4. ⚠️ **型定義の変更**: `src/types/search.ts`
5. ⚠️ **型定義の変更**: `src/lib/hybrid-search-engine.ts`
6. ⚠️ **型定義の変更**: `src/lib/lunr-search-client.ts`

### 中優先度（Medium）
7. ⚠️ **変換レイヤーの実装**: データベース→APIレスポンス
8. ⚠️ **テストコードの更新**: すべてのテストファイル

## ⚠️ 注意事項

### データベースマイグレーション
- **既存データ**: `.lancedb`データベースの再構築が必要
- **バックアップ**: マイグレーション前に必ずバックアップを取得
- **ダウンタイム**: データベース再構築中のサービス停止が必要

### API互換性
- **フロントエンド**: APIレスポンスを`pageId`に維持することで影響を回避可能
- **段階的移行**: 内部処理のみ変更することで段階的な移行が可能

### テスト戦略
- **Unit Tests**: すべての型定義とクエリ関数のテスト
- **Integration Tests**: APIエンドポイントとデータベースクエリのテスト
- **Performance Tests**: インデックスの効果を確認（目標: < 100ms）

## ✅ 検証完了項目

1. ✅ ローカル検証: `page_id`フィールドを持つテストデータベースの作成
2. ✅ ローカル検証: `page_id`列へのスカラーインデックス作成（成功）
3. ✅ ローカル検証: `getAllChunksByPageId`のテスト実行（平均4ms）
4. ✅ 影響範囲調査: コード内の`pageId`参照箇所の特定（658 occurrences）
5. ✅ 影響範囲調査: 型定義・インターフェースの確認（148 occurrences）
6. ✅ 影響範囲調査: APIレスポンス・データ構造への影響確認（影響低い）

## 🔄 次のステップ

### 残りの検証項目
1. ⏳ データベーススキーマ定義の確認
2. ⏳ テストコードへの影響確認
3. ⏳ 既存データとの互換性確認

### 実装準備
1. マイグレーション計画の最終確認
2. バックアップ戦略の確認
3. ロールバック計画の作成
4. 段階的実装の開始

