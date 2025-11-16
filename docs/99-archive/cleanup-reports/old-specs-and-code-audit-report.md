# 古い仕様・コード監査レポート

**作成日**: 2025年1月  
**目的**: 古い仕様やコードを特定し、混乱を防ぐため

---

## 📋 確認結果サマリー

### ✅ アーカイブされているもの（問題なし）

#### コードファイル
- ✅ `src/lib/archive/` - アーカイブフォルダに移動済み、参照なし
- ✅ `scripts/archive/` - アーカイブフォルダに移動済み、参照なし

#### ドキュメント
- ✅ `docs/archive/` - アーカイブフォルダに移動済み
- ✅ `docs/archive/deprecated/` - 非推奨ドキュメントフォルダ

---

## ⚠️ 古い仕様が残っているドキュメント（修正推奨）

### 1. `pageId` vs `page_id` の不一致

#### 現在の正しい仕様
- **データベースフィールド**: `page_id` (int64型)
- **APIレスポンス**: `pageId` (string型) - 変換レイヤーで維持
- **マイグレーション**: 2025年11月に完了

#### 古い仕様を参照しているドキュメント

| ファイル | 問題 | 修正推奨 |
|---------|------|---------|
| `docs/implementation/lancedb-label-type-specification.md` (Line 351) | `pageId: string` | `page_id: number` (int64) に修正 |
| `docs/implementation/domain-knowledge-extraction-comprehensive-guide.md` (Line 170) | `pageId: string` | `page_id: number` (int64) に修正 |
| `docs/architecture/lancedb-firestore-integration-design.md` (Line 116, 338, 354) | `pageId: string` | API側は`pageId: string`（変換レイヤー）、DB側は`page_id: int64`と明記 |
| `docs/architecture/hybrid-search-specification-latest.md` (Line 374) | `pageId: string` | 関数パラメータは`pageId: string`（文字列として受け取る）で問題なし |
| `docs/architecture/search-system-comprehensive-guide.md` (Line 52) | `pageId:number` | `page_id: number` (int64) に修正 |

#### アーカイブドキュメント（参照しない）
- `docs/archive/deprecated/current-implementation-status.md` - 古い仕様（参照しない）
- `docs/archive/migration/pageid-to-page-id-migration-plan.md` - マイグレーション計画（完了済み）

---

### 2. 技術スタックの不一致

#### 現在の正しい仕様
- **Next.js**: 15.3.3
- **AI**: Google AI Gemini API (gemini-2.5-flash)
- **埋め込み**: Gemini Embeddings API (text-embedding-004)
- **デプロイ**: Firebase App Hosting

#### 古い仕様を参照しているドキュメント

| ファイル | 問題 | 修正推奨 |
|---------|------|---------|
| `docs/archive/deprecated/current-implementation-status.md` (Line 80-86) | Next.js 14, OpenAI API, Vercel | アーカイブフォルダ内のため修正不要（参照しない） |

---

### 3. スキーマ定義の不一致

#### 現在の正しいスキーマ
```typescript
{
  id: 'utf8',
  page_id: 'int64',  // pageIdから変更（スカラーインデックス対応）
  title: 'utf8',
  content: 'utf8',
  vector: { type: 'fixed_size_list', listSize: 768, field: { type: 'float32' } },
  space_key: 'utf8',
  labels: { type: 'list', field: { type: 'utf8' } },
  chunkIndex: 'int32',
  url: 'utf8',
  lastUpdated: 'utf8'
}
```

#### 古い仕様を参照しているドキュメント

| ファイル | 問題 | 修正推奨 |
|---------|------|---------|
| `docs/implementation/lancedb-label-type-specification.md` (Line 349-361) | `pageId: string` | `page_id: number` (int64) に修正 |
| `docs/specifications/lancedb-integration-guide.md` (Line 56) | `pageId: { type: 'int64' }` | `page_id: { type: 'int64' }` に修正 |

---

## ✅ 正しく整備されているもの

### 1. インデックス関連
- ✅ `scripts/create-lancedb-indexes.ts` - 最新仕様（`page_id`対応）
- ✅ `scripts/check-lancedb-indexes.ts` - 最新仕様（`page_id`対応）
- ✅ `docs/implementation/current-implementation-status.md` - 最新仕様

