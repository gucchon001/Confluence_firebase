# コードクリーンアップ分析レポート

**作成日**: 2025年1月  
**分析対象**: `data-flow-diagram-lancedb.md`に基づくデータフロー全体  
**目的**: 重複コード・未使用コード・アーカイブ済みコードの特定

## 分析方法

データフローに沿って、各ステップごとにコードを確認：
1. **データ取得と処理** (Confluence API → バッチ同期処理)
2. **テキスト分割** → チャンク処理
3. **埋め込みベクトル生成** → Gemini Embeddings API
4. **ベクトルとメタデータ保存** → LanceDB
5. **認証チェック** → Firebase Auth
6. **クエリ処理** → ベクトル化・キーワード抽出
7. **並列検索実行** (ベクトル、キーワード、BM25、タイトル)
8. **スコアリング統合・重複除去**
9. **ストリーミング回答生成**
10. **マークダウン正規化**

## 発見事項

### ✅ アーカイブ済み（問題なし）

以下のファイル・ディレクトリは既に`archive/`配下に移動済み：

#### 同期スクリプト（アーカイブ済み）
- `scripts/archive/differential-sync.ts`
- `scripts/archive/full-page-sync-optimized.ts`
- `scripts/archive/memory-efficient-sync.ts`
- `scripts/archive/memory-optimized-full-sync.ts`
- `scripts/archive/optimized-confluence-sync-service.ts`
- `scripts/archive/optimized-full-sync-with-api-limits.ts`
- `scripts/archive/production-full-sync.ts`
- `scripts/archive/sync-20pages.ts`
- `scripts/archive/temporary/src-scripts/unified-confluence-sync.ts`

#### 埋め込み関連（アーカイブ済み）
- `src/lib/archive/embedding-cache.ts`
- `src/lib/archive/optimized-embeddings.ts`
- `src/lib/archive/unified-embedding-service.ts`

#### その他（アーカイブ済み）
- `src/lib/archive/optimized-lunr-initializer.ts`
- `src/lib/archive/performance-optimized-initializer.ts`
- `src/lib/archive/quality-preserving-optimizer.ts`
- `src/lib/archive/rag-engine.ts`
- `src/lib/archive/simple-performance-optimizer.ts`
- `src/lib/archive/startup-initializer.ts`
- `src/lib/archive/unified-initializer.ts`

### ⚠️ 削除推奨（未使用・非推奨）

#### 1. `src/lib/embedding-utils.ts` - **非推奨・未使用**

**理由**: 
- ファイル冒頭に「このファイルは非推奨です。src/lib/embeddings.ts を使用してください。」と明記
- コードベース全体で参照が0件（`grep`で確認済み）
- `embeddings.ts`に機能が統合済み

**影響**: 
- 削除しても影響なし

**推奨アクション**: 削除

---

#### 2. `src/lib/archive/` 配下の一部ファイル - **アーカイブ済みだが確認要**

以下のファイルが`src/lib/archive/`に存在しますが、参照が残っていないか確認が必要：

- `src/lib/archive/jira-sync-service.ts` - Jira同期サービス（アーカイブ）
- `src/lib/archive/generic-cache.ts` - 汎用キャッシュ（アーカイブ）
- `src/lib/archive/keyword-cache.ts` - キーワードキャッシュ（アーカイブ）
- `src/lib/archive/error-handling.ts` - エラーハンドリング（アーカイブ）

**確認方法**: 
```bash
grep -r "archive/jira-sync-service" src/
grep -r "archive/generic-cache" src/
grep -r "archive/keyword-cache" src/
grep -r "archive/error-handling" src/
```

**推奨アクション**: 参照がなければ問題なし、参照があれば確認

---

### ✅ 現在使用中（問題なし）

#### データ取得と処理
- ✅ `src/scripts/batch-sync-confluence.ts` - メインの同期スクリプト
- ✅ `src/lib/confluence-sync-service.ts` - 同期サービスの実装

#### チャンク処理
- ✅ `src/lib/confluence-sync-service.ts` 内の `splitPageIntoChunks()` メソッド

#### 埋め込みベクトル生成
- ✅ `src/lib/embeddings.ts` - メインの埋め込み生成（Gemini REST API直接呼び出し）
  - BOMサニタイズ機能内蔵
  - 簡易キャッシュ機能内蔵

#### 検索関連
- ✅ `src/lib/lancedb-search-client.ts` - LanceDB検索クライアント
- ✅ `src/lib/hybrid-search-engine.ts` - ハイブリッド検索エンジン
- ✅ `src/lib/lunr-search-client.ts` - BM25検索（Lunr.js）
- ✅ `src/lib/lunr-initializer.ts` - Lunrインデックス初期化

#### 認証
- ✅ `src/hooks/use-auth.tsx` - メインの認証フック
- ✅ `src/hooks/use-mock-auth.tsx` - テスト用モック
- ✅ `src/lib/firebase-unified.ts` - Firebase統一サービス

