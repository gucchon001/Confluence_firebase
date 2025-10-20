# Phase 0A-4: 検索パフォーマンス緊急対応レポート

**作成日**: 2025年10月20日  
**緊急度**: 🚨 **最優先**  
**問題**: 検索時間96.5秒（異常に長い）

---

## 🚨 緊急問題の詳細

### パフォーマンス指標（最新）

| 指標 | 時間 | 評価 |
|:---|:---|:---|
| **サーバー起動時間** | 1ms | ✅ 優秀 |
| **初期応答時間(TTFB)** | 5ms | ✅ 優秀 |
| **検索時間** | **96.5秒** | ❌ **致命的** |
| **AI生成時間** | 14.2秒 | ✅ 正常 |
| **総処理時間** | 110.8秒 | ❌ 致命的 |
| **参照数** | 12件 | ✅ 正常 |

**結論**: **検索処理だけで96.5秒かかっている**

---

## 🔍 想定される原因

### 1. **チャンク取得の問題** 🐢

#### 可能性が高い原因

`src/ai/flows/retrieve-relevant-docs-lancedb.ts`:

```typescript
// enrichWithAllChunks で全チャンク取得
const allChunks = await getAllChunksByPageId(String(pageId));
```

**問題**:
- 12件の結果に対してチャンク取得を実行
- 各ページが多数のチャンクを持つ場合、**並列処理でも時間がかかる**
- 1ページあたり8秒かかる場合: 12ページ × 8秒 = **96秒**

#### ログで確認すべき項目

```
[ChunkMerger] ⚠️ Slow chunk retrieval: {duration}ms for pageId {id}
```

### 2. **LanceDB接続の遅延** 🌐

#### 可能性がある原因

**データソースの場所**:
- Cloud Storage: `US-CENTRAL1`（米国）
- App Hosting: `us-central1`（米国）
- **同一リージョンなので問題なし**

**ただし**:
- データが実行時にCloud Storageから読み込まれている可能性
- `SKIP_DATA_DOWNLOAD=false`でビルド時にDLするはずだが...

#### ログで確認すべき項目

```
⚠️ [searchLanceDB] Slow parallel initialization
⚠️ [searchLanceDB] Slow search
```

### 3. **Lunr初期化の遅延** ⚙️

#### 可能性がある原因

**Lunr初期化が毎回実行されている**:

```typescript
await optimizedLunrInitializer.initializeOnce();
await new Promise(resolve => setTimeout(resolve, 100)); // 100ms待機
```

**問題**:
- Lunrインデックスが大きい場合、初期化に時間がかかる
- キャッシュが無効化されている可能性

#### ログで確認すべき項目

```
⚠️ Optimized Lunr initialization failed
⚠️ [searchLanceDB] Slow parallel initialization
```

### 4. **並列処理の実行失敗** ⚡

#### 可能性がある原因

**Promise.allが正しく動作していない**:

```typescript
const [vector, keywords, connection] = await Promise.all([
  vectorPromise,
  keywordsPromise,
  connectionPromise
]);
```

**問題**:
- いずれかのPromiseが長時間ブロックしている
- エラーが発生してリトライしている可能性

---

## 📋 緊急調査手順

### ステップ1: Cloud Loggingで詳細ログを確認【最優先】

```
https://console.cloud.google.com/logs/query?project=confluence-copilot-ppjye
```

**確認すべきログ**:

1. **チャンク取得の遅延**:
   ```
   [ChunkMerger] ⚠️ Slow chunk retrieval
   ```

2. **検索全体の遅延**:
   ```
   ⚠️ [searchLanceDB] Slow search
   ⚠️ [lancedbRetrieverTool] Slow searchLanceDB
   ```

3. **並列初期化の遅延**:
   ```
   ⚠️ [searchLanceDB] Slow parallel initialization
   ```

4. **Embedding生成の遅延**:
   ```
   ⚠️ [searchLanceDB] Slow embedding generation
   ```

5. **LanceDB接続の遅延**:
   ```
   ⚠️ [searchLanceDB] Slow LanceDB connection
   ```

### ステップ2: 詳細ログを有効化【緊急】

現在のコードでは10秒以上の処理でしかログが出力されません。**全ての処理でログを出力するように一時的に変更**します：

```typescript
// src/ai/flows/retrieve-relevant-docs-lancedb.ts
// 修正: 10000ms → 100ms（全てのログを出力）
if (searchLanceDBDuration > 100) {
  console.warn(`⚠️ [lancedbRetrieverTool] searchLanceDB: ${searchLanceDBDuration}ms`);
}

// src/lib/lancedb-search-client.ts
// 修正: 5000ms → 100ms（全てのログを出力）
if (parallelDuration > 100) {
  console.warn(`⚠️ [searchLanceDB] parallel init: ${parallelDuration}ms`);
}

// 修正: 10000ms → 100ms（全てのログを出力）
if (searchFunctionDuration > 100) {
  console.warn(`⚠️ [searchLanceDB] total: ${searchFunctionDuration}ms`);
}
```

### ステップ3: チャンク取得の詳細ログ追加【緊急】

