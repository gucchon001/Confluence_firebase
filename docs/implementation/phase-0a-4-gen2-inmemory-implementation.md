# 🚀 Phase 0A-4: Cloud Run Gen2 + インメモリファイルシステム実装

**作成日**: 2025年10月20日  
**ステータス**: 🚧 実装完了、デプロイ待ち  
**優先度**: P0 (Critical)

---

## 📊 背景と問題

### 現在のパフォーマンス（build-002）
```
検索時間: 66.6秒
├─ searchLanceDB: 35.5秒 (53%)
└─ enrichWithAllChunks: 31.1秒 (47%) ← 最大のボトルネック
```

### 根本原因
**ディスクI/O遅延**: Cloud Run Gen1では、コンテナイメージ内のLanceDBファイルへのアクセスが低速なネットワーク経由になる

---

## 🎯 解決策：Cloud Run Gen2 + インメモリファイルシステム

### アーキテクチャ変更
```
Before (Gen1):
  コンテナイメージ内ファイル → ネットワークマウント → 低速I/O
  enrichWithAllChunks: 31秒

After (Gen2):
  /dev/shm (tmpfs) → メモリI/O → 超高速I/O
  enrichWithAllChunks: 1秒未満（予測）
```

---

## 🛠️ 実装内容

### 1. `apphosting.yaml`: Cloud Run Gen2への移行 ✅

```yaml
runConfig:
  minInstances: 1
  maxInstances: 4
  memoryMiB: 4096
  cpu: 2
  
  # Phase 0A-4: Gen2に移行
  executionEnvironment: gen2

env:
  # ビルド時のデータダウンロードをスキップ
  - variable: SKIP_DATA_DOWNLOAD
    value: "true"  # Gen2では実行時にメモリロード
    
  # インメモリファイルシステムを有効化
  - variable: USE_INMEMORY_FS
    value: "true"
    
  # Cloud Storage設定
  - variable: STORAGE_BUCKET
    value: confluence-firebase-c3a86.firebasestorage.app
```

**変更点**:
- `executionEnvironment: gen2` を追加
- `SKIP_DATA_DOWNLOAD: "true"` に変更（ビルド時間30分→5分に短縮）
- `USE_INMEMORY_FS: "true"` を追加

---

### 2. `instrumentation.js`: 起動時データロード ✅

```javascript
// Cloud Run Gen2環境検知
const isCloudRun = process.env.K_SERVICE !== undefined;
const useInMemoryFS = process.env.USE_INMEMORY_FS === 'true' && isCloudRun;

if (useInMemoryFS) {
  console.log('🔥 [Instrumentation] Cloud Run Gen2モード: インメモリファイルシステムを使用');
  
  // GCSからデータをダウンロードして /dev/shm にコピー
  const { loadDataToMemory } = await import('./src/lib/inmemory-data-loader.js');
  await loadDataToMemory();
  console.log('✅ [Instrumentation] データをメモリにロード完了');
}
```

**処理フロー**:
1. Cloud Run環境を検知（`K_SERVICE` 環境変数）
2. `USE_INMEMORY_FS=true` の場合、インメモリモードを有効化
3. GCSから `.lancedb` と `data/` をダウンロード
4. `/dev/shm/` にコピー（メモリ上のファイルシステム）

---

### 3. `src/lib/inmemory-data-loader.js`: メモリローダー ✅

**新規作成**: GCSからデータをダウンロードして `/dev/shm` にコピー

```javascript
async function loadDataToMemory() {
  const storage = new Storage();
  const bucket = storage.bucket(BUCKET_NAME);
  
  // 1. LanceDBファイルをダウンロード
  const [lancedbFiles] = await bucket.getFiles({ prefix: 'production-data/.lancedb' });
  for (const file of lancedbFiles) {
    const destPath = path.join('/dev/shm/.lancedb', fileName);
    await file.download({ destination: destPath });
  }
  
  // 2. ドメイン知識データをダウンロード
  const [dataFiles] = await bucket.getFiles({ prefix: 'production-data/data' });
  for (const file of dataFiles) {
    const destPath = path.join('/dev/shm/data', fileName);
    await file.download({ destination: destPath });
  }
}
```

**特徴**:
- GCS API（`@google-cloud/storage`）を使用
- ファイルサイズとダウンロード時間をロギング
- メモリ使用状況を確認（`free -m`）

---

### 4. `src/lib/optimized-lancedb-client.ts`: パス切り替え ✅

```typescript
private getDbPath(): string {
  const isCloudRun = process.env.K_SERVICE !== undefined;
  const useInMemoryFS = process.env.USE_INMEMORY_FS === 'true' && isCloudRun;
  
  if (useInMemoryFS) {
    console.log('🔥 [OptimizedLanceDBClient] Using in-memory file system: /dev/shm/.lancedb');
    return '/dev/shm/.lancedb';
  }
  
  return path.resolve(process.cwd(), '.lancedb');
}
```

**動作**:
- Cloud Run Gen2環境では `/dev/shm/.lancedb` を使用
- ローカル開発環境では `.lancedb` を使用（既存動作を維持）

---

## 📈 期待される改善効果

### パフォーマンス
```
Before (build-002): 66.6秒
├─ searchLanceDB: 35.5秒
└─ enrichWithAllChunks: 31.1秒

After (Gen2 + InMemory): 10秒以内（目標）
├─ searchLanceDB: 5-8秒（メモリI/Oによる高速化）
└─ enrichWithAllChunks: 0.5-1秒（メモリI/O）

改善率: -85%（66.6秒 → 10秒）
```

