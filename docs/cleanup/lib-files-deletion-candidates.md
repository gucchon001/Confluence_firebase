# src/lib ディレクトリの削除候補ファイル

## 分析結果

本番コード（`src/app`）で使用されていないファイルを特定しました。

## 削除候補（本番コードで未使用）

### 初期化関連（古い実装）
- ✅ `optimized-lunr-initializer.ts` - `lunr-initializer.ts`が使用されている
- ✅ `performance-optimized-initializer.ts` - `startup-optimizer.ts`が使用されている
- ✅ `simple-performance-optimizer.ts` - 使用されていない
- ✅ `quality-preserving-optimizer.ts` - 使用されていない
- ✅ `unified-initializer.ts` - `startup-optimizer.ts`が使用されている
- ✅ `startup-initializer.ts` - `startup-optimizer.ts`が使用されている

### アンベディング関連（古い実装）
- ✅ `optimized-embeddings.ts` - `embeddings.ts`が使用されている
- ✅ `unified-embedding-service.ts` - `embeddings.ts`が使用されている

### キャッシュ関連（古い実装）
- ✅ `generic-cache.ts` - `lancedb-cache.ts`や`persistent-cache.ts`が使用されている
- ✅ `embedding-cache.ts` - 使用されていない
- ✅ `keyword-cache.ts` - 使用されていない

### エンジン関連（古い実装）
- ✅ `rag-engine.ts` - `hybrid-search-engine.ts`が使用されている
- ⚠️ `hybrid-search-engine.ts` - **使用されている（削除しない）**

### エラーハンドリング関連（古い実装）
- ✅ `error-handling.ts` - `api-error-handler.ts`や`genkit-error-handler.ts`が使用されている

## 削除推奨度

### 高（確実に削除可能）
1. `optimized-lunr-initializer.ts` - `lunr-initializer.ts`に置き換え済み
2. `performance-optimized-initializer.ts` - `startup-optimizer.ts`に置き換え済み
3. `startup-initializer.ts` - `startup-optimizer.ts`に置き換え済み
4. `optimized-embeddings.ts` - `embeddings.ts`に置き換え済み
5. `error-handling.ts` - `api-error-handler.ts`に置き換え済み
6. `rag-engine.ts` - `hybrid-search-engine.ts`に置き換え済み

### 中（確認推奨）
1. `simple-performance-optimizer.ts` - 使用されていないが、将来使用される可能性
2. `quality-preserving-optimizer.ts` - 使用されていないが、将来使用される可能性
3. `unified-initializer.ts` - 使用されていないが、将来使用される可能性
4. `unified-embedding-service.ts` - 使用されていないが、将来使用される可能性
5. `generic-cache.ts` - 使用されていないが、将来使用される可能性
6. `embedding-cache.ts` - 使用されていないが、将来使用される可能性
7. `keyword-cache.ts` - 使用されていないが、将来使用される可能性

## 削除前の確認事項

1. **テストファイルでの参照**
   - `src/tests`ディレクトリ内で使用されている可能性
   - テストファイルは削除しても問題ないか確認

2. **スクリプトファイルでの参照**
   - `src/scripts`ディレクトリ内で使用されている可能性
   - スクリプトファイルは削除しても問題ないか確認

3. **将来の使用可能性**
   - 実験的な実装として残しておくべきか検討

## 実行結果

✅ **2025-11-02: すべての削除候補ファイルを `src/lib/archive/` に移動しました**

### 移動されたファイル（13ファイル）
1. ✅ `optimized-lunr-initializer.ts` → `src/lib/archive/`
2. ✅ `performance-optimized-initializer.ts` → `src/lib/archive/`
3. ✅ `startup-initializer.ts` → `src/lib/archive/`
4. ✅ `optimized-embeddings.ts` → `src/lib/archive/`
5. ✅ `error-handling.ts` → `src/lib/archive/`
6. ✅ `rag-engine.ts` → `src/lib/archive/`
7. ✅ `simple-performance-optimizer.ts` → `src/lib/archive/`
8. ✅ `quality-preserving-optimizer.ts` → `src/lib/archive/`
9. ✅ `unified-initializer.ts` → `src/lib/archive/`
10. ✅ `unified-embedding-service.ts` → `src/lib/archive/`
11. ✅ `generic-cache.ts` → `src/lib/archive/`
12. ✅ `embedding-cache.ts` → `src/lib/archive/`
13. ✅ `keyword-cache.ts` → `src/lib/archive/`

### アーカイブの詳細
- アーカイブ先: `src/lib/archive/`
- README: `src/lib/archive/README.md` に詳細を記載
- 復元方法: READMEを参照

## 復元方法

必要に応じて、以下のコマンドでファイルを復元できます：

```bash
# 特定のファイルを復元
mv src/lib/archive/filename.ts src/lib/filename.ts

# すべてのファイルを復元
mv src/lib/archive/*.ts src/lib/
```

## 注意事項

⚠️ **削除前に必ず以下を確認してください：**

1. Gitリポジトリにコミット済みであること
2. バックアップを取得していること
3. テストが正常に動作すること
4. ビルドが正常に完了すること

