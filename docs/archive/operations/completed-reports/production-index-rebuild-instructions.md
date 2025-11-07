# 本番環境インデックス再構築手順

**作成日**: 2025年11月5日  
**目的**: 「自動オファー」検索問題の修正後の本番環境対応

---

## 📋 対応手順

### ステップ1: コードデプロイの確認 ✅

コードは既にGitHubにpush済みです。Firebase App Hostingが自動的にデプロイを開始しています。

**Firebase Consoleで確認**:
```
https://console.firebase.google.com/project/confluence-copilot-ppjye/apphosting
```

**確認ポイント**:
- `confluence-chat`バックエンドの最新ビルドが開始されているか
- ビルドが成功しているか（約3-5分）

### ステップ2: Lunrインデックスの再構築（必須）⚠️

**重要**: 既存のLunrインデックスが古いトークン化方法で構築されている可能性があるため、**再構築が必須**です。

#### 方法A: アプリケーション再起動で自動再構築（推奨）

1. Firebase Consoleでアプリケーションを再起動
   - App Hosting → `confluence-chat` → 「再起動」ボタン
   
2. 再起動後、`LunrInitializer`が自動的にインデックスを再構築します
   - ログで確認: `[LunrInitializer] Building Lunr index...`

#### 方法B: キャッシュファイルを削除して再起動

1. Cloud Shellで実行:
```bash
# プロジェクトを設定
gcloud config set project confluence-copilot-ppjye

# Cloud Storageのキャッシュファイルを削除（オプション）
# 注意: アプリケーションが使用している可能性があるため、再起動前に実行
gsutil rm gs://confluence-copilot-data/.cache/lunr-index.* 2>/dev/null || true
```

2. アプリケーションを再起動

#### 方法C: スクリプトで明示的に再構築（開発環境で実行）

本番環境で直接実行できない場合、以下のスクリプトをローカルで実行して、結果をCloud Storageにアップロード:

```bash
# ローカルでLunrインデックスを再構築
npm run rebuild:lunr

# 生成されたファイルをCloud Storageにアップロード
gsutil cp .cache/lunr-index.msgpack gs://confluence-copilot-data/.cache/lunr-index.msgpack
gsutil cp .cache/lunr-index.json gs://confluence-copilot-data/.cache/lunr-index.json
```

**注意**: 本番環境のアプリケーションがCloud Storageから読み込む設定になっていることを確認してください。

### ステップ3: ベクトルインデックスの再構築（オプション・推奨）

ベクトルインデックスの再構築は必須ではありませんが、検索精度向上のため推奨されます。

**方法**: Firebase Console → App Hosting → バックエンド設定 → 環境変数で再構築をトリガー

または、以下のスクリプトをローカルで実行:

```bash
npm run lancedb:create-indexes
```

**注意**: 本番環境のLanceDBテーブルに対して直接実行する場合は、Cloud Shellまたは適切な権限を持つ環境で実行してください。

---

## ✅ 検証方法

### 1. 検索機能の確認

本番環境で以下のキーワードで検索を実行し、結果を確認:

- 「自動オファー」: 関連ドキュメントが検索結果に含まれるか
- 「パーソナルオファー」: 関連ドキュメントが検索結果に含まれるか
- 「教室コピー」: 関連ドキュメントが検索結果に含まれるか

### 2. ログの確認

Firebase Console → App Hosting → `confluence-chat` → ログで以下を確認:

```
[LunrInitializer] ✅ Index built in XXXms
[LunrSearchClient] Searching with tokenized query: '自動 オファー'
[BM25 Search] Found XX results
```

### 3. インデックスの状態確認

```bash
# Cloud Shellで実行
gcloud config set project confluence-copilot-ppjye

# キャッシュファイルの存在確認
gsutil ls gs://confluence-copilot-data/.cache/lunr-index.*
```

---

## 📝 注意事項

1. **ダウンタイム**: インデックス再構築中は検索機能が一時的に利用できない可能性があります
2. **再起動のタイミング**: トラフィックが少ない時間帯に実行することを推奨します
3. **バックアップ**: 既存のインデックスファイルをバックアップしておくことを推奨します

---

## 🔗 関連ドキュメント

- [自動オファー検索問題の原因分析](./../analysis/auto-offer-search-issue-root-cause.md)
- [Firebase App Hosting構成ガイド](./firebase-app-hosting-configuration.md)
- [デプロイガイド](./deployment-guide.md)

