# Phase 0A-4 本番デプロイ対応完了レポート

**作成日**: 2025年10月19日  
**ステータス**: ✅ 実装完了  
**対応内容**: 本番環境のパフォーマンス問題解析と対策実装

---

## 📋 実装した対策一覧

### 1. ✅ Kuromoji辞書ファイルの本番ビルド対応

**問題**: 
- 本番環境でKuromoji辞書ファイルが見つからない可能性

**対策**:
- `copy-webpack-plugin`を使用して、Kuromoji辞書を`.next/standalone`にコピー
- `next.config.ts`にwebpack設定を追加

**実装箇所**:
```typescript:next.config.ts
// Kuromoji辞書ファイルをビルドに含める（Phase 0A-4: 本番環境対応）
if (isServer) {
  config.plugins.push(
    new (require('copy-webpack-plugin'))({
      patterns: [
        {
          from: path.resolve(__dirname, 'node_modules/kuromoji/dict'),
          to: path.resolve(__dirname, '.next/standalone/node_modules/kuromoji/dict'),
          noErrorOnMissing: true,
        },
      ],
    })
  );
}
```

**検証結果**:
```
✅ .next/standalone/node_modules/kuromoji/dict に辞書ファイルが正しくコピーされていることを確認
   - base.dat.gz (3.9MB)
   - cc.dat.gz (1.7MB)
   - check.dat.gz (3.1MB)
   - tid.dat.gz (1.6MB)
   - tid_map.dat.gz (1.5MB)
```

---

### 2. ✅ Embedding APIのタイムアウト追加

**問題**: 
- Embedding生成が遅延した場合、無期限に待機してしまう

**対策**:
- 30秒のタイムアウトを追加
- 詳細なパフォーマンスログを追加（1秒以上で警告）

**実装箇所**:
```typescript:src/lib/embeddings.ts
// Phase 0A-4: タイムアウト処理を追加（30秒）
const EMBEDDING_TIMEOUT = 30000; // 30秒
const embedding = await Promise.race([
  getLocalEmbeddings(text),
  new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error(`Embedding generation timeout after ${EMBEDDING_TIMEOUT}ms`)), EMBEDDING_TIMEOUT)
  )
]);

const generationDuration = Date.now() - generationStartTime;
// Phase 0A-4: 遅い埋め込み生成を警告（1秒以上）
if (generationDuration > 1000) {
  console.warn(`⚠️ [Embedding] Slow generation: ${generationDuration}ms for text: ${text.substring(0, 100)}...`);
}
```

**期待される効果**:
- タイムアウト時の早期エラー検知（30秒以内）
- Embedding生成の遅延を詳細ログで可視化

---

### 3. ✅ 検索処理の詳細なパフォーマンスログ追加

**問題**: 
- 本番環境で145秒の検索時間が報告されたが、ボトルネックが不明

**対策**:
- 並列初期化の各処理（Embedding生成、キーワード抽出、LanceDB接続）に個別のタイミング計測を追加
- 各処理で閾値を超えた場合に警告ログを出力

**実装箇所**:
```typescript:src/lib/lancedb-search-client.ts
// Phase 0A-4: 各処理の詳細なタイミングを計測
const embeddingStartTime = Date.now();
const vectorPromise = getEmbeddings(params.query).then(v => {
  const embeddingDuration = Date.now() - embeddingStartTime;
  if (embeddingDuration > 5000) {
    console.warn(`⚠️ [searchLanceDB] Slow embedding generation: ${embeddingDuration}ms`);
  }
  return v;
});

const keywordStartTime = Date.now();
const keywordsPromise = (async () => {
  const kw = await unifiedKeywordExtractionService.extractKeywordsConfigured(params.query);
  const keywordDuration = Date.now() - keywordStartTime;
  if (keywordDuration > 2000) {
    console.warn(`⚠️ [searchLanceDB] Slow keyword extraction: ${keywordDuration}ms`);
  }
  return kw;
})();

const connectionStartTime = Date.now();
const connectionPromise = (async () => {
  const { optimizedLanceDBClient } = await import('./optimized-lancedb-client');
  const conn = await optimizedLanceDBClient.getConnection();
  const connectionDuration = Date.now() - connectionStartTime;
  if (connectionDuration > 2000) {
    console.warn(`⚠️ [searchLanceDB] Slow LanceDB connection: ${connectionDuration}ms`);
  }
  return conn;
})();
```

**警告ログの閾値**:

| 処理 | 警告閾値 | 期待値 |
|:---|:---|:---|
| Embedding生成 | 5秒以上 | 1-2秒 |
| キーワード抽出 | 2秒以上 | 0.5-1秒 |
| LanceDB接続 | 2秒以上 | 0.5-1秒 |
| 並列初期化全体 | 5秒以上 | 2-3秒 |

**期待される効果**:
- 145秒の検索時間の内訳が明確になる
- ボトルネックとなっている処理を特定可能

---

### 4. ✅ クライアント側デバッグログのクリーンアップ

**問題**: 
- `src/lib/firestore-data-mapper.ts`にデバッグログが残っていない（すでにクリーン）

**確認結果**:
- ✅ `convertFirestoreToPostLog`にconsole.logが含まれていないことを確認
- ✅ 不要なデバッグログは存在しない

---

## 🔍 Cloud Loggingでの確認方法

### ステップ1: Cloud Loggingにアクセス

```
https://console.cloud.google.com/logs/query?project=confluence-copilot-ppjye
```