#### ストリーミング・LLM
- ✅ `src/ai/flows/streaming-summarize-confluence-docs.ts` - ストリーミング要約（メイン）
- ✅ `src/ai/flows/retrieve-relevant-docs-lancedb.ts` - 関連ドキュメント検索
- ✅ `src/app/api/streaming-process/route.ts` - ストリーミングAPIエンドポイント

#### マークダウン処理
- ✅ `src/lib/markdown-utils.tsx` - マークダウン処理ユーティリティ
  - `fixMarkdownTables()` - テーブル正規化
  - `normalizeMarkdownSymbols()` - 記号正規化
  - `convertReferencesToNumberedLinks()` - 参照リンク変換
  - `createSharedMarkdownComponents()` - 共通コンポーネント

---

### 🔍 要確認事項

#### 1. `src/lib/archive/` 配下の参照状況

以下を確認する必要があります：

```bash
# アーカイブ配下への参照がないか確認
grep -r "from.*archive/" src/ --exclude-dir=archive
grep -r "import.*archive/" src/ --exclude-dir=archive
```

#### 2. `scripts/archive/` 配下の使用状況

古いスクリプトが残っていないか確認：

```bash
# package.jsonのスクリプトで参照されていないか確認
grep -E "archive/|scripts/archive" package.json
```

#### 3. テストファイルの重複

テストファイルに重複ロジックがないか確認：

```bash
# 重複するテストパターンを検索
find src/tests -name "*.test.ts" -o -name "*.spec.ts" | xargs grep -l "confluence.*sync\|embedding.*generate\|search.*lancedb"
```

---

## 推奨アクション

### 優先度: 高

1. **`src/lib/embedding-utils.ts` を削除**
   - 理由: 非推奨・未使用
   - 影響: なし

### 優先度: 中

2. **`src/lib/archive/` 配下の参照を確認**
   - 理由: アーカイブ済みだが参照が残っていないか確認
   - 影響: 参照があれば削除前に移行が必要

3. **`scripts/archive/` 配下の使用状況を確認**
   - 理由: `package.json`のスクリプトで参照されていないか確認
   - 影響: 参照があれば削除前に移行が必要

### 優先度: 低

4. **テストファイルの重複ロジックを確認**
   - 理由: 重複するテストロジックの統合
   - 影響: テストの保守性向上

---

## 実施手順

### Step 1: `embedding-utils.ts` の削除

**✅ 確認済み（2025年1月）**:
- `grep -r "embedding-utils" src/` → 参照なし
- 削除可能

```bash
# 1. 削除
rm src/lib/embedding-utils.ts

# 2. 型チェック・ビルド確認
npm run typecheck
npm run build
```

### Step 2: アーカイブ参照の確認

**✅ 確認済み（2025年1月）**:
- `grep -r "from.*archive/" src/` → 参照なし
- `grep -r "import.*archive/" src/` → 参照なし
- `grep -E "archive/" package.json` → 参照なし
- **結論**: アーカイブ配下への参照は存在しない。問題なし。

### Step 3: テスト実行

```bash
# 変更後のテスト実行
npm test

# 統合テスト実行
npm run test:integration
```

---

## コード重複の修正

### ⚠️ 発見された重複

#### 1. `removeBOM`関数の重複

**問題**: 
- `src/lib/bom-utils.ts` に統合版の `removeBOM()` が定義されている
- `src/ai/flows/retrieve-relevant-docs-lancedb.ts` に簡易版の `removeBOM()` が重複定義されていた

**修正**:
- ✅ `retrieve-relevant-docs-lancedb.ts` の重複実装を削除
- ✅ `bom-utils.ts` から `removeBOM` をインポートするように変更

**修正ファイル**:
- `src/ai/flows/retrieve-relevant-docs-lancedb.ts`

---

## まとめ

### 削除済み
- ✅ `src/lib/embedding-utils.ts` - 非推奨・未使用（削除済み）

### 重複修正済み
- ✅ `removeBOM`関数の重複 - `retrieve-relevant-docs-lancedb.ts` で修正済み

### 確認済み（問題なし）
- ✅ `src/lib/archive/` 配下の参照状況 - 参照なし
- ✅ `scripts/archive/` 配下の使用状況 - 参照なし
- ✅ `pageId`/`page_id` 変換ロジック - `pageid-migration-helper.ts` に統合済み
- ✅ チャンク分割ロジック - `confluence-sync-service.ts` に1箇所のみ

### 問題なし
- ✅ 現在のメインフローで使用されているコードは重複なし（修正済み）
- ✅ アーカイブ済みコードは適切に管理されている
- ✅ データフローに沿ったコード構成は適切

---

## 今後の方針

1. **定期的なコードレビュー**: アーカイブ配下への参照が増えないように注意
2. **非推奨コードの早期削除**: 非推奨マークがあるコードは、移行後に即座に削除
3. **テストカバレッジ**: 削除前にテストで動作確認

