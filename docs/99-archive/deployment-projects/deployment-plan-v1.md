# Confluence仕様書要約チャットボット デプロイ計画書 v1.0

**作成日**: 2025-10-09  
**対象環境**: Firebase App Hosting (本番環境)  
**プロジェクト**: confluence-copilot-ppjye

---

## 📊 現状分析

### 1. アプリケーション構成

| 項目 | 現状 | デプロイ要件 |
|------|------|-------------|
| **フレームワーク** | Next.js 15.3.3 | SSR/API Routes対応 |
| **Node.js** | v20以上 | ランタイム互換性確認済み |
| **データベース** | LanceDB (ローカル) | ファイルシステム依存 ⚠️ |
| **認証** | Firebase Auth | 本番環境で設定済み |
| **ストレージ** | Firestore | 本番環境で設定済み |
| **AI** | Google Gemini 2.5 Flash | API Key必要 |

### 2. 重要な依存データ

```
.lancedb/                          # ベクトル検索データベース (必須)
data/domain-knowledge-v2/          # ドメイン知識 (必須)
  ├── final-domain-knowledge-v2.json
  └── keyword-lists-v2.json
.cache/                            # Lunr検索インデックス (オプション)
  └── lunr-index.json
```

### 3. 最近の重要な変更

#### パフォーマンス最適化 (2025-10-09)
- ✅ **検索キャッシュ**: グローバルキャッシュで91.6%高速化
- ✅ **エンベディングキャッシュ**: 重複計算を回避
- ✅ **サーバー起動最適化**: 5ms以下の起動時間
- ✅ **Webpack永続キャッシュ**: 開発サーバー高速化

#### UI改善
- ✅ **管理ダッシュボード**: パフォーマンス指標の詳細表示
- ✅ **サーバー起動時間**: ミリ秒単位で正確に表示

---

## 🎯 デプロイ目標

### Phase 1: 初期デプロイ（今回）

1. **動作確認**: 基本機能が本番環境で動作すること
2. **パフォーマンス**: 開発環境と同等のレスポンス速度
3. **データ整合性**: LanceDBデータが正常に機能すること

### Phase 2: 最適化（次回以降）

1. **Cloud Storage移行**: LanceDBデータの永続化
2. **スケーリング**: `maxInstances`の調整
3. **監視**: ログとメトリクスの収集

---

## 🚨 重大なリスクと対策

### Risk 1: LanceDBの一時性 ⚠️⚠️⚠️

**問題**: LanceDBはローカルファイルシステムに依存。Firebase App Hostingでは一時的なストレージとして動作し、インスタンス再起動時にデータが消失する。

**影響度**: 🔴 **極めて高い**

**対策**:

#### 短期的対策（今回のデプロイ前に実施）

```bash
# 1. LanceDBデータのバックアップを取得
cp -r .lancedb .lancedb.backup

# 2. Confluenceから最新データを再同期
npm run sync:confluence:batch

# 3. バックアップをGitリポジトリに含める（一時的）
# Note: .gitignoreから.lancedbを一時的に除外
```

#### 中期的対策（デプロイ後1週間以内）

- Cloud Storageへの移行スクリプト実装
- 起動時のCloud Storageからのデータダウンロード
- 定期的なCloud Storageへのバックアップ

---

### Risk 2: 環境変数の未設定 ⚠️⚠️

**問題**: 本番環境に必要な環境変数が設定されていない可能性

**影響度**: 🔴 **高い**

**必須環境変数チェックリスト**:

```bash
# Firebase関連
✅ NEXT_PUBLIC_FIREBASE_API_KEY
✅ NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
✅ NEXT_PUBLIC_FIREBASE_PROJECT_ID
✅ NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
✅ NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
✅ NEXT_PUBLIC_FIREBASE_APP_ID

# Google AI
⚠️ GEMINI_API_KEY または GOOGLE_API_KEY

# Confluence (バックグラウンド同期用)
⚠️ CONFLUENCE_BASE_URL
⚠️ CONFLUENCE_USER_EMAIL
⚠️ CONFLUENCE_API_TOKEN
⚠️ CONFLUENCE_SPACE_KEY

# サーバーサイド
⚠️ GOOGLE_APPLICATION_CREDENTIALS (サービスアカウントキー)
```

