# 本番環境パフォーマンス緊急対応 (2025-10-20)

**ステータス**: 🔴 **対応中**  
**発生日時**: 2025年10月20日  
**影響**: 検索処理が117.2秒（目標: 10秒以内）

---

## 📊 現状の問題

### パフォーマンス指標（本番環境）

| 指標 | 測定値 | 目標値 | 差分 |
|------|--------|--------|------|
| サーバー起動時間 | 0ms | - | ✅ 正常 |
| 初期応答時間(TTFB) | 5ms | - | ✅ 正常 |
| **検索時間** | **105.9秒** | 1秒 | 🔴 **+104.9秒** |
| **AI生成時間** | **11.2秒** | 5秒 | 🟡 **+6.2秒** |
| **総処理時間** | **117.2秒** | 10秒 | 🔴 **+107.2秒** |
| 参照数 | 12件 | - | ✅ 正常 |

### ローカル環境との比較

| 環境 | 検索時間 | AI生成時間 | 総処理時間 |
|------|---------|-----------|-----------|
| **ローカル** | ~1秒 | ~5秒 | **~10秒** |
| **本番** | 105.9秒 | 11.2秒 | **117.2秒** |
| **差分** | +104.9秒 | +6.2秒 | **+107.2秒** |

---

## 🔍 根本原因分析

### 1. 権限エラー（モニタリング）: **-38秒削減見込み**

**問題**:
```
Error: 7 PERMISSION_DENIED: Permission monitoring.timeSeries.create denied
→ タイムアウトまで約38秒待機
```

**原因**:
- サービスアカウントにモニタリング指標作成者ロールが不足
- `instrumentation.js` がメトリクスをCloud Monitoringに送信しようとしてタイムアウト

**影響**: **38秒の遅延**

### 2. コールドスタート（Embedding モデル）: **-17秒削減見込み**

**問題**:
- Xenova Transformers（768次元モデル）の読み込みに17秒
- minInstances: 1 が設定されているが、効果が不十分

**原因**:
- モデルファイルがコンテナ内で毎回初期化される
- グローバルキャッシュが機能していない可能性

**影響**: **17秒の遅延**

### 3. リージョン間レイテンシ: **-数秒削減見込み**

**問題**:
```
App Hosting:  us-central1 (米国アイオワ州)
Firestore:    asia-northeast1 (東京)
→ 太平洋を横断する通信（RTT: 100-200ms）
```

**影響箇所**:
- 会話履歴の保存（Stream->>FS: 会話履歴保存）
- ログ記録（postLogsコレクション）
- ユーザー情報取得

**影響**: **数秒〜10秒の遅延**（同期呼び出し回数による）

### 4. LanceDB getAllChunksByPageId: **-30秒削減見込み**

**問題**:
- ログで30秒かかっていることを確認
- 非効率なファイルスキャンが原因

**原因**:
- LanceDBファイル全体をスキャンしている
- Cloud Runの仮想ファイルシステム上でのI/O性能問題

**影響**: **30秒の遅延**

---

## 🚀 緊急対応アクションプラン

### 【フェーズ1】即時対応（今すぐ実施）

#### ✅ 対応1-1: 権限エラーの解決（-38秒）

**作業内容**:
1. Firebase Console → IAM と管理 → IAM
2. サービスアカウントを検索:
   ```
   {PROJECT_ID}@appspot.gserviceaccount.com
   ```
3. ロールを追加:
   - `Monitoring Metric Writer` (roles/monitoring.metricWriter)

**確認コマンド**:
```bash
# サービスアカウントの確認
gcloud projects get-iam-policy confluence-copilot-ppjye \
  --flatten="bindings[].members" \
  --filter="bindings.members:*appspot.gserviceaccount.com"
```

**代替案**: モニタリングを一時的に無効化
```typescript
// instrumentation.js
// Cloud Monitoringへの送信を無効化（一時的）
if (process.env.DISABLE_CLOUD_MONITORING === 'true') {
  return; // モニタリング無効
}
```

#### ✅ 対応1-2: コールドスタート対策強化（-17秒）

