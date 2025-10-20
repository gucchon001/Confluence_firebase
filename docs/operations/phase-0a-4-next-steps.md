# Phase 0A-4: 次のステップ - 96.5秒問題の解決手順

**作成日**: 2025年10月20日  
**前回のコミット**: `36e4e215` - 詳細ログ追加とストリーミング修正  
**現在のステータス**: デプロイ中、Cloud Logging確認待ち

---

## 🚀 実施済みの対策

### ✅ コミット & プッシュ完了

**コミット**: `36e4e215`

**変更内容**:
1. ✅ 詳細パフォーマンスログ追加（`searchLanceDB`, `enrichWithAllChunks`）
2. ✅ JSONパースエラー修正（バッファリング追加）
3. ✅ データ存在確認追加（`instrumentation.js`）
4. ✅ Kuromoji辞書コピー改善（Standalone + Server両対応）
5. ✅ ドキュメント整理（古いレポートをarchiveに移動）

**デプロイ状況**:
- Firebase App Hostingが自動的にビルドを開始
- 予想ビルド時間: 5-10分

---

## 📋 次のステップ（優先順位順）

### ステップ1: デプロイ完了を確認【5-10分後】

#### Firebase Consoleで確認

```
https://console.firebase.google.com/project/confluence-copilot-ppjye/apphosting
```

**確認項目**:
- ✅ ビルドが成功したか
- ✅ 新しいリビジョンがデプロイされたか（`build-2025-10-20-XXX`）
- ✅ トラフィックが100%新リビジョンに移行したか

---

### ステップ2: 本番環境でテストクエリを実行【デプロイ完了後】

#### テストクエリ

```
質問: "ログイン認証の仕組みはどうなっていますか？"
```

**確認項目**:
- ✅ JSONパースエラーが出ないか（ブラウザコンソール確認）
- ✅ ストリーミングが正常に動作するか
- ✅ 回答が正しく表示されるか

---

### ステップ3: Cloud Loggingで詳細ログを確認【テスト実行後】

#### Cloud Logging URL

```
https://console.cloud.google.com/logs/query?project=confluence-copilot-ppjye
```

#### 確認すべきログ（優先度順）

##### 1. **データ存在確認ログ**

**フィルター**:
```
resource.type="cloud_run_revision"
textPayload=~"データチェック結果"
```

**期待される出力**:
```
📦 [Instrumentation] データ存在確認中...
📊 [Instrumentation] データチェック結果:
   - LanceDB (.lancedb): ✅
   - Domain Knowledge (data/): ✅
   - Kuromoji Dict (node_modules): ✅
   - Kuromoji Dict (standalone): ✅
```

**もし❌が表示された場合**:
- データがビルドに含まれていない
- `SKIP_DATA_DOWNLOAD`の設定を確認
- ビルドログでダウンロード処理を確認

---

##### 2. **検索処理の詳細ログ**

**フィルター**:
```
resource.type="cloud_run_revision"
textPayload=~"lancedbRetrieverTool.*duration"
```

**期待される出力**:
```
📊 [lancedbRetrieverTool] searchLanceDB duration: XXXXms (X.XXs)
📊 [lancedbRetrieverTool] enrichWithAllChunks duration: XXXXms (X.XXs)
📊 [lancedbRetrieverTool] TOTAL search duration: XXXXms (X.XXs)
```

**分析**:
```
例1: 正常パターン
  searchLanceDB:        5,000ms (5.0s)
  enrichWithAllChunks:  3,000ms (3.0s)
  TOTAL:                8,500ms (8.5s) ✅

例2: チャンク取得が遅い（96.5秒問題）
  searchLanceDB:        5,000ms (5.0s)
  enrichWithAllChunks: 90,000ms (90.0s) ❌ ← ボトルネック
  TOTAL:               96,500ms (96.5s) ❌
```

---

##### 3. **チャンク取得の詳細ログ**

**フィルター**:
```
resource.type="cloud_run_revision"
textPayload=~"ChunkMerger.*Chunk retrieval took"
```

**期待される出力**:
```
[ChunkMerger] Page 1/12: Skipped (not chunked) - タイトル1
[ChunkMerger] Page 2/12: Processing 640450787 - タイトル2
[ChunkMerger] Page 2: Chunk retrieval took 250ms for 5 chunks (pageId: 640450787)
[ChunkMerger] Page 3/12: Processing 656834764 - タイトル3
[ChunkMerger] Page 3: Chunk retrieval took 8500ms for 41 chunks (pageId: 656834764)
⚠️ [ChunkMerger] SLOW chunk retrieval detected!
...
```

**分析**:
- 各ページのチャンク取得時間を確認
- 8秒以上かかっているページを特定
- 合計時間を計算（全ページの合計 = enrichWithAllChunks duration）

---

##### 4. **Kuromoji初期化ログ**

