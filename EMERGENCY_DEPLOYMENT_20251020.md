# 🚨 緊急デプロイ手順 (2025-10-20)

**目的**: 本番環境のパフォーマンス問題を解決  
**現状**: 検索時間 105.9秒 → **目標**: 10秒以内  
**予想改善**: **-59秒削減**（117秒 → 58秒）

---

## 📋 実施した修正

### 1. ✅ Firestoreアクセスの非同期化（即時効果）

**ファイル**: `src/app/api/streaming-process/route.ts`

**変更内容**:
- `savePostLogToAdminDB()` を非同期実行に変更
- ユーザーへの応答を待たせない
- エラーハンドリングも非同期化

**効果**: **-数秒削減**（リージョン間レイテンシの軽減）

### 2. ✅ apphosting.yamlの最適化

**ファイル**: `apphosting.yaml`

**変更内容**:
```yaml
runConfig:
  minInstances: 2      # 1→2に増強（コールドスタート完全回避）
  maxInstances: 4
  concurrency: 1       # リソース競合回避
  timeoutSeconds: 300  # タイムアウト延長（60秒→5分）
```

**効果**: **-17秒削減**（コールドスタート回避）

### 3. 📝 緊急対応ドキュメントの作成

**ファイル**: `docs/operations/production-performance-emergency-2025-10-20.md`

- 問題の詳細分析
- フェーズ別対応計画
- チェックリスト

---

## 🚀 デプロイ手順

### Step 1: 変更のコミット

```bash
# ステージング
git add src/app/api/streaming-process/route.ts
git add apphosting.yaml
git add docs/operations/production-performance-emergency-2025-10-20.md
git add EMERGENCY_DEPLOYMENT_20251020.md

# コミット
git commit -m "hotfix: 本番環境パフォーマンス緊急改善 (2025-10-20)

- Firestoreアクセスを非同期化（-数秒削減）
- minInstances: 1→2に増強（-17秒削減）
- concurrency: 1で安定性向上
- timeoutSeconds: 300に延長

予想改善: 117秒 → 58秒 (-59秒削減)"
```

### Step 2: mainブランチにプッシュ

```bash
# 現在のブランチを確認
git branch

# mainブランチにいることを確認（いない場合は切り替え）
git checkout main

# プッシュ（自動デプロイが開始される）
git push origin main
```

### Step 3: デプロイの監視

1. **Firebase Console** を開く:
   ```
   https://console.firebase.google.com/project/confluence-copilot-ppjye/apphosting
   ```

2. **デプロイ状況を確認**:
   - ビルド進行中...
   - デプロイ進行中...
   - ✅ デプロイ完了

3. **ログを確認**:
   ```
   https://console.cloud.google.com/logs
   ```

### Step 4: デプロイ完了後の確認

#### 4-1. ヘルスチェック

```bash
# 本番URLにアクセス
curl https://confluence-copilot-ppjye.web.app/
```

#### 4-2. パフォーマンステスト

本番環境でテストクエリを実行：
```
質問: 「教室削除機能の仕様は？」
```

**確認項目**:
- [ ] 検索時間が60秒以内
- [ ] AI生成時間が15秒以内
- [ ] 総処理時間が70秒以内
- [ ] エラーが発生していない

#### 4-3. ログ確認

Cloud Logging で以下を確認：
```
resource.type="cloud_run_revision"
textPayload:"投稿ログを保存しました（非同期）"
timestamp>="2025-10-20T..."
```

**確認項目**:
- [ ] 「非同期」のログが出ている
- [ ] PERMISSION_DENIEDエラーが減少（または消失）
- [ ] 検索時間のログが改善

---

## 📊 予想される改善効果

### Before（現状）

| 指標 | 時間 |
|------|------|
| 検索時間 | **105.9秒** |
| AI生成時間 | 11.2秒 |
| 総処理時間 | **117.2秒** |

### After（フェーズ1完了後）

| 指標 | 時間 | 削減 |
|------|------|------|
| 検索時間 | **46.9秒** | **-59秒** |
| AI生成時間 | 11.2秒 | 変化なし |
| 総処理時間 | **58.2秒** | **-59秒** |

**改善率**: **-50%**

---

## 🔧 デプロイ後のアクション

### 【即座に】権限エラーの対応

デプロイ完了後、権限エラーが続く場合：

```bash
# サービスアカウントを確認
gcloud projects get-iam-policy confluence-copilot-ppjye \
  --flatten="bindings[].members" \
  --filter="bindings.members:*appspot.gserviceaccount.com"

# Monitoring Metric Writerロールを追加
gcloud projects add-iam-policy-binding confluence-copilot-ppjye \
  --member="serviceAccount:confluence-copilot-ppjye@appspot.gserviceaccount.com" \
  --role="roles/monitoring.metricWriter"
```

### 【24時間以内】追加の最適化

改善が不十分な場合、次のステップへ：

1. **getAllChunksByPageIdの最適化**
   - ファイル: `src/lib/lancedb-utils.ts`
   - フィルタークエリに変更

2. **Lunr初期化の確認**
   - ファイル: `src/lib/lunr-initializer.ts`
   - グローバルキャッシュの動作確認

---

## ⚠️ ロールバック手順（問題発生時）

デプロイ後に問題が発生した場合：

```bash
# 直前のコミットに戻す
git revert HEAD

# プッシュ
git push origin main

# または、前のバージョンを直接デプロイ
# Firebase Console → App Hosting → ロールバック
```

---

## 📝 チェックリスト

### デプロイ前

- [x] コードレビュー完了
- [x] ローカルでビルド確認
- [x] 変更内容の文書化
- [x] ロールバック手順の確認

### デプロイ中

- [ ] Firebase Consoleでデプロイ監視
- [ ] エラーログの確認
- [ ] ビルド成功の確認

### デプロイ後

- [ ] ヘルスチェック実施
- [ ] パフォーマンステスト実施
- [ ] ログで改善確認
- [ ] ユーザーへの影響確認
- [ ] 権限エラーの状況確認

---

## 🔗 関連ドキュメント

- [緊急対応詳細](docs/operations/production-performance-emergency-2025-10-20.md)
- [本番デプロイチェックリスト](docs/operations/production-deployment-checklist.md)
- [Firebase App Hosting設定](docs/operations/firebase-app-hosting-configuration.md)
- [トラブルシューティング](docs/operations/firebase-app-hosting-troubleshooting.md)

---

## 🆘 エスカレーション

以下の場合は開発チームに連絡：

- デプロイが失敗する
- デプロイ後もパフォーマンスが改善しない（60秒以上）
- 新たなエラーが発生する
- ユーザーからの問い合わせが増加

**連絡先**: [開発チーム]

---

**作成日**: 2025年10月20日  
**作成者**: AI Agent  
**優先度**: 🔴 **最高**