**apphosting.yamlに追加**:
```yaml
runConfig:
  minInstances: 2  # 1 → 2に増やす（冗長性向上）
  maxInstances: 4
  
  # コンカレンシー設定を追加
  concurrency: 1   # 1インスタンスで1リクエスト処理（安定性優先）
  
  # タイムアウト延長
  timeoutSeconds: 300  # 5分（デフォルト60秒から延長）
```

**環境変数に追加**:
```yaml
env:
  # グローバルキャッシュを強制
  - variable: FORCE_GLOBAL_CACHE
    value: "true"
    availability:
      - RUNTIME
```

#### ✅ 対応1-3: Firestoreアクセスを非同期化（-数秒）

**修正対象**: `src/app/api/streaming-process/route.ts`

**修正箇所1**: 会話履歴保存を非同期化
```typescript
// 修正前
Stream->>FS: 会話履歴保存
await savePostLogToAdminDB(logData);

// 修正後（非同期実行）
savePostLogToAdminDB(logData).catch(error => {
  console.error('ログ保存エラー（非同期）:', error);
});
// 待たずに次の処理へ
```

**修正箇所2**: ユーザー情報取得を並列化
```typescript
// 既に並列化されているが、タイムアウトを追加
Promise.race([
  getUserInfo(),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('timeout')), 2000)
  )
]).catch(() => 'anonymous')
```

---

### 【フェーズ2】短期対応（24時間以内）

#### 🔧 対応2-1: LanceDB getAllChunksByPageId の最適化

**現在の実装**:
```typescript
// 非効率: ファイル全体をスキャン
async function getAllChunksByPageId(pageId: string) {
  const allRows = await table.toArray(); // 全データ読み込み
  return allRows.filter(row => row.pageId === pageId);
}
```

**最適化版**:
```typescript
// 効率的: インデックスを使用
async function getAllChunksByPageId(pageId: string) {
  return await table
    .search([0, 0, ..., 0]) // ダミーベクトル
    .filter(`pageId = '${pageId}'`)
    .limit(1000)
    .toArray();
}
```

**さらに最適化**: Firestoreにメタデータをキャッシュ
```typescript
// LanceDBの代わりにFirestoreから取得
const cachedMetadata = await firestoreClient
  .collection('pageMetadata')
  .doc(pageId)
  .get();
```

#### 🔧 対応2-2: Lunr初期化の確認

**確認項目**:
```typescript
// lunr-initializer.ts
let globalLunrInstance = null;

export async function initializeLunr() {
  if (globalLunrInstance) {
    console.log('✅ Lunr: キャッシュから再利用');
    return globalLunrInstance;
  }
  
  console.log('⏳ Lunr: 初期化開始...');
  const startTime = Date.now();
  globalLunrInstance = await buildLunrIndex();
  console.log(`✅ Lunr: 初期化完了 (${Date.now() - startTime}ms)`);
  
  return globalLunrInstance;
}
```

---

### 【フェーズ3】中期対応（1週間以内）

#### 🌍 対応3-1: リージョン統一の検討

**オプション1**: App Hostingを asia-northeast1 に移行
- **メリット**: Firestoreと同一リージョン、レイテンシ解消
- **デメリット**: 移行作業が必要
- **推奨**: ✅ **これを推奨**（ユーザーが日本のため）

**オプション2**: Firestoreを us-central1 に移行
- **メリット**: App Hostingと同一リージョン
- **デメリット**: 日本からのアクセスが遅くなる
- **推奨**: ❌ 非推奨

**実施手順** （オプション1）:
1. 新しいApp Hostingバックエンドを asia-northeast1 に作成
2. apphosting.yamlに region を追加:
   ```yaml
   region: asia-northeast1
   ```
3. データを同じリージョンのCloud Storageに配置
4. 段階的に切り替え

#### 🔧 対応3-2: Cloud StorageもリージョンAPIを統一

**現状**:
```
Cloud Storage: us-central1
Firestore:     asia-northeast1
App Hosting:   us-central1
```

**目標**:
```
Cloud Storage: asia-northeast1 ← 新規バケット作成
Firestore:     asia-northeast1
App Hosting:   asia-northeast1 ← 新規作成
```

---

## 📊 予想される改善効果

### フェーズ1完了後