### ビルド時間
```
Before: 30分（データダウンロード含む）
After: 5分（データダウンロードスキップ）

改善率: -83%（30分 → 5分）
```

### コールドスタート
```
Before (Gen1): 0-2秒
After (Gen2): 5-15秒（GCSからダウンロード）

注意: minInstances: 1 により、コールドスタートは最小限
```

---

## 🎯 メリットとデメリット

### ✅ **メリット**
1. **爆発的な速度改善**
   - enrichWithAllChunks: 31秒 → 1秒未満
   - 検索全体: 66.6秒 → 10秒以内

2. **ビルド時間の大幅短縮**
   - 30分 → 5分（-83%）

3. **アーキテクチャ変更が小さい**
   - 環境変数とパス設定の変更のみ
   - アプリケーションロジックは変更不要

### ⚠️ **デメリットと注意点**
1. **メモリ消費**
   - LanceDBファイル: 約50MB
   - ドメイン知識: 約10MB
   - 合計: 約60MB（4GBメモリの1.5%）

2. **コールドスタート時間の増加**
   - +5-15秒（GCSダウンロード）
   - `minInstances: 1` で軽減

3. **データ更新の反映**
   - インスタンス再起動が必要
   - GitHub Actionsでの自動デプロイで対応

---

## 🚀 デプロイ手順

### 1. 変更のコミット＆プッシュ
```bash
git add -A
git commit -m "feat(phase-0a-4): Implement Cloud Run Gen2 + in-memory file system"
git push origin main
```

### 2. Firebase App Hostingでビルド待機
- 自動的にビルド開始
- ビルド時間: 約5分（従来の30分から大幅短縮）

### 3. デプロイ後の確認（Cloud Logging）

#### ✅ **成功ログ**
```
🔥 [Instrumentation] Cloud Run Gen2モード: インメモリファイルシステムを使用
📦 [InMemoryLoader] LanceDBファイルをダウンロード中...
   ✅ confluence.lance (50.99 MB)
✅ [InMemoryLoader] LanceDBダウンロード完了: XXXXms, 総サイズ: 50.99 MB
📦 [InMemoryLoader] ドメイン知識データをダウンロード中...
✅ [InMemoryLoader] ドメイン知識ダウンロード完了: XXXXms
🎉 [InMemoryLoader] 全データのメモリロード完了: XXXXms
🔥 [OptimizedLanceDBClient] Using in-memory file system: /dev/shm/.lancedb
```

#### ✅ **パフォーマンス改善確認**
```
📊 [lancedbRetrieverTool] searchLanceDB duration: ~5000ms (5s)
📊 [lancedbRetrieverTool] enrichWithAllChunks duration: ~500ms (0.5s)
📊 [lancedbRetrieverTool] TOTAL search duration: ~6000ms (6s)
```

#### ❌ **エラーログ（トラブルシューティング）**
```
❌ [InMemoryLoader] メモリロード失敗: [Error: ...]
⚠️  [Instrumentation] フォールバック: 通常のファイルシステムを使用します
```

---

## 🔍 検証項目

### 1. **コールドスタート時間**
- [ ] インスタンス起動ログで `loadDataToMemory` の実行時間を確認
- [ ] 目標: 5-15秒以内

### 2. **検索パフォーマンス**
- [ ] `searchLanceDB` の実行時間を確認
- [ ] `enrichWithAllChunks` の実行時間を確認
- [ ] 目標: 合計10秒以内

### 3. **メモリ使用量**
- [ ] Cloud Loggingで `free -m` の出力を確認
- [ ] 4GB中、約60MBがデータ用に使用されているか確認

### 4. **データ整合性**
- [ ] 検索結果が正常に返されるか確認
- [ ] AI回答が正常に生成されるか確認

---

## 🐛 トラブルシューティング

### **問題1: GCSからダウンロードできない**
```
❌ [InMemoryLoader] メモリロード失敗: [Error: Permission denied]
```

**解決策**:
- Firebase Admin SDKの権限を確認
- `STORAGE_BUCKET` 環境変数が正しいか確認

### **問題2: /dev/shm のメモリ不足**
```
❌ [InMemoryLoader] メモリロード失敗: [Error: No space left on device]
```

**解決策**:
- `memoryMiB` を 4096 → 8192 に増やす
- または、データサイズを削減

### **問題3: パフォーマンス改善が見られない**
```
📊 [lancedbRetrieverTool] enrichWithAllChunks duration: 30000ms
```

**原因**:
- インメモリモードが有効になっていない
- `USE_INMEMORY_FS` 環境変数を確認

---

## 📝 次のステップ

### **即時実行**
1. ✅ 変更をコミット＆プッシュ
2. 🔜 Firebase App Hostingでビルド＆デプロイ
3. 🔜 Cloud Loggingで動作確認
4. 🔜 パフォーマンス測定（検索時間）

### **短期（さらなる最適化）**
5. 🔜 タイムアウト設定を3秒に短縮（必要に応じて）
6. 🔜 `searchLanceDB` の35秒をさらに最適化
7. 🔜 並行処理の最適化（`pLimit`）

### **中長期（モニタリング）**
8. 🔜 Cloud Monitoringでメモリ使用量を監視
9. 🔜 コールドスタート時間の最適化（並行ダウンロード）
10. 🔜 データ更新の自動化（GitHub Actionsと連携）

---

**作成者**: AI Assistant  
**最終更新**: 2025年10月20日  
**参考**: ユーザー提案（Cloud Run Gen2 + インメモリFS）

