# 未使用ディレクトリ分析レポート

**作成日**: 2025年11月6日  
**最終更新**: 2025年11月6日（削除完了）  
**目的**: プロジェクト内で使用されていないディレクトリを特定

---

## 📊 分析結果サマリー

### ✅ 使用されているディレクトリ

以下のディレクトリは現在使用されています：

1. **`src/`** - メインソースコード
2. **`scripts/`** - ビルド・デプロイスクリプト
3. **`docs/`** - ドキュメント
4. **`functions/`** - Cloud Functions
5. **`data/`** - データファイル（一部のサブディレクトリを除く）
6. **`setup/`** - セットアップスクリプト（使用中）

---

## ⚠️ 使用されていない可能性があるディレクトリ

### 1. `src/app/api/init-data/` ⚠️ **空のディレクトリ**

**状態**: 空のディレクトリ（ファイルなし）

**確認結果**:
- コード内で参照されていない
- `package.json`で使用されていない
- APIルートとして定義されていない

**推奨アクション**: **削除可能**

---

### 2. `tests/` ⚠️ **ルートレベルのテストディレクトリ**

**状態**: 14個のテストファイルが含まれている

**確認結果**:
- 実際のテストは`src/tests/`で実行されている
- `package.json`のテストスクリプトは`src/tests/`を参照
- ルートレベルの`tests/`は使用されていない

**推奨アクション**: 
- `src/tests/`に統合するか、アーカイブに移動
- または削除（`src/tests/`に統合済みの場合）

---

### 3. `models/` ⚠️ **Xenova Transformersモデルファイル**

**状態**: `paraphrase-multilingual-mpnet-base-v2`モデルファイルが含まれている

**確認結果**:
- 現在はGemini Embeddings API (`text-embedding-004`) を使用
- `@xenova/transformers`は使用されていない（2025-10-28移行完了）
- `package.json`に`model:download`と`model:clean`スクリプトが残っているが、実際には使用されていない
- `.gitignore`で`/models/`が無視されている

**推奨アクション**: 
- **削除可能**（`npm run model:clean`で削除可能）
- `package.json`の`model:download`と`model:clean`スクリプトも削除推奨
- `scripts/download-embedding-model.js`も削除推奨

---

### 4. `data/validation/` ⚠️ **検証データディレクトリ**

**状態**: 3個のファイルが含まれている
- `problematic-pages.json`
- `quality-report.json`
- `summary-report.md`

**確認結果**:
- コード内で参照されていない
- `package.json`で使用されていない
- ドキュメントで`data/validation-v2/`が言及されているが、`data/validation/`は使用されていない

**推奨アクション**: 
- アーカイブに移動するか削除
- または`data/validation-v2/`に統合

---

## 📋 推奨アクション

### 優先度: 高 🔴

1. **`src/app/api/init-data/`** - 削除（空のディレクトリ）
2. **`models/`** - 削除（Xenova Transformersは使用されていない）
   - `npm run model:clean`で削除可能
   - `package.json`の`model:download`と`model:clean`スクリプトも削除
   - `scripts/download-embedding-model.js`も削除

### 優先度: 中 🟡

3. **`tests/`** - `src/tests/`に統合済みか確認し、不要なら削除またはアーカイブ
4. **`data/validation/`** - アーカイブに移動するか削除

---

## 🔍 詳細分析

### `models/`ディレクトリの詳細

**現在の状態**:
- Xenova Transformersモデルファイルが含まれている
- 現在はGemini Embeddings APIを使用しているため不要

**移行履歴**:
- 2025-10-28: `@xenova/transformers`からGemini Embeddings APIに移行完了
- `apphosting.yaml`からXenova Transformers関連の環境変数も削除済み

**削除方法**:
```bash
npm run model:clean
```

**追加で削除すべきファイル**:
- `scripts/download-embedding-model.js` - 使用されていない
- `package.json`の`model:download`と`model:clean`スクリプト

---

## 📊 統計

| ディレクトリ | 状態 | 優先度 | 推奨アクション |
|------------|------|--------|--------------|
| `src/app/api/init-data/` | 空 | 高 | 削除 |
| `tests/` | 未使用 | 中 | 確認後削除/アーカイブ |
| `models/` | 未使用 | 高 | 削除 |
| `data/validation/` | 未使用 | 中 | アーカイブ/削除 |

---

## ✅ 確認済み事項

- ✅ `src/tests/`は使用中（テスト実行に使用）
- ✅ `scripts/`は使用中（ビルド・デプロイに使用）
- ✅ `docs/`は使用中（ドキュメント管理）
- ✅ `setup/`は使用中（セットアップスクリプト）
- ✅ `data/confluence-extraction-v2/`は使用中
- ✅ `data/domain-knowledge-v2/`は使用中
- ✅ `data/llm-extraction-v2/`は使用中

---

**結論**: 4つのディレクトリが使用されていない可能性があります。特に`models/`と`src/app/api/init-data/`は確実に削除可能です。

---

## ✅ 削除完了（2025年11月6日）

### 削除・移動したディレクトリ

1. ✅ **`src/app/api/init-data/`** - 削除完了（空のディレクトリ）
2. ✅ **`models/`** - 削除完了（`npm run model:clean`で削除）
3. ✅ **`tests/`** - アーカイブに移動完了（`docs/archive/tests/`に移動）
4. ✅ **`data/validation/`** - アーカイブに移動完了（`docs/archive/data/validation/`に移動）

### 削除したファイル

1. ✅ **`scripts/download-embedding-model.js`** - 削除完了（Xenova Transformers用、不要）

### 修正したファイル

1. ✅ **`package.json`** - `model:download`と`model:clean`スクリプトを削除
2. ✅ **`package.json`** - `test:search-integrated`と`test:search-hybrid`スクリプトを削除（`tests/`ディレクトリがアーカイブに移動したため）

---

**削除作業完了**: すべての未使用ディレクトリとファイルの削除・アーカイブが完了しました。

