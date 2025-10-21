# Lunr初期化パフォーマンス確認ガイド

**作成日**: 2025年10月20日  
**目的**: Lunr初期化がキャッシュされ、リクエストごとに再初期化されていないことを確認

---

## 📊 確認すべき内容

### 理想的な動作
- ✅ インスタンス起動時に**1回だけ**初期化
- ✅ 2回目以降のリクエストは**キャッシュを再利用**
- ✅ 複数のリクエストが同時に来ても**1回だけ初期化**（競合防止）

### 問題のある動作
- ❌ リクエストごとに初期化が実行される
- ❌ 同じインスタンスで複数回初期化される
- ❌ 競合状態で複数の初期化が並行実行される

---

## 🔍 確認方法1: Cloud Loggingでログを確認

### Step 1: デプロイ完了を待つ

```bash
# デプロイ状況を確認
https://console.firebase.google.com/project/confluence-copilot-ppjye/apphosting
```

### Step 2: 複数回テストリクエストを送る

本番環境で以下のテストを実施：

1. **1回目**: 質問「教室削除機能の仕様は？」
2. **30秒待機**
3. **2回目**: 質問「会員退会機能の仕様は？」
4. **30秒待機**
5. **3回目**: 質問「求人応募機能の仕様は？」

### Step 3: Cloud Loggingでログを確認

1. **Cloud Loggingを開く**:
   ```
   https://console.cloud.google.com/logs/query;query=resource.type%3D%22cloud_run_revision%22%0AtextPayload%3A%22LUNR_%22?project=confluence-copilot-ppjye
   ```

2. **フィルター条件**:
   ```
   resource.type="cloud_run_revision"
   textPayload:"LUNR_"
   timestamp>="2025-10-20T..."
   ```

3. **期待されるログパターン（正常）**:

```
[LUNR_INIT] 🆔 Instance started with ID: a1b2c3d4

// --- 1回目のリクエスト ---
[LUNR_CACHE_MISS] 🚀 Instance a1b2c3d4: Starting new Lunr initialization...
[LunrInitializer] Instance a1b2c3d4: ✅ Loaded Lunr from cache in 1500ms (count: 1)
[LUNR_INITIALIZED] ✅ Instance a1b2c3d4: Lunr index initialized successfully
   - Total time: 1500ms
   - Indexed documents: 2,500

// --- 2回目のリクエスト（同じインスタンス） ---
[LUNR_CACHE_HIT] ✅ Instance a1b2c3d4: Reusing existing Lunr index (count: 1)

// --- 3回目のリクエスト（同じインスタンス） ---
[LUNR_CACHE_HIT] ✅ Instance a1b2c3d4: Reusing existing Lunr index (count: 1)
```

4. **問題のあるログパターン（要対応）**:

```
// 同じインスタンスで複数回初期化されている
[LUNR_INIT] 🆔 Instance started with ID: a1b2c3d4

[LUNR_CACHE_MISS] 🚀 Instance a1b2c3d4: Starting new Lunr initialization...
[LUNR_INITIALIZED] ✅ Instance a1b2c3d4: ... 1500ms

[LUNR_CACHE_MISS] 🚀 Instance a1b2c3d4: Starting new Lunr initialization...  ← 問題！
[LUNR_INITIALIZED] ✅ Instance a1b2c3d4: ... 1480ms
```

---

## 📋 確認項目チェックリスト

### ✅ キャッシュが機能している

- [ ] `[LUNR_CACHE_HIT]` ログが2回目以降のリクエストで出力される
- [ ] 同じインスタンスIDで `[LUNR_CACHE_MISS]` が1回のみ
- [ ] 初期化時間が初回のみかかり、2回目以降は即座

### ✅ 競合状態が防止されている

- [ ] 複数の同時リクエストで `[LUNR_WAITING]` ログが出力される
- [ ] 同じインスタンスで並行初期化が発生していない

### ✅ パフォーマンスが正常

- [ ] 初回初期化時間が1-3秒程度
- [ ] 2回目以降は初期化時間がゼロ
- [ ] 検索時間に初期化時間が含まれていない

---

## 🔍 確認方法2: ログ分析スクリプト

Cloud Loggingのログをダウンロードして分析：

```bash
# ログをエクスポート
gcloud logging read "resource.type=cloud_run_revision AND textPayload:LUNR_" \
  --limit 100 \
  --format json \
  --project confluence-copilot-ppjye \
  > lunr-logs.json

# ログを分析（手動）
# - LUNR_INIT の数 = インスタンス数
# - LUNR_CACHE_MISS の数 = 初期化回数
# - LUNR_CACHE_HIT の数 = キャッシュヒット回数
```