**対策**: デプロイ前にFirebase Consoleで全環境変数を設定

---

### Risk 3: メモリ不足 ⚠️

**問題**: 埋め込みモデル（@xenova/transformers）が大量のメモリを使用

**影響度**: 🟡 **中程度**

**対策**:
- `apphosting.yaml`で`maxInstances: 1`を維持（初期デプロイ）
- メモリ使用量を監視
- 必要に応じて`memoryMiB`を増やす

---

## 📝 デプロイ手順

### Pre-Deployment Checklist

#### 1. コードの確認

```bash
# Lintエラーの確認
npm run lint

# TypeScriptの型チェック
npm run typecheck

# ビルドテスト
npm run build
```

#### 2. データの準備

```bash
# LanceDBデータの存在確認
ls -la .lancedb/
# confluence.lance ファイルが存在すること

# ドメイン知識の存在確認
ls -la data/domain-knowledge-v2/
# final-domain-knowledge-v2.json
# keyword-lists-v2.json

# Lunrインデックスの存在確認（オプション）
ls -la .cache/
# lunr-index.json
```

#### 3. 環境変数の設定

**Firebase Consoleでの設定手順**:

1. [Firebase Console](https://console.firebase.google.com/) を開く
2. プロジェクト `confluence-copilot-ppjye` を選択
3. **App Hosting** → 対象のバックエンド → **設定**
4. **環境変数** セクションで以下を設定:

```
GEMINI_API_KEY=<your_gemini_api_key>
GOOGLE_API_KEY=<your_google_api_key>
CONFLUENCE_BASE_URL=https://tomonokai.atlassian.net
CONFLUENCE_USER_EMAIL=<your_email>
CONFLUENCE_API_TOKEN=<your_token>
CONFLUENCE_SPACE_KEY=CLIENTTOMO
```

**サービスアカウントキーの設定**:

1. **App Hosting** → **シークレット** で新しいシークレットを追加
2. 名前: `FIREBASE_SERVICE_ACCOUNT`
3. 値: `keys/firebase-adminsdk-key.json` の内容をコピー

---

### Deployment Steps

#### Step 1: ビルドの実行

```bash
# クリーンビルド
rm -rf .next
npm run build
```

**期待される出力**:
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages
✓ Finalizing page optimization
```

#### Step 2: Firebase CLIの確認

```bash
# Firebase CLIのバージョン確認
firebase --version
# v13以上であること

# ログイン確認
firebase login

# プロジェクト確認
firebase projects:list
# confluence-copilot-ppjye が表示されること
```

#### Step 3: デプロイの実行

**オプション A: 全体デプロイ（推奨）**

```bash
# Firestore Rules, Indexes, Hostingを全てデプロイ
firebase deploy
```

**オプション B: Hostingのみ**

```bash
# Hostingのみデプロイ（高速）
firebase deploy --only hosting
```

**期待される出力**:
```
✔ Deploy complete!

Project Console: https://console.firebase.google.com/project/confluence-copilot-ppjye/overview
Hosting URL: https://confluence-copilot-ppjye.web.app
```

---

### Post-Deployment Verification

#### 1. 基本動作確認

1. **アクセステスト**
   ```
   https://confluence-copilot-ppjye.web.app
   ```
   - ページが正常に表示されること
   - ログインページが表示されること

2. **認証テスト**
   - Google認証でログインできること
   - ログイン後、チャットページが表示されること

3. **検索機能テスト**
   - 質問を投稿できること
   - 検索結果が返ってくること（8件程度）
   - AI回答が生成されること

4. **管理ダッシュボードテスト**
   - 管理者アカウントでログイン
   - 投稿ログが表示されること
   - パフォーマンス指標が正しく表示されること

#### 2. パフォーマンス確認

**期待値**:
- サーバー起動時間: < 100ms
- 検索時間（初回）: < 10秒
- 検索時間（キャッシュヒット）: < 1秒
- AI生成時間: 10-15秒
- 総処理時間: < 30秒

**確認方法**:
1. 管理ダッシュボードの投稿ログ詳細を開く
2. パフォーマンス指標を確認
3. 2回同じ質問を投稿してキャッシュ効果を確認

#### 3. エラーログ確認

```bash
# Firebase App Hostingのログを確認
firebase functions:log

# または Firebase Console → App Hosting → ログ
```

**確認事項**:
- エラーログがないこと
- 警告ログが許容範囲内であること

---

## 🔧 トラブルシューティング

### Issue 1: "Table 'confluence' not found"

**原因**: LanceDBデータが本番環境にアップロードされていない

**解決策**:
1. `.gitignore`を確認し、`.lancedb`が除外されていないことを確認
2. 以下を実行してリポジトリに含める:
   ```bash
   git add -f .lancedb/
   git commit -m "chore: add LanceDB data for deployment"
   git push
   ```
3. 再デプロイ: `firebase deploy`

### Issue 2: "Cannot find module 'data/domain-knowledge-v2/keyword-lists-v2.json'"

**原因**: ドメイン知識ファイルが本番環境にアップロードされていない

**解決策**:
1. `data/`ディレクトリがGitリポジトリに含まれていることを確認
2. 以下を実行:
   ```bash
   git add -f data/domain-knowledge-v2/
   git commit -m "chore: add domain knowledge data"
   git push
   ```
3. 再デプロイ

### Issue 3: 環境変数エラー

**症状**: `GEMINI_API_KEY is not defined`

**解決策**:
1. Firebase Console → App Hosting → 環境変数を確認
2. 不足している環境変数を追加
3. 環境変数を変更した場合は再デプロイが必要

### Issue 4: メモリ不足

**症状**: "JavaScript heap out of memory"

**解決策**:
1. `setup/apphosting.yaml`を編集:
   ```yaml
   runConfig:
     maxInstances: 1
     memoryMiB: 2048  # デフォルトは512MiB
   ```
2. 再デプロイ

---

## 📈 デプロイ後のモニタリング

### 1. 最初の24時間

**チェック項目**:
- [ ] 1時間ごとにアプリケーションにアクセスし、動作確認
- [ ] エラーログの監視
- [ ] メモリ使用量の監視
- [ ] レスポンス時間の監視

### 2. 最初の1週間

**チェック項目**:
- [ ] ユーザーフィードバックの収集
- [ ] パフォーマンスメトリクスの分析
- [ ] データベースサイズの監視
- [ ] Cloud Storage移行の検討

---

## 🚀 次のステップ（Phase 2）

### 1. Cloud Storage移行（優先度: 🔴 高）

**実施時期**: デプロイ後1週間以内

**タスク**:
1. Cloud Storageバケットの作成
2. 移行スクリプトの実装（`docs/operations/deployment-guide.md`参照）
3. 起動時のデータダウンロード処理の実装
4. 定期的なバックアップの設定

### 2. スケーリング設定（優先度: 🟡 中）

**実施時期**: ユーザー数増加に応じて

**タスク**:
1. `maxInstances`の増加
2. ロードバランシングの設定
3. キャッシュ戦略の最適化

### 3. 監視とアラート（優先度: 🟡 中）

**実施時期**: デプロイ後2週間以内

**タスク**:
1. Cloud Loggingの設定
2. エラーアラートの設定
3. パフォーマンスダッシュボードの作成

---

## ✅ デプロイ承認

### 承認者チェックリスト

- [ ] Pre-Deployment Checklistの全項目が完了
- [ ] 環境変数が正しく設定されている
- [ ] データファイルが準備されている
- [ ] ビルドが成功している
- [ ] リスク対策が理解されている

### デプロイ実施

**実施日時**: _______________________  
**実施者**: _______________________  
**承認者**: _______________________

---

## 📞 連絡先

**技術サポート**:
- Firebase Support: https://firebase.google.com/support
- GitHub Issues: https://github.com/gucchon001/Confluence_firebase/issues

**プロジェクトドキュメント**:
- デプロイガイド: `docs/operations/deployment-guide.md`
- アーキテクチャ: `docs/architecture/`
- テストガイド: `docs/test-execution-guide.md`