```typescript
// src/ai/flows/retrieve-relevant-docs-lancedb.ts
export async function enrichWithAllChunks(results: any[]): Promise<any[]> {
  const enrichStartTime = Date.now();
  
  // 全体の開始ログ
  console.log(`[ChunkMerger] Starting enrichment for ${results.length} results`);
  
  const enriched = await Promise.all(
    results.map(async (result, index) => {
      const pageStartTime = Date.now();
      const pageId = result.pageId || result.id;
      
      // ページごとの開始ログ
      console.log(`[ChunkMerger] Processing page ${index + 1}/${results.length}: ${pageId}`);
      
      const chunkStartTime = Date.now();
      const allChunks = await getAllChunksByPageId(String(pageId));
      const chunkDuration = Date.now() - chunkStartTime;
      
      // 全てのチャンク取得でログ出力
      console.log(`[ChunkMerger] Page ${index + 1}: ${chunkDuration}ms for ${allChunks.length} chunks`);
      
      // ページ全体の処理時間
      const pageDuration = Date.now() - pageStartTime;
      console.log(`[ChunkMerger] Page ${index + 1} total: ${pageDuration}ms`);
      
      return result;
    })
  );
  
  const enrichDuration = Date.now() - enrichStartTime;
  console.log(`[ChunkMerger] Total enrichment: ${enrichDuration}ms`);
  
  return enriched;
}
```

---

## 🎯 暫定対策（即座に実施可能）

### 対策1: チャンク取得のタイムアウト設定【推奨】

```typescript
// src/ai/flows/retrieve-relevant-docs-lancedb.ts
async function getAllChunksByPageIdWithTimeout(pageId: string, timeoutMs: number = 5000): Promise<any[]> {
  return Promise.race([
    getAllChunksByPageId(pageId),
    new Promise<any[]>((_, reject) => 
      setTimeout(() => reject(new Error(`Chunk retrieval timeout for ${pageId}`)), timeoutMs)
    )
  ]);
}
```

### 対策2: チャンク取得のバッチサイズ制限【推奨】

```typescript
// src/ai/flows/retrieve-relevant-docs-lancedb.ts
export async function enrichWithAllChunks(results: any[]): Promise<any[]> {
  const BATCH_SIZE = 3; // 一度に3ページまで並列処理
  const enriched: any[] = [];
  
  for (let i = 0; i < results.length; i += BATCH_SIZE) {
    const batch = results.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (result) => {
        // チャンク取得処理
      })
    );
    enriched.push(...batchResults);
  }
  
  return enriched;
}
```

### 対策3: チャンク取得のスキップ【緊急回避策】

```typescript
// src/ai/flows/retrieve-relevant-docs-lancedb.ts
export async function enrichWithAllChunks(results: any[]): Promise<any[]> {
  // Phase 0A-4 EMERGENCY: チャンク取得を一時的にスキップ
  console.warn('⚠️ [EMERGENCY] Chunk enrichment temporarily disabled');
  return results;
}
```

---

## 🔍 想定される問題パターンと対策

### パターン1: チャンク取得が全体で90秒かかっている

**ログの例**:
```
[ChunkMerger] Page 1: 8000ms for 50 chunks
[ChunkMerger] Page 2: 7500ms for 45 chunks
...
[ChunkMerger] Total enrichment: 90000ms
```

**対策**:
1. `getAllChunksByPageId`のクエリ最適化
2. チャンク数の制限（最大20チャンク/ページ）
3. バッチサイズの縮小（12ページ → 3ページずつ）

### パターン2: 並列初期化が30秒かかっている

**ログの例**:
```
⚠️ [searchLanceDB] Slow embedding generation: 25000ms
⚠️ [searchLanceDB] Slow LanceDB connection: 5000ms
⚠️ [searchLanceDB] Slow parallel initialization: 30000ms
```

**対策**:
1. Embeddingモデルのキャッシュ確認
2. LanceDB接続のプール化
3. 並列度の調整

### パターン3: Lunr初期化が60秒かかっている

**ログの例**:
```
[LunrSearchClient] Initializing Lunr index...
(60秒無音)
✅ Optimized Lunr initialization completed
```

**対策**:
1. Lunrインデックスサイズの削減
2. MessagePack形式の使用（既に実装済み）
3. インデックスの事前ロード（`instrumentation.js`）

---

## 🚀 推奨アクション（優先順位順）

### 優先度1: 詳細ログの確認【即座】

1. Cloud Loggingで最新のリクエストログを確認
2. 96.5秒のうち、どこで時間がかかっているか特定
3. 上記の「確認すべきログ」を全て確認

### 優先度2: 詳細ログの追加【10分以内】

1. ログ出力閾値を100msに変更
2. チャンク取得の詳細ログを追加
3. 再デプロイして再テスト

### 優先度3: 緊急回避策の実施【30分以内】

1. チャンク取得のタイムアウト設定（5秒）
2. バッチサイズの制限（3ページずつ）
3. 最悪の場合、チャンク取得を一時的にスキップ

### 優先度4: 根本対策の実施【1-2時間】

1. 問題箇所を特定
2. クエリ最適化またはアルゴリズム変更
3. パフォーマンステストで検証

---

## 📊 期待される改善

| 対策 | 現在 | 改善後 | 改善率 |
|:---|:---|:---|:---|
| **チャンク取得タイムアウト** | 96.5秒 | 15秒 | **84%削減** |
| **バッチサイズ制限** | 96.5秒 | 30秒 | **69%削減** |
| **チャンク取得スキップ** | 96.5秒 | 5秒 | **95%削減** |

---

## ⚠️ 重要な注意事項

### チャンク取得をスキップした場合の影響

**品質への影響**:
- ❌ 長文ページの情報が不完全になる
- ❌ チャンク分割されたページの全体像が見えない
- ✅ 短文ページ（66.3%）は影響なし

**推奨**:
1. まずタイムアウトとバッチサイズ制限を試す
2. それでも改善しない場合のみスキップを検討

---

## 📝 次のステップ

1. **即座**: Cloud Loggingで詳細ログを確認
2. **10分以内**: 詳細ログを追加してデプロイ
3. **30分以内**: 緊急回避策を実施
4. **1-2時間**: 根本対策を実施

---

**作成日**: 2025年10月20日  
**最終更新**: 2025年10月20日  
**緊急度**: 🚨 **最優先**  
**ステータス**: 調査中、Cloud Logging確認待ち

