# Firebase App Hosting 構成ガイド

**最終更新日**: 2025-10-10  
**安定版**: v1.0.0-stable  
**コミット**: a54662bf

## 📋 概要

このドキュメントは、Firebase App Hostingの正しい構成方法を記録しています。
この構成は動作確認済みで、将来の改修時の基準となります。

## 🏗️ 構成ファイル

### 1. apphosting.yaml（プロジェクトルート）

**重要**: `apphosting.yaml` は**プロジェクトルート**に配置する必要があります。

```yaml
# Settings to manage and configure a Firebase App Hosting backend.
# https://firebase.google.com/docs/app-hosting/configure

runConfig:
  minInstances: 0
  maxInstances: 2
  memoryMiB: 2048
  cpu: 1

# 環境変数（runConfigと同じレベル）
env:
  # Next.js Public環境変数（ビルド時とランタイム時に必要）
  - variable: NEXT_PUBLIC_FIREBASE_API_KEY
    value: AIzaSyAgaGihnyshajIN2YC7CdJR_H0bJMg_hkI
    availability:
      - BUILD
      - RUNTIME
  
  - variable: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    value: confluence-copilot-ppjye.firebaseapp.com
    availability:
      - BUILD
      - RUNTIME
  
  - variable: NEXT_PUBLIC_FIREBASE_PROJECT_ID
    value: confluence-copilot-ppjye
    availability:
      - BUILD
      - RUNTIME
  
  - variable: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    value: confluence-copilot-ppjye.firebasestorage.app
    availability:
      - BUILD
      - RUNTIME
  
  - variable: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
    value: "122015916118"
    availability:
      - BUILD
      - RUNTIME
  
  - variable: NEXT_PUBLIC_FIREBASE_APP_ID
    value: 1:122015916118:web:50d117434b1318f173dbf7
    availability:
      - BUILD
      - RUNTIME
  
  - variable: NEXT_PUBLIC_USE_MOCK_DATA
    value: "false"
    availability:
      - BUILD
      - RUNTIME
  
  # Confluence API（ランタイムのみ）
  - variable: CONFLUENCE_BASE_URL
    value: https://giginc.atlassian.net
    availability:
      - RUNTIME
  
  - variable: CONFLUENCE_USER_EMAIL
    value: kanri@jukust.jp
    availability:
      - RUNTIME
  
  - variable: CONFLUENCE_SPACE_KEY
    value: CLIENTTOMO
    availability:
      - RUNTIME
  
  # Google Cloud（ビルド時とランタイムの両方）
  - variable: GOOGLE_CLOUD_PROJECT
    value: confluence-copilot-ppjye
    availability:
      - BUILD
      - RUNTIME
  
  # その他（ランタイムのみ）
  - variable: EMBEDDINGS_PROVIDER
    value: local
    availability:
      - RUNTIME
  
  - variable: USE_LLM_EXPANSION
    value: "true"
    availability:
      - RUNTIME
```

### 2. 重要なYAML構造ルール

#### ✅ 正しい構造
```yaml
runConfig:
  cpu: 1
  memoryMiB: 2048

env:              # ← runConfigと同じレベル（トップレベル）
  - variable: NAME
    value: VALUE
```

#### ❌ 間違った構造
```yaml
runConfig:
  cpu: 1
  memoryMiB: 2048
  env:            # ← runConfigの内部（間違い）
    - variable: NAME
      value: VALUE
```

### 3. 環境変数の availability 設定

- **BUILD**: ビルド時に必要な環境変数
- **RUNTIME**: ランタイム（実行時）に必要な環境変数

#### Next.js の NEXT_PUBLIC_* 変数
```yaml
- variable: NEXT_PUBLIC_FIREBASE_API_KEY
  value: your-value
  availability:
    - BUILD      # ビルド時に必要（静的に埋め込まれる）
    - RUNTIME    # ランタイムでも必要（クライアントサイドで使用）
```

**重要**: `NEXT_PUBLIC_*` 変数は、クライアントサイドで使用されるため、`BUILD` と `RUNTIME` **両方**で利用可能にする必要があります。

#### シークレット参照
```yaml
- variable: GEMINI_API_KEY
  secret: gemini_api_key    # Secret Manager のシークレット名
  availability:
    - RUNTIME               # ランタイムのみ（ビルド時は不要）
```

**注意**: シークレットを参照する前に、Secret Manager にシークレットが存在している必要があります。

## 🔐 Secret Manager の設定

### 必要なシークレット一覧

| シークレット名 | 用途 | 作成スクリプト |
|--------------|------|--------------|
| `gemini_api_key` | Gemini API の認証 | `scripts/setup-firebase-secrets.ps1` |
| `confluence_api_token` | Confluence API の認証 | `scripts/setup-firebase-secrets.ps1` |
| `firebase_service_account_key` | Firebase Admin SDK | `scripts/setup-firebase-secrets.ps1` |

### シークレットの作成方法

#### PowerShell（Windows）
```powershell
# 環境変数を設定
$env:GEMINI_API_KEY = "your-actual-gemini-api-key"
$env:CONFLUENCE_API_TOKEN = "your-actual-confluence-token"

# スクリプトを実行
.\scripts\setup-firebase-secrets.ps1
```