| 項目 | 改善前 | 改善後 | 削減 |
|------|--------|--------|------|
| 権限エラー | 38秒 | 0秒 | **-38秒** |
| コールドスタート | 17秒 | 0秒 | **-17秒** |
| Firestoreレイテンシ | 5秒 | 1秒 | **-4秒** |
| **検索時間** | 105.9秒 | **46.9秒** | **-59秒** |
| **総処理時間** | 117.2秒 | **58.2秒** | **-59秒** |

### フェーズ2完了後

| 項目 | 改善前 | 改善後 | 削減 |
|------|--------|--------|------|
| getAllChunks最適化 | 30秒 | 1秒 | **-29秒** |
| **検索時間** | 46.9秒 | **17.9秒** | **-29秒** |
| **総処理時間** | 58.2秒 | **29.2秒** | **-29秒** |

### フェーズ3完了後（リージョン統一）

| 項目 | 改善前 | 改善後 | 削減 |
|------|--------|--------|------|
| リージョンレイテンシ | 10秒 | 0秒 | **-10秒** |
| **検索時間** | 17.9秒 | **7.9秒** | **-10秒** |
| **総処理時間** | 29.2秒 | **19.2秒** | **-10秒** |

### 🎯 最終目標

| 指標 | 現状 | 目標 | 達成率 |
|------|------|------|--------|
| 検索時間 | 105.9秒 | **1秒** | Phase 4以降 |
| AI生成時間 | 11.2秒 | **5秒** | Phase 2で達成可能 |
| 総処理時間 | 117.2秒 | **10秒** | Phase 4以降 |

---

## 🔧 実装チェックリスト

### フェーズ1（即時対応）

- [ ] **権限設定**
  - [ ] IAMでモニタリングロール追加
  - [ ] 再デプロイ実施
  - [ ] エラーログ確認

- [ ] **apphosting.yaml更新**
  - [ ] minInstances: 2 に変更
  - [ ] concurrency: 1 追加
  - [ ] timeoutSeconds: 300 追加
  - [ ] コミット & プッシュ

- [ ] **Firestoreアクセス非同期化**
  - [ ] streaming-process/route.ts 修正
  - [ ] 会話履歴保存を非同期化
  - [ ] ユーザー情報取得にタイムアウト追加
  - [ ] テスト実施

### フェーズ2（短期対応）

- [ ] **LanceDB最適化**
  - [ ] getAllChunksByPageId を書き換え
  - [ ] フィルタークエリに変更
  - [ ] パフォーマンステスト

- [ ] **Lunr初期化確認**
  - [ ] グローバルキャッシュの動作確認
  - [ ] ログ出力で確認

### フェーズ3（中期対応）

- [ ] **リージョン統一**
  - [ ] 新規App Hostingバックエンド作成（asia-northeast1）
  - [ ] Cloud Storageバケット作成（asia-northeast1）
  - [ ] データ移行
  - [ ] 段階的切り替え

---

## 📝 ログ・モニタリング

### 確認すべきログ

1. **Cloud Logging** (App Hosting):
   ```
   resource.type="cloud_run_revision"
   severity>=ERROR
   timestamp>="2025-10-20T00:00:00Z"
   ```

2. **パフォーマンスログ**:
   ```typescript
   console.log('🔍 検索時間:', searchTime);
   console.log('🤖 AI生成時間:', aiGenerationTime);
   console.log('⏱️ 総処理時間:', totalTime);
   ```

3. **権限エラー**:
   ```
   textPayload:"PERMISSION_DENIED"
   textPayload:"monitoring.timeSeries.create"
   ```

---

## 🔗 関連ドキュメント

- [Phase 0A-4緊急対応（前回）](../../archive/operations-legacy/phase-0a-4-96s-search-issue.md)
- [クラウドストレージリージョン分析](./cloud-storage-region-analysis.md)
- [本番デプロイチェックリスト](./production-deployment-checklist.md)
- [Firebase App Hosting設定](./firebase-app-hosting-configuration.md)

---

## 🚨 エスカレーション

以下の場合は開発チームにエスカレーション：
- フェーズ1完了後も60秒以上かかる場合
- 権限エラーが解決しない場合
- 新たな問題が発生した場合

---

**最終更新**: 2025年10月20日  
**担当**: AI Agent  
**ステータス**: 🔴 対応中

