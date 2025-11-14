# Firebase App Hosting トラブルシューティングガイド

> ⚠️ **統合済み（2025-11-13）:** このドキュメントの内容は `deployment-guide.md` に統合されました。  
> **最新の情報**: [deployment-guide.md](./deployment-guide.md) を参照してください。  
> このドキュメントは履歴目的で保持されています。

**最終更新日**: 2025-10-10  
**対応バージョン**: v1.0.0-stable

## 🎯 このガイドについて

Firebase App Hostingのビルドやデプロイで発生する一般的な問題と解決方法をまとめています。

## 🔥 よくあるエラーと解決方法

### 1. `FirebaseError: Firebase: Error (auth/invalid-api-key)`

#### 症状
```
Error occurred prerendering page "/login"
FirebaseError: Firebase: Error (auth/invalid-api-key)
```

#### 原因
- `NEXT_PUBLIC_FIREBASE_API_KEY` 環境変数が設定されていない
- 環境変数の値が間違っている
- ビルド時に環境変数が利用可能になっていない

#### 解決方法

**1. apphosting.yaml の確認**
```yaml
env:
  - variable: NEXT_PUBLIC_FIREBASE_API_KEY
    value: AIzaSyAgaGihnyshajIN2YC7CdJR_H0bJMg_hkI
    availability:
      - BUILD      # ← これが重要
      - RUNTIME
```

**2. ビルドログの確認**
Firebase Consoleのビルドログで以下が表示されているか確認：
```
env:
- variable: NEXT_PUBLIC_FIREBASE_API_KEY
  value: AIzaSy...
```

表示されていない場合は、YAML構造が間違っています。

**3. 正しい構造に修正**
```yaml
runConfig:
  cpu: 1

env:              # ← runConfigと同じレベル
  - variable: NEXT_PUBLIC_FIREBASE_API_KEY
    value: your-api-key
    availability:
      - BUILD
      - RUNTIME
```

### 2. 環境変数が適用されない

#### 症状
- ビルドログに `FIREBASE_CONFIG` と `FIREBASE_WEBAPP_CONFIG` のみが表示される
- カスタム環境変数（`NEXT_PUBLIC_*`）が表示されない

#### 原因
`env:` が `runConfig:` の**内部にネスト**されている

#### 解決方法

**間違った構造（❌）:**
```yaml
runConfig:
  cpu: 1
  env:            # ← runConfigの内部（間違い）
    - variable: NAME
      value: VALUE
```

**正しい構造（✅）:**
```yaml
runConfig:
  cpu: 1

env:              # ← runConfigと同じレベル（正しい）
  - variable: NAME
    value: VALUE
```

### 3. シークレットが見つからない

#### 症状
- ビルドが失敗する
- 環境変数が一切表示されない
- シークレット参照エラー

#### 原因
`apphosting.yaml` でシークレットを参照しているが、Secret Manager にシークレットが存在しない

#### 解決方法

**1. シークレットの存在確認**
```bash
gcloud secrets list --project=confluence-copilot-ppjye
```

**2. シークレットの作成**
```powershell
# PowerShell
$env:GEMINI_API_KEY = "your-actual-key"
$env:CONFLUENCE_API_TOKEN = "your-actual-token"
.\scripts\setup-firebase-secrets.ps1
```

**3. apphosting.yaml の修正**

シークレットが作成されるまで、一時的にシークレット参照を削除：
```yaml
# シークレット作成前（一時的）
env:
  - variable: NEXT_PUBLIC_FIREBASE_API_KEY
    value: your-value    # 直接指定
    availability:
      - BUILD
      - RUNTIME
```

シークレット作成後：
```yaml
# シークレット作成後
env:
  - variable: GEMINI_API_KEY
    secret: gemini_api_key    # Secret Manager参照
    availability:
      - RUNTIME
```

### 4. `/login` ページのプリレンダリングエラー

#### 症状
```
Error occurred prerendering page "/login"
Export encountered an error on /login/page: /login
```

#### 原因
Next.js 15 で `/login` ページが静的生成されようとしているが、Firebase Auth が初期化されてエラーになる

#### 解決方法

**src/app/login/page.tsx に追加:**
```typescript
'use client';

// 静的生成を無効化
export const dynamic = 'force-dynamic';

// ... 残りのコード
```

**src/app/page.tsx にも追加:**
```typescript
'use client';

// 静的生成を無効化
export const dynamic = 'force-dynamic';

// ... 残りのコード
```

### 5. `apphosting.yaml` が認識されない