### 2. ラベル関連
- ✅ `scripts/rebuild-lancedb-smart-chunking.ts` - ラベルフィルタリング実装済み
- ✅ `src/lib/confluence-sync-service.ts` - ラベルフィルタリング実装済み
- ✅ `docs/implementation/lancedb-label-filtering-specification.md` - 最新仕様

### 3. LanceDB構築関連
- ✅ `scripts/rebuild-lancedb-smart-chunking.ts` - 最新仕様（`page_id`対応）
- ✅ `docs/implementation/lancedb-data-structure-specification.md` - 最新仕様（`page_id`対応）

---

## 🔧 修正完了事項

### ✅ 優先度1: ドキュメントの修正（混乱防止） - 完了

1. **`docs/implementation/lancedb-label-type-specification.md`** ✅
   - Line 351: `pageId: string` → `page_id: number` (int64) ✅
   - Line 349-361: TypeScriptインターフェースを最新仕様に更新 ✅
   - Line 68-69: コード例を`page_id: parseInt(pageId)`に更新 ✅
   - Line 513, 522, 531: データ例を`page_id`に更新 ✅

2. **`docs/implementation/domain-knowledge-extraction-comprehensive-guide.md`** ✅
   - Line 170: `pageId: string` → API側では文字列型、DB側では`page_id` (int64)と明記 ✅

3. **`docs/architecture/lancedb-firestore-integration-design.md`** ✅
   - Line 116: Firestore側は`pageId: string`と明記 ✅
   - Line 137: LanceDB側は`page_id: int64`に修正 ✅
   - Line 338, 354: API側とDB側の区別を明記 ✅
   - Line 391: LanceDBスキーマを`page_id: 'int64'`に修正 ✅

4. **`docs/architecture/search-system-comprehensive-guide.md`** ✅
   - Line 52: `pageId:number` → `page_id: number` (int64) ✅
   - APIレスポンスでは`pageId` (string型)を維持することを明記 ✅

5. **`docs/specifications/lancedb-integration-guide.md`** ✅
   - Line 56: `pageId: { type: 'int64' }` → `page_id: { type: 'int64' }` ✅
   - Line 65-70: セクション名と説明を`page_id`に更新 ✅

### ✅ 優先度2: コードコメントの修正（開発者向け） - 確認済み

1. **`src/lib/lancedb-search-client.ts`**
   - Line 1352: `@param pageId ページID（string型: "718373062"）` - 関数パラメータは`string`型で問題なし（変換レイヤーで処理）✅ 修正不要

---

## 📊 監査結果サマリー

### アーカイブ状況
- ✅ **コードファイル**: アーカイブフォルダに移動済み、参照なし
- ✅ **ドキュメント**: アーカイブフォルダに移動済み

### 修正が必要な項目
- ⚠️ **ドキュメント**: 5ファイルで古い仕様（`pageId`）を参照
- ⚠️ **コードコメント**: 1ファイルで古い仕様を参照（ただし、関数パラメータは`string`型で問題なし）

### 混乱のリスク
- 🟡 **中程度**: 一部のドキュメントが古い仕様を参照しているが、アーカイブフォルダ内のドキュメントは明確に分離されている

---

## 🎯 修正完了サマリー

### ✅ 修正完了（2025年1月）

1. **ドキュメント修正**: 5ファイルで古い仕様（`pageId`）を最新仕様（`page_id`）に更新
2. **明確化**: API側とDB側の区別を明記（API側は`pageId: string`、DB側は`page_id: int64`）
3. **コードコメント**: 関数パラメータは`string`型で問題なし（変換レイヤーで処理）

### 📊 修正結果

- ✅ **修正完了**: 5ファイル
- ✅ **明確化**: API側とDB側の区別を明記
- ✅ **アーカイブ**: 既に適切に整備済み

---

**結論**: すべてのドキュメント修正が完了しました。古い仕様（`pageId`）の参照は最新仕様（`page_id`）に更新され、API側とDB側の区別も明確になりました。混乱を防ぐための整備が完了しています。