#### Bash（Linux/Mac）
```bash
# 環境変数を設定
export GEMINI_API_KEY="your-actual-gemini-api-key"
export CONFLUENCE_API_TOKEN="your-actual-confluence-token"

# スクリプトを実行
./scripts/setup-firebase-secrets.sh
```

#### gcloud CLI（直接）
```bash
# Gemini API Key
echo "your-gemini-api-key" | gcloud secrets create gemini_api_key \
  --project=confluence-copilot-ppjye \
  --data-file=-

# Confluence API Token
echo "your-confluence-token" | gcloud secrets create confluence_api_token \
  --project=confluence-copilot-ppjye \
  --data-file=-
```

### シークレットの確認
```bash
gcloud secrets list --project=confluence-copilot-ppjye
```

## 🚀 デプロイフロー

### 1. 初回デプロイ

```bash
# 1. apphosting.yaml がプロジェクトルートにあることを確認
ls apphosting.yaml

# 2. コミット & プッシュ
git add apphosting.yaml
git commit -m "feat: add Firebase App Hosting configuration"
git push

# 3. Firebase Consoleで自動ビルドが開始される
```

### 2. シークレットを追加した再デプロイ

```bash
# 1. シークレットを作成
.\scripts\setup-firebase-secrets.ps1

# 2. apphosting.yaml にシークレット参照を追加
# （env セクションに追加）

# 3. コミット & プッシュ
git add apphosting.yaml
git commit -m "feat: add secrets to App Hosting configuration"
git push
```

## 🐛 トラブルシューティング

### エラー: `auth/invalid-api-key`

**原因**: `NEXT_PUBLIC_FIREBASE_API_KEY` が設定されていない、または間違っている

**解決方法**:
1. `apphosting.yaml` で `NEXT_PUBLIC_FIREBASE_API_KEY` が設定されているか確認
2. `availability` に `BUILD` が含まれているか確認
3. 値が正しいか確認

### エラー: 環境変数が適用されない

**原因**: `env:` が `runConfig:` の内部にネストされている

**解決方法**:
```yaml
# 正しい構造
runConfig:
  cpu: 1

env:              # ← runConfigと同じレベル
  - variable: NAME
```

### エラー: シークレットが見つからない

**原因**: Secret Manager にシークレットが作成されていない

**解決方法**:
```bash
# シークレットの存在を確認
gcloud secrets list --project=confluence-copilot-ppjye

# シークレットを作成
.\scripts\setup-firebase-secrets.ps1
```

### ビルドログで環境変数が表示されない

**原因**: `apphosting.yaml` の構造が間違っている

**確認方法**:
```bash
# ビルドログで以下が表示されるか確認
env:
- variable: NEXT_PUBLIC_FIREBASE_API_KEY
  value: ...
```

表示されない場合は、YAML構造を確認してください。

## 📦 認証ページの動的レンダリング

Next.js 15 では、クライアントコンポーネント（`'use client'`）でもビルド時に静的生成が試行されます。
Firebase Auth を使用するページでは、以下の設定が必要です：

```typescript
// src/app/login/page.tsx
'use client';

// 静的生成を無効化
export const dynamic = 'force-dynamic';

// ... 残りのコード
```

### 対象ページ
- `/login` - ログインページ
- `/` - メインページ（認証チェックあり）

## 🔍 動作確認

### ローカルビルド
```bash
# 環境変数を設定してビルド
$env:NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSyAgaGihnyshajIN2YC7CdJR_H0bJMg_hkI"
$env:NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="confluence-copilot-ppjye.firebaseapp.com"
$env:NEXT_PUBLIC_FIREBASE_PROJECT_ID="confluence-copilot-ppjye"
$env:NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="confluence-copilot-ppjye.firebasestorage.app"
$env:NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="122015916118"
$env:NEXT_PUBLIC_FIREBASE_APP_ID="1:122015916118:web:50d117434b1318f173dbf7"
npm run build
```

### プロダクションビルド
Firebase Console → App Hosting → `confluence-chat` → ビルド履歴を確認

## 📚 参考ドキュメント

- [Firebase App Hosting 構成ガイド](https://firebase.google.com/docs/app-hosting/configure?hl=ja)
- [シークレットパラメータ](https://firebase.google.com/docs/app-hosting/configure?hl=ja#secret-parameters)
- [Next.js 環境変数](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)

## 📌 注意事項

1. **apphosting.yaml はプロジェクトルートに配置**
2. **env: は runConfig: と同じレベル（トップレベル）**
3. **NEXT_PUBLIC_* 変数は BUILD と RUNTIME 両方で利用可能に**
4. **シークレットは使用前に Secret Manager に作成**
5. **認証ページは動的レンダリングを強制**

## 🏷️ バージョン履歴

### v1.0.0-stable (2025-10-10)
- 初回安定版リリース
- apphosting.yaml の正しい構成を確立
- 環境変数の適切な availability 設定
- 認証ページの動的レンダリング対応
- シークレット設定の自動化スクリプト

