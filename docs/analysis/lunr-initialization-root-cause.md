# Lunr初期化が毎回必要になる根本原因分析

## 問題の概要

本番環境で、Lunrインデックスの初期化が毎回必要になり、35秒かかっている。

## 根本原因

### 1. **Cloud Runのインスタンス再起動時にメモリがクリアされる**

**問題**: Cloud Runは、インスタンスがスケールダウン（0にスケール）または再起動されると、メモリ上のデータがすべて失われます。

**影響**:
- Lunrインデックスはインメモリの検索エンジン
- サーバー再起動後は、メモリが空っぽ
- キャッシュファイルから読み込む必要がある

### 2. **キャッシュファイルの保存に失敗していた（BigIntエラー）**

**問題箇所**: `src/lib/lunr-search-client.ts` の `saveToDisk()`関数

**問題コード**:
```typescript
const jsonPayload = JSON.stringify(data, null, 0);  // ← BigIntエラーで失敗
```

**問題点**:
- `page_id`がBigIntの場合、`JSON.stringify()`がエラーを投げる
- キャッシュファイルの保存に失敗
- 次回起動時にキャッシュが存在しないため、再構築が必要

**修正済み**: BigIntをNumberに変換する処理を追加

### 3. **Cloud Runのローカルファイルシステムの制約**

**問題**: Cloud Runのローカルファイルシステム（`.next/standalone/.cache`）は、インスタンス終了と共に消えます。

**キャッシュパス**:
```typescript
const cacheDir = isCloudRun 
  ? path.join(process.cwd(), '.next', 'standalone', '.cache')  // ← インスタンス終了時に消える
  : path.join(process.cwd(), '.cache');
```

**影響**:
- インスタンスがスケールダウン（0にスケール）すると、キャッシュファイルが失われる
- 次回起動時（コールドスタート）は、キャッシュが存在しない
- 毎回再構築が必要になる

### 4. **起動時初期化のタイムアウトが長すぎる**

**問題箇所**: `src/lib/startup-optimizer.ts`

**問題コード**:
```typescript
// 初期化が完了するまで待つ（最大120秒）
await Promise.race([
  initializationPromise,
  new Promise<void>((resolve) => {
    setTimeout(() => {
      console.warn('[StartupOptimizer] ⚠️ Initialization timeout after 120s, continuing in background');
      resolve();
    }, 120000); // 120秒
  })
]);
```

**問題点**:
- 起動時に120秒待つが、初期化が完了する前にリクエストが来る可能性がある
- リクエストが来た時点で初期化が完了していない場合、ユーザーを待たせる

## データフロー

### 正常なケース（キャッシュあり）

```
1. サーバー起動
   ↓
2. StartupOptimizer: initializeStartupOptimizations()
   ↓
3. LunrInitializer: initializeAsync()
   ↓
4. loadFromCache(): キャッシュファイルから読み込み
   ↓ (MessagePack: ~700ms, JSON: ~110秒)
5. ✅ 初期化完了（メモリにロード済み）
   ↓
6. ユーザーリクエスト: 検索実行
   ↓
7. ✅ 即座に検索可能（0ms）
```

### 問題のあるケース（キャッシュなし）

```
1. サーバー起動（コールドスタート）
   ↓
2. StartupOptimizer: initializeStartupOptimizations()
   ↓
3. LunrInitializer: initializeAsync()
   ↓
4. loadFromCache(): キャッシュファイルが見つからない
   ↓
5. _performInitialization(): 再構築開始
   ↓
   - LanceDBから1233件のドキュメントを取得
   - トークン化処理（50件ずつバッチ処理）
   - Lunrインデックス構築
   ↓ (~35秒)
6. saveToDisk(): キャッシュファイルに保存
   ↓ (BigIntエラーで失敗していた)
7. ✅ 初期化完了（メモリにロード済み）
   ↓
8. ユーザーリクエスト: 検索実行
   ↓
9. ❌ 初期化が完了していない場合、ユーザーを待たせる（35秒）
```

## 根本的な解決策

### 1. **キャッシュファイルの外部永続化（推奨）**

**問題**: Cloud Runのローカルファイルシステムはインスタンス終了と共に消える

**解決策**: Google Cloud Storage (GCS) にキャッシュファイルを保存

**実装イメージ**:
```typescript
// キャッシュファイルをGCSに保存
const gcsCachePath = `gs://${bucketName}/lunr-index.msgpack`;
await uploadToGCS(msgpackPath, gcsCachePath);

// 起動時にGCSからダウンロード
const localCachePath = path.join(cacheDir, 'lunr-index.msgpack');
await downloadFromGCS(gcsCachePath, localCachePath);
```

**効果**:
- インスタンス終了後もキャッシュが保持される
- コールドスタート時もキャッシュから読み込める
- 再構築時間: 35秒 → 数秒（ダウンロード時間のみ）

### 2. **起動時初期化の非同期化（実装済み）**

**修正内容**: 
- 起動時に初期化を開始するが、完了を待たない
- リクエストが来た時点で初期化が完了していない場合、500msでタイムアウト
- タイムアウト時はベクトル検索のみで返す

**効果**:
- ユーザーを待たせない
- バックグラウンドで初期化を継続
- 次回リクエストでBM25検索が利用可能

### 3. **BigIntエラーの修正（実装済み）**

**修正内容**:
- `saveToDisk()`でBigIntをNumberに変換
- キャッシュファイルの保存が成功するようになった

**効果**:
- キャッシュファイルが正しく保存される
- 次回起動時にキャッシュから読み込める（インスタンスが同じ場合）

## 現在の状況

### 修正済み
- ✅ BigIntエラーの修正（キャッシュ保存が成功する）
- ✅ 起動時初期化の非同期化（ユーザーを待たせない）
- ✅ 検索時のタイムアウトを500msに短縮

### 残っている問題
- ⚠️ Cloud Runのローカルファイルシステムの制約
  - インスタンスがスケールダウンするとキャッシュが失われる
  - コールドスタート時は毎回再構築が必要

### 推奨される改善
1. **GCSへのキャッシュ保存**: インスタンス終了後もキャッシュが保持される
2. **キャッシュの有効期限管理**: データ更新時にキャッシュを無効化
3. **複数インスタンス間でのキャッシュ共有**: GCSを使用して共有

## まとめ

**根本原因**:
1. Cloud Runのローカルファイルシステムはインスタンス終了と共に消える
2. BigIntエラーでキャッシュ保存に失敗していた（修正済み）
3. 起動時初期化が完了する前にリクエストが来る可能性がある（修正済み）

**現在の状態**:
- BigIntエラーは修正済み（キャッシュ保存が成功する）
- 検索時のタイムアウトを500msに短縮（ユーザーを待たせない）
- ただし、インスタンスがスケールダウンするとキャッシュが失われる

**今後の改善**:
- GCSへのキャッシュ保存を実装することで、コールドスタート時もキャッシュから読み込めるようになる

