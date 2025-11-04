# Firestoreラベル統合 - ローカルテスト トラブルシューティング

**日付**: 2025年11月2日  
**問題**: Next.js静的ファイルの404エラー

## 🔍 問題の詳細

### エラー内容

```
GET http://localhost:9004/_next/static/css/app/layout.css?v=1762218807537 net::ERR_ABORTED 404 (Not Found)
GET http://localhost:9004/_next/static/chunks/main-app.js?v=1762218807537 net::ERR_ABORTED 404 (Not Found)
GET http://localhost:9004/_next/static/chunks/app-pages-internals.js net::ERR_ABORTED 404 (Not Found)
GET http://localhost:9004/_next/static/chunks/app/page.js net::ERR_ABORTED 404 (Not Found)
```

### 原因の可能性

1. **開発サーバーのビルドが完了していない**
   - Next.jsの開発サーバーが起動直後で、まだビルドが完了していない
   - 初回起動時はビルドに時間がかかる

2. **`.next`フォルダの問題**
   - `.next`フォルダが破損している
   - 古いビルドキャッシュが残っている

3. **ポートの競合**
   - 複数の開発サーバーが起動している
   - ポートが正しくバインドされていない

## 🔧 解決方法

### 方法1: 開発サーバーの再起動（推奨）

```bash
# 1. 開発サーバーを停止（Ctrl+C）
# 2. 開発サーバーを再起動
npm run dev
```

**確認ポイント**:
- 開発サーバーのログで「Ready」が表示されるまで待つ
- エラーメッセージがないことを確認

### 方法2: `.next`フォルダのクリーンアップ

```bash
# 1. 開発サーバーを停止
# 2. .nextフォルダを削除
Remove-Item -Recurse -Force .next
# または
rm -rf .next

# 3. 開発サーバーを再起動
npm run dev
```

### 方法3: 完全なクリーンビルド

```bash
# 1. 開発サーバーを停止
# 2. node_modulesと.nextを削除
Remove-Item -Recurse -Force .next
Remove-Item -Recurse -Force node_modules

# 3. 依存関係を再インストール
npm install

# 4. 開発サーバーを起動
npm run dev
```

## 📊 現在の状態

- **ポート**: 9004（LISTENING状態）
- **`.next`フォルダ**: 存在（20ファイル）
- **サーバー**: 再起動済み

## ✅ 次のステップ

1. **ブラウザで再アクセス**
   - `http://localhost:9004` にアクセス
   - ハードリロード（Ctrl+Shift+R または Cmd+Shift+R）

2. **開発サーバーのログを確認**
   - コンソールにエラーメッセージがないか確認
   - 「Ready」が表示されているか確認

3. **問題が続く場合**
   - `.next`フォルダを削除してクリーンビルドを実行
   - 開発サーバーのログを共有

## 🔗 関連ドキュメント

- [Firestoreラベル統合ローカルテストチェックリスト](./firestore-labels-integration-local-test-checklist.md)
- [Next.js 開発サーバーのトラブルシューティング](https://nextjs.org/docs/app/building-your-application/configuring/debugging)

