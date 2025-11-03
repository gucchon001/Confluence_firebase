# アーカイブされたファイル

このディレクトリには、現在のコードベースで使用されていない古い実装ファイルがアーカイブされています。

## アーカイブされた理由

これらのファイルは、新しい実装に置き換えられたか、または現在のコードベースで参照されていないため、アーカイブに移動されました。

## アーカイブされたファイル一覧

### 初期化関連（古い実装）
- `optimized-lunr-initializer.ts` - `lunr-initializer.ts`に置き換え済み
- `performance-optimized-initializer.ts` - `startup-optimizer.ts`に置き換え済み
- `simple-performance-optimizer.ts` - 使用されていない
- `quality-preserving-optimizer.ts` - 使用されていない
- `unified-initializer.ts` - `startup-optimizer.ts`に置き換え済み
- `startup-initializer.ts` - `startup-optimizer.ts`に置き換え済み

### アンベディング関連（古い実装）
- `optimized-embeddings.ts` - `embeddings.ts`に置き換え済み
- `unified-embedding-service.ts` - `embeddings.ts`に置き換え済み

### キャッシュ関連（古い実装）
- `generic-cache.ts` - `lancedb-cache.ts`や`persistent-cache.ts`に置き換え済み
- `embedding-cache.ts` - 使用されていない
- `keyword-cache.ts` - 使用されていない

### エンジン関連（古い実装）
- `rag-engine.ts` - `hybrid-search-engine.ts`に置き換え済み

### エラーハンドリング関連（古い実装）
- `error-handling.ts` - `api-error-handler.ts`や`genkit-error-handler.ts`に置き換え済み

## 現在の実装

### 初期化
- ✅ `startup-optimizer.ts` - 現在使用中
- ✅ `lunr-initializer.ts` - 現在使用中

### アンベディング
- ✅ `embeddings.ts` - 現在使用中

### キャッシュ
- ✅ `lancedb-cache.ts` - 現在使用中
- ✅ `persistent-cache.ts` - 現在使用中

### エンジン
- ✅ `hybrid-search-engine.ts` - 現在使用中

### エラーハンドリング
- ✅ `api-error-handler.ts` - 現在使用中
- ✅ `genkit-error-handler.ts` - 現在使用中

## 復元方法

必要に応じて、以下のコマンドでファイルを復元できます：

```bash
# 特定のファイルを復元
mv src/lib/archive/filename.ts src/lib/filename.ts

# すべてのファイルを復元
mv src/lib/archive/*.ts src/lib/
```

## 注意事項

⚠️ **これらのファイルは現在のコードベースで使用されていません。**
- 復元する場合は、依存関係を確認してください
- 復元後は、ビルドとテストを実行して正常に動作することを確認してください

## アーカイブ日

2025-11-02