**フィルター**:
```
resource.type="cloud_run_revision"
textPayload=~"JapaneseTokenizer"
```

**期待される出力**:
```
✅ [JapaneseTokenizer] Kuromoji initialized successfully
```

**もしエラーが出た場合**:
```
❌ [JapaneseTokenizer] Failed to initialize kuromoji: ENOENT
```
→ Kuromoji辞書が見つからない（`next.config.ts`の修正が必要）

---

### ステップ4: ボトルネック特定後の対策実施【Cloud Logging確認後】

#### ケース1: `enrichWithAllChunks`が90秒かかっている場合

**対策A: チャンク取得のタイムアウト設定**

`src/ai/flows/retrieve-relevant-docs-lancedb.ts`:

```typescript
async function getAllChunksByPageIdWithTimeout(
  pageId: string, 
  timeoutMs: number = 5000
): Promise<any[]> {
  return Promise.race([
    getAllChunksByPageId(pageId),
    new Promise<any[]>((_, reject) => 
      setTimeout(() => {
        console.warn(`⏰ [ChunkMerger] Timeout after ${timeoutMs}ms for pageId: ${pageId}`);
        reject(new Error(`Chunk retrieval timeout`));
      }, timeoutMs)
    )
  ]).catch((error) => {
    console.error(`❌ [ChunkMerger] Failed to get chunks for ${pageId}:`, error);
    return []; // エラー時は空配列を返す（処理を継続）
  });
}

// enrichWithAllChunks内で使用
const allChunks = await getAllChunksByPageIdWithTimeout(String(pageId), 5000);
```

**期待される改善**:
- 96.5秒 → 60秒（5秒×12ページ = 60秒上限）

**対策B: バッチサイズ制限**

```typescript
export async function enrichWithAllChunks(results: any[]): Promise<any[]> {
  const BATCH_SIZE = 3; // 一度に3ページまで並列処理
  const enriched: any[] = [];
  
  for (let i = 0; i < results.length; i += BATCH_SIZE) {
    const batch = results.slice(i, i + BATCH_SIZE);
    console.log(`[ChunkMerger] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(results.length / BATCH_SIZE)}`);
    
    const batchResults = await Promise.all(
      batch.map(async (result, index) => {
        // チャンク取得処理
      })
    );
    enriched.push(...batchResults);
  }
  
  return enriched;
}
```

**期待される改善**:
- 並列度を制限してリソース競合を回避
- メモリ使用量の削減

**対策C: チャンク数の制限（緊急回避策）**

```typescript
// 大量チャンクの場合は最初の20チャンクのみ取得
const limitedChunks = allChunks.slice(0, 20);
```

**期待される改善**:
- 96.5秒 → 30秒程度
- 品質への影響: ⚠️ 長文ページの情報が不完全

---

#### ケース2: `searchLanceDB`が30秒以上かかっている場合

**対策A: 並列初期化のタイムアウト**

`src/lib/lancedb-search-client.ts`:

```typescript
const INIT_TIMEOUT = 10000; // 10秒

const vectorPromise = Promise.race([
  getEmbeddings(params.query),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Embedding timeout')), INIT_TIMEOUT)
  )
]);
```

**対策B: Lunr初期化のスキップ**

```typescript
// 緊急回避: BM25検索を一時的に無効化
useLunrIndex: false
```

---

### ステップ5: 根本対策の実施【ボトルネック特定後】

#### 根本対策1: LanceDB接続の最適化

```typescript
// コネクションプーリング
// クエリキャッシュの強化
```

#### 根本対策2: チャンク取得クエリの最適化

```typescript
// WHERE句のインデックス活用
// バッチクエリの実装
```

#### 根本対策3: リージョン最適化

```
Cloud Storage: US-CENTRAL1 → asia-northeast1
App Hosting: us-central1 → asia-northeast1
期待される改善: 100-150ms削減
```

---

## 🎯 期待される改善シナリオ

### シナリオA: タイムアウト設定（保守的）

```
検索時間: 96.5秒 → 60秒（38%削減）
総処理時間: 110.8秒 → 74秒（33%削減）
```

### シナリオB: バッチサイズ制限（現実的）

```
検索時間: 96.5秒 → 30秒（69%削減）
総処理時間: 110.8秒 → 44秒（60%削減）
```

### シナリオC: 根本対策（理想）

```
検索時間: 96.5秒 → 8秒（92%削減）
総処理時間: 110.8秒 → 22秒（80%削減）
```

---

## 📊 Cloud Logging確認チェックリスト

デプロイ完了後、以下を順番に確認：