### 期待される結果

```
インスタンス数: 2（minInstances: 2のため）
LUNR_CACHE_MISS: 2回（各インスタンス1回ずつ）
LUNR_CACHE_HIT: 多数（2回目以降のリクエスト）

比率: CACHE_HIT / (CACHE_HIT + CACHE_MISS) > 90%
```

---

## 🐛 トラブルシューティング

### 問題: 毎回LUNR_CACHE_MISSが出力される

**原因**: グローバル変数が保持されていない

**確認方法**:
```typescript
// lunr-initializer.ts
console.log('Global variable scope test:', typeof globalLunrInstance);
```

**対応**: 
- グローバル変数がモジュールのトップレベルで宣言されているか確認
- HMR（Hot Module Replacement）がリセットしていないか確認

### 問題: 同じインスタンスで複数回初期化される

**原因**: Promise保持が機能していない

**確認方法**:
```typescript
console.log('Initialization promise exists:', !!this.initializationPromise);
```

**対応**:
- Phase 5最適化が正しく実装されているか確認
- `initializationPromise` が null にリセットされていないか確認

### 問題: 初期化時間が常に1-3秒かかる

**原因**: ディスクキャッシュが機能していない

**確認方法**:
```bash
# ディスクキャッシュファイルの確認
ls -lh data/lunr-cache/
```

**対応**:
- ディスクキャッシュファイルが存在するか確認
- `loadFromCache()` が正しく動作しているか確認

---

## 📊 パフォーマンス指標

### 正常な場合

| 指標 | 1回目 | 2回目以降 |
|------|-------|----------|
| Lunr初期化時間 | 1-3秒 | **0ms** |
| キャッシュヒット率 | 0% | **100%** |
| インスタンスあたりの初期化回数 | 1回 | **1回** |

### 問題がある場合

| 指標 | 1回目 | 2回目以降 |
|------|-------|----------|
| Lunr初期化時間 | 1-3秒 | **1-3秒** ← 問題！ |
| キャッシュヒット率 | 0% | **0%** ← 問題！ |
| インスタンスあたりの初期化回数 | 1回 | **2回以上** ← 問題！ |

---

## 🔧 実施した最適化

### Phase 5最適化の内容

**ファイル**: `src/lib/lunr-initializer.ts`

1. **インスタンスID追跡**
   ```typescript
   const INSTANCE_ID = crypto.randomUUID().substring(0, 8);
   console.log(`[LUNR_INIT] 🆔 Instance started with ID: ${INSTANCE_ID}`);
   ```

2. **Promise保持による競合防止**
   ```typescript
   private initializationPromise: Promise<void> | null = null;
   
   if (this.status.isInitializing && this.initializationPromise) {
     console.log(`[LUNR_WAITING] ⏳ Instance ${INSTANCE_ID}: Waiting...`);
     return this.initializationPromise;
   }
   ```

3. **詳細なログ出力**
   ```typescript
   console.log(`[LUNR_CACHE_HIT] ✅ Instance ${INSTANCE_ID}: Reusing...`);
   console.log(`[LUNR_CACHE_MISS] 🚀 Instance ${INSTANCE_ID}: Starting...`);
   console.log(`[LUNR_INITIALIZED] ✅ Instance ${INSTANCE_ID}: ...`);
   ```

4. **初期化回数の追跡**
   ```typescript
   initializationCount: number;  // ステータスに追加
   this.status.initializationCount++;
   ```

---

## 🎯 次のアクション

### デプロイ後の確認

1. **本番環境で3回テストリクエストを送る**
2. **Cloud Loggingで確認**:
   - インスタンスIDが表示されているか
   - CACHE_HITが2回目以降に出ているか
   - 同じインスタンスで複数回初期化されていないか

3. **パフォーマンス測定**:
   - 1回目: 初期化時間を記録
   - 2回目以降: 初期化時間がゼロか確認

---

## 📝 修正済みファイル

1. ✅ `src/lib/lunr-initializer.ts` - Phase 5最適化
   - インスタンスID追跡
   - Promise保持
   - 詳細ログ
   - 競合防止

---

## 🔗 関連ドキュメント

- [Phase 2パフォーマンス最適化ガイド](./phase2-performance-optimization-guide.md)
- [緊急対応ドキュメント](./production-performance-emergency-2025-10-20.md)
- [本番デプロイチェックリスト](./production-deployment-checklist.md)

---

**最終更新**: 2025年10月20日