### ステップ2: フィルタークエリ

以下のクエリで、パフォーマンス警告ログをフィルタリングできます：

```
resource.type="cloud_run_revision"
resource.labels.service_name="confluence-chat"
(textPayload=~"⚠️.*Slow" OR textPayload=~"timeout" OR severity>=WARNING)
```

### ステップ3: 確認すべきログメッセージ

| ログメッセージ | 意味 | 正常範囲 | 異常値 |
|:---|:---|:---|:---|
| `⚠️ [searchLanceDB] Slow parallel initialization` | 並列初期化の遅延 | <5秒 | ≥5秒 |
| `⚠️ [searchLanceDB] Slow embedding generation` | Embedding生成の遅延 | <5秒 | ≥5秒 |
| `⚠️ [searchLanceDB] Slow keyword extraction` | キーワード抽出の遅延 | <2秒 | ≥2秒 |
| `⚠️ [searchLanceDB] Slow LanceDB connection` | LanceDB接続の遅延 | <2秒 | ≥2秒 |
| `⚠️ [Embedding] Slow generation` | Embedding生成の遅延 | <1秒 | ≥1秒 |
| `Embedding generation timeout` | Embeddingタイムアウト | なし | あり（致命的） |

---

## 📊 本番環境での期待される改善

### Cold Start時の予想時間

| 処理 | 開発環境 | 本番環境（Cold Start） | 本番環境（Warm Start） |
|:---|:---|:---|:---|
| サーバー起動 | 0ms | 0ms | 0ms |
| TTFB | 8ms | 50-100ms | 8-20ms |
| 検索時間 | 8秒 | **10-15秒** | 8-10秒 |
| AI生成時間 | 19秒 | 20-25秒 | 19-22秒 |
| **合計** | 27秒 | **30-40秒** | 27-32秒 |

### Cold Startの内訳（推定）

- Kuromoji辞書読み込み: 2-3秒
- LunrインデックスCloud Storageロード: 1-2秒
- Embedding モデル初回ロード: 5-10秒 ⚠️
- LanceDB Cloud Storageダウンロード: 3-5秒
- **合計**: 約10-20秒の追加遅延

---

## 🚨 145秒問題の分析

### 可能性の高い原因

1. **Cold Start + CPU制限** (最有力)
   - Cloud RunのCPU: 1コアのみ
   - Embedding モデル（Xenova Transformers）の初回ロードが非常に遅い
   - HuggingFace CDNからのモデルダウンロードに時間がかかる

2. **ネットワークレイテンシ**
   - Cloud StorageからLanceDB（50MB）のダウンロードが遅い
   - HuggingFace CDNからEmbeddingモデルのダウンロードが遅い

3. **メモリ不足**
   - Embedding モデルのロードでメモリ不足になり、スワップが発生

### 対策の優先度

| 対策 | 期待される改善 | 優先度 | 実装難易度 |
|:---|:---|:---|:---|
| Cloud Run CPU増強（1→2コア） | 10-20秒削減 | ★★★ 高 | 低 |
| Embeddingモデル事前ロード | 5-10秒削減 | ★★★ 高 | 中 |
| LanceDB事前ダウンロード | 3-5秒削減 | ★★☆ 中 | 中 |
| Cloud Storage最適化 | 1-2秒削減 | ★☆☆ 低 | 低 |

---

## 🚀 次のステップ

### 1. Cloud Loggingでボトルネック特定

上記のクエリで本番環境のログを確認し、以下を特定：
- どの処理が145秒を消費しているか
- 警告ログが出ているか
- タイムアウトが発生しているか

### 2. ボトルネックに応じた対策実装

**Embedding生成が遅い場合**:
```yaml:apphosting.yaml
runConfig:
  cpu: 2  # 1 → 2 に増強
  memory: 2Gi  # 必要に応じてメモリも増強
```

**LanceDB接続が遅い場合**:
```typescript:instrumentation.js
export async function register() {
  // LanceDBを事前ダウンロード・初期化
  const { optimizedLanceDBClient } = await import('./src/lib/optimized-lancedb-client');
  await optimizedLanceDBClient.getConnection();
  console.log('✅ LanceDB pre-initialized');
}
```

### 3. 再デプロイとパフォーマンス検証

- 対策実装後、再度本番環境でテスト
- Cloud Loggingで改善効果を確認
- Admin Dashboardで検索時間を継続監視

---

## 📝 ビルド検証結果

```bash
npm run build
```

**結果**: ✅ ビルド成功

- TypeScriptエラー: なし
- Lintエラー: なし
- Kuromoji辞書コピー: 成功
- Webpackキャッシュ警告: あり（無視可能）

---

## 📚 関連ドキュメント

- [phase-0a-4-production-issue-analysis.md](../operations/phase-0a-4-production-issue-analysis.md) - 本番環境パフォーマンス問題の詳細分析
- [production-deployment-checklist.md](../operations/production-deployment-checklist.md) - 本番デプロイチェックリスト
- [phase-0a-4-completion-report.md](./phase-0a-4-completion-report.md) - Phase 0A-4完了レポート
- [firebase-app-hosting-troubleshooting.md](../operations/firebase-app-hosting-troubleshooting.md) - Firebase App Hostingトラブルシューティング

---

**作成者**: AI Assistant  
**最終更新**: 2025年10月19日  
**ステータス**: ✅ 実装完了、Cloud Logging確認待ち

