# ベクトル検索エラー原因仮説の分析と検証方法

**作成日**: 2025-11-02  
**目的**: ユーザー提案の仮説を分析し、検証方法を提案

## ユーザー提案の仮説

**「Cloud Runインスタンスの起動シーケンスと、データダウンロードのタイミングの不一致」**

### 仮説のシナリオ

1. Firebase App Hostingが新しいコードをデプロイ
2. Cloud Runが新しいインスタンスを起動
3. Node.jsアプリケーションが起動プロセスを開始
4. アプリケーションが非同期でCloud Storageから.lancedbファイルのダウンロードを開始
5. Cloud Runがヘルスチェック成功後、すぐにトラフィックを送り始める
6. ダウンロード完了前にベクトル検索リクエストが来る
7. `No vector column found` エラーが発生

## コードベースによる分析

### ❌ 仮説が誤りであることが判明

コードを確認した結果、**この仮説は実装と一致していません**：

#### 1. ビルド時にダウンロードされる（ただし条件付き）

```yaml:apphosting.yaml
- variable: SKIP_DATA_DOWNLOAD
  value: "false"
```

**現在の設定**: データは**ビルド時にダウンロード**される

```javascript:package.json
"prebuild": "node scripts/conditional-download.js",
```

```javascript:scripts/conditional-download.js
const lancedbPath = path.join(process.cwd(), '.lancedb');
const hasLocalCache = fs.existsSync(lancedbPath);
const shouldSkip = skipDownload || hasLocalCache;
```

**重要な点**: `conditional-download.js`は、既存の`.lancedb`キャッシュがある場合は**スキップ**します

**実行フロー**:
1. `prebuild`で`conditional-download.js`が実行される
2. ローカルに`.lancedb`が存在する場合はスキップ
3. 本番ビルド時は`.lancedb`が存在しないため、Cloud Storageからダウンロード
4. `.lancedb`ディレクトリがビルド時に作成される
5. **Dockerイメージに`.lancedb`が含まれる**（ただし条件次第）

#### 2. 実行時のダウンロードはGen2専用

```javascript:instrumentation.js
const useInMemoryFS = process.env.USE_INMEMORY_FS === 'true' && isCloudRun;

if (useInMemoryFS) {
  const { loadDataToMemory } = await import('./src/lib/inmemory-data-loader.js');
  await loadDataToMemory();
}
```

**現在の設定**: `USE_INMEMORY_FS=false`

**実行時のダウンロードは発生しない**

#### 3. データ存在確認は警告のみ

```javascript:instrumentation.js
if (!lancedbExists || !dataExists) {
  console.warn('⚠️  [Instrumentation] データが見つかりません！実行時にCloud Storageからダウンロードします...');
}
```

**これは単なる警告**で、実際にはダウンロード処理が実装されていません。

## 真の原因の可能性

### 仮説A: ビルド時のダウンロード失敗

**可能性**: 高い

**シナリオ**:
1. ビルド時に`conditional-download.js`が実行される
2. Cloud Storageへのアクセスが失敗（権限、ネットワーク）
3. `.lancedb`が不完全な状態でビルドされる
4. 実行時に不完全なデータで検索を試みる
5. スキーマが正しく読み込めない

**確認方法**:
Cloud Loggingでビルドログを確認:
```logql
resource.type="cloud_run_revision"
textPayload=~"Downloading.*lancedb"
timestamp>="2025-11-01T00:00:00Z"
```

### 仮説B: ビルド成果物へのコピー失敗

**可能性**: 中

**シナリオ**:
1. ビルド時に`.lancedb`がダウンロードされる
2. Next.jsのビルドプロセスで`.lancedb`が除外される
3. Dockerイメージに`.lancedb`が含まれない
4. 実行時に`.lancedb`が見つからない

**確認方法**:
ビルドログで`.lancedb`のコピー処理を確認

### 仮説C: Dockerイメージサイズ制限

**可能性**: 低

**シナリオ**:
1. `.lancedb`が大きすぎる（52ファイル、12.4MB）
2. Dockerイメージのサイズ制限に引っかかる
3. `.lancedb`が部分的にしか含まれない

**確認方法**:
Dockerイメージのサイズを確認

### 仮説D: 起動時初期化の競合状態

**可能性**: 中

**シナリオ**:
1. 起動時複数の初期化処理が並行実行される
2. `startup-optimizer.ts`が非同期で実行される
3. リクエストが初期化完了前に処理される
4. `.lancedb`の読み込みが競合する

**確認方法**:
Cloud Loggingで初期化ログの順序を確認

## 検証方法

### ステップ1: ビルドログの確認（最優先）

Cloud Loggingで以下を確認:

```logql
resource.type="cloud_run_revision"
textPayload=~"prebuild|Downloading|lancedb"
timestamp>="2025-11-01T00:00:00Z"
```

**確認ポイント**:
- `prebuild`スクリプトが実行されたか
- ダウンロードが成功したか
- ファイル数が52ファイル以上か
- エラーが出ていないか

### ステップ2: 実行時ログの確認

```logql
resource.type="cloud_run_revision"
resource.labels.service_name="confluence-chat"
textPayload=~"Instrumentation|データチェック結果"
timestamp>="2025-11-01T00:00:00Z"
```

**確認ポイント**:
- `.lancedb`が存在するか
- ファイル数が期待通りか
- 警告ログが出ていないか

### ステップ3: ベクトル検索エラーのタイミング確認

```logql
resource.type="cloud_run_revision"
resource.labels.service_name="confluence-chat"
textPayload=~"Vector Search.*Error"
timestamp>="2025-11-01T00:00:00Z"
```

**確認ポイント**:
- インスタンス起動直後か
- リクエスト処理時か
- 特定の条件下のみか

## 結論

ユーザー提案の仮説「実行時ダウンロードのタイミング問題」は、**現在のコード実装と一致しません**でした。

しかし、ユーザーの追加分析により、**ビルド成果物へのコピー失敗**が根本原因であることが確定しました。

### ✅ 根本原因が確定

**「Next.jsのstandaloneビルドで`.lancedb`が最終コンテナに含まれない」**

詳細は `docs/troubleshooting/root-cause-confirmed.md` を参照してください。