- [ ] **ステップ1**: Firebase Consoleでビルド成功を確認
- [ ] **ステップ2**: 本番環境でテストクエリを実行
- [ ] **ステップ3**: Cloud Loggingで「データチェック結果」を確認
- [ ] **ステップ4**: Cloud Loggingで「searchLanceDB duration」を確認
- [ ] **ステップ5**: Cloud Loggingで「enrichWithAllChunks duration」を確認
- [ ] **ステップ6**: Cloud Loggingで「Chunk retrieval took」を確認
- [ ] **ステップ7**: ボトルネックを特定
- [ ] **ステップ8**: 適切な対策を実施

---

## 🔍 Cloud Logging クエリ集

### クエリ1: データ存在確認

```
resource.type="cloud_run_revision"
resource.labels.service_name="confluence-chat"
textPayload=~"データチェック結果"
timestamp>="2025-10-20T00:00:00Z"
```

### クエリ2: 検索パフォーマンス全体

```
resource.type="cloud_run_revision"
resource.labels.service_name="confluence-chat"
textPayload=~"lancedbRetrieverTool.*duration"
timestamp>="2025-10-20T00:00:00Z"
```

### クエリ3: チャンク取得詳細

```
resource.type="cloud_run_revision"
resource.labels.service_name="confluence-chat"
textPayload=~"ChunkMerger.*Chunk retrieval took"
timestamp>="2025-10-20T00:00:00Z"
```

### クエリ4: Kuromoji初期化

```
resource.type="cloud_run_revision"
resource.labels.service_name="confluence-chat"
textPayload=~"JapaneseTokenizer|Kuromoji"
timestamp>="2025-10-20T00:00:00Z"
```

### クエリ5: 全てのERRORとWARNING

```
resource.type="cloud_run_revision"
resource.labels.service_name="confluence-chat"
(textPayload=~"ERROR|❌|⚠️|SLOW")
timestamp>="2025-10-20T00:00:00Z"
```

---

## 📈 想定される結果パターン

### パターン1: データが見つからない（最悪）

```
📊 [Instrumentation] データチェック結果:
   - LanceDB (.lancedb): ❌
   - Domain Knowledge (data/): ❌
   - Kuromoji Dict (node_modules): ❌
   - Kuromoji Dict (standalone): ❌
```

**対策**: `SKIP_DATA_DOWNLOAD`設定の見直し、ビルドスクリプトの確認

---

### パターン2: チャンク取得が遅い（最有力）

```
📊 [lancedbRetrieverTool] searchLanceDB duration: 5000ms (5.0s) ✅
📊 [lancedbRetrieverTool] enrichWithAllChunks duration: 90000ms (90.0s) ❌

[ChunkMerger] Page 1: Chunk retrieval took 8500ms for 41 chunks
[ChunkMerger] Page 2: Chunk retrieval took 7200ms for 35 chunks
...
```

**対策**: タイムアウト設定、バッチサイズ制限、クエリ最適化

---

### パターン3: 並列初期化が遅い

```
⚠️ [searchLanceDB] Slow embedding generation: 25000ms (25.0s)
⚠️ [searchLanceDB] Slow LanceDB connection: 5000ms (5.0s)
⚠️ [searchLanceDB] Slow parallel initialization: 30000ms (30.0s)
```

**対策**: Embeddingタイムアウト、接続プール化、Lunrスキップ

---

### パターン4: Kuromoji初期化失敗

```
❌ [JapaneseTokenizer] Failed to initialize kuromoji: ENOENT
```

**対策**: `next.config.ts`のコピー設定確認、辞書ファイルの存在確認

---

## 🛠️ トラブルシューティング

### 問題: ビルドが失敗する

**症状**:
```
Build failed: ENOENT: no such file or directory
```

**対策**:
1. `next.config.ts`のKuromojiコピー設定を確認
2. `copy-webpack-plugin`がインストールされているか確認
3. ビルドログで詳細エラーを確認

---

### 問題: デプロイは成功したが、ログが出力されない

**症状**:
- Cloud Loggingに新しいログが表示されない

**対策**:
1. 正しいリビジョンにトラフィックが流れているか確認
2. フィルター条件が正しいか確認
3. タイムスタンプ範囲を広げる

---

### 問題: 依然として検索が遅い

**症状**:
- 詳細ログを追加したのに96.5秒のまま

**暫定対策**:
1. チャンク取得のタイムアウトを即座に実装（5秒）
2. バッチサイズを3に制限
3. 最悪の場合、チャンク取得を一時的にスキップ

---

## 📝 次のアクション

1. **5-10分待機**: Firebase App Hostingのビルド完了を待つ
2. **テスト実行**: 本番環境で質問を送信
3. **Cloud Logging確認**: 上記のクエリで詳細ログを確認
4. **ボトルネック特定**: どこで96.5秒かかっているか特定
5. **対策実施**: 特定されたボトルネックに応じた対策を実施

---

**作成日**: 2025年10月20日  
**最終更新**: 2025年10月20日  
**緊急度**: 🚨 **最優先**  
**ステータス**: デプロイ中、Cloud Logging確認待ち