#### 症状
- ビルドログにカスタム設定が表示されない
- デフォルト設定でビルドされる

#### 原因
`apphosting.yaml` がプロジェクトルートに配置されていない

#### 解決方法

**1. ファイルの配置確認**
```bash
# プロジェクトルートに配置されているか確認
ls apphosting.yaml
```

**2. 配置されていない場合**
```bash
# setup/ から移動
cp setup/apphosting.yaml apphosting.yaml
git add apphosting.yaml
git commit -m "fix: move apphosting.yaml to project root"
git push
```

## 🔍 デバッグ手順

### ステップ1: ローカルビルドテスト

```powershell
# 環境変数を設定
$env:NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSyAgaGihnyshajIN2YC7CdJR_H0bJMg_hkI"
$env:NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="confluence-copilot-ppjye.firebaseapp.com"
$env:NEXT_PUBLIC_FIREBASE_PROJECT_ID="confluence-copilot-ppjye"
$env:NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="confluence-copilot-ppjye.firebasestorage.app"
$env:NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="122015916118"
$env:NEXT_PUBLIC_FIREBASE_APP_ID="1:122015916118:web:50d117434b1318f173dbf7"

# ビルド実行
npm run build
```

ローカルで成功すれば、環境変数は正しく設定されています。

### ステップ2: apphosting.yaml の構文チェック

```bash
# ファイルの存在確認
ls apphosting.yaml

# 構造確認（最初の30行）
Get-Content apphosting.yaml -Head 30

# env: が runConfig: と同じレベルにあることを確認
```

### ステップ3: Firebase CLI で設定確認

```bash
# ログイン状態確認
firebase login:list

# プロジェクト確認
firebase projects:list

# バックエンド確認
firebase apphosting:backends:list --project confluence-copilot-ppjye
```

### ステップ4: Secret Manager 確認

```bash
# シークレット一覧
gcloud secrets list --project=confluence-copilot-ppjye

# 期待されるシークレット:
# - gemini_api_key
# - confluence_api_token
# - firebase_service_account_key
```

### ステップ5: ビルドログの詳細確認

Firebase Console → App Hosting → `confluence-chat` → 最新ビルド → ログ

**確認ポイント:**
1. `env:` セクションが表示されているか
2. `NEXT_PUBLIC_*` 変数が表示されているか
3. エラーメッセージの詳細

## 🔄 問題が解決しない場合の対処

### 1. 安定版に戻す

```bash
# タグから安定版をチェックアウト
git checkout v1.0.0-stable

# 確認
git log --oneline -1

# プッシュ
git push origin main --force
```

**⚠️ 注意**: `--force` は他の開発者に影響を与える可能性があります。

### 2. クリーンビルド

```bash
# ローカルのビルドキャッシュをクリア
npm run clean
rm -rf .next

# node_modules を再インストール
rm -rf node_modules
npm ci

# 再ビルド
npm run build
```

### 3. Firebase Console で手動デプロイ

1. Firebase Console → App Hosting
2. `confluence-chat` バックエンドを選択
3. 「設定」→「ビルドをトリガー」
4. ブランチを選択して再ビルド

## 📞 サポート

### 公式ドキュメント
- [Firebase App Hosting](https://firebase.google.com/docs/app-hosting)
- [構成ガイド](https://firebase.google.com/docs/app-hosting/configure?hl=ja)
- [Next.js ドキュメント](https://nextjs.org/docs)

### コミュニティサポート
- [Firebase サポート](https://firebase.google.com/support)
- [Stack Overflow (firebase タグ)](https://stackoverflow.com/questions/tagged/firebase)
- [Next.js GitHub](https://github.com/vercel/next.js)

## 📋 チェックリスト

問題が発生したら、以下を順番に確認してください：

- [ ] `apphosting.yaml` がプロジェクトルートにある
- [ ] `env:` が `runConfig:` と同じレベル（トップレベル）にある
- [ ] `NEXT_PUBLIC_*` 変数の `availability` に `BUILD` が含まれている
- [ ] シークレットが Secret Manager に存在している
- [ ] 認証ページに `export const dynamic = 'force-dynamic'` が設定されている
- [ ] ローカルビルドが成功する
- [ ] 最新のコミットがプッシュされている

すべてチェックしても問題が解決しない場合は、安定版（v1.0.0-stable）に戻してください。

## 🏷️ 関連ドキュメント

- [Firebase App Hosting 構成ガイド](./firebase-app-hosting-configuration.md)
- [必須環境変数一覧](./required-environment-variables.md)

