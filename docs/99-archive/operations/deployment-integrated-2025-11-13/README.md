# 統合済みデプロイドキュメント

**統合日**: 2025-11-13  
**統合先**: [deployment-guide.md](../../operations/deployment-guide.md)

## 📋 概要

このディレクトリには、`deployment-guide.md`に統合されたデプロイ関連ドキュメントが保管されています。

## 📚 アーカイブされたドキュメント

### 1. `production-deployment-checklist.md`
- **説明**: 本番デプロイチェックリスト
- **統合先**: `deployment-guide.md` セクション5「デプロイ前チェックリスト」
- **統合内容**: デプロイ前の必須チェック項目、推奨チェック項目、よくあるミスと予防策

### 2. `production-schema-verification-guide.md`
- **説明**: 本番環境スキーマ確認ガイド
- **統合先**: `deployment-guide.md` セクション4「事前準備（データ & スキーマ）」、セクション7「デプロイ後の確認」
- **統合内容**: スキーマ検証方法、本番環境での検証手順

### 3. `production-deployment-after-db-rebuild.md`
- **説明**: データベース再構築後の本番環境デプロイ手順
- **統合先**: `deployment-guide.md` セクション6「デプロイフロー」
- **統合内容**: DB再構築後のデプロイ手順、データベースアップロード、インデックス再構築

### 4. `firebase-app-hosting-configuration.md`
- **説明**: Firebase App Hosting設定
- **統合先**: `deployment-guide.md` セクション3「Firebase App Hosting設定」
- **統合内容**: apphosting.yamlの構成、環境変数の設定、Secret Manager設定、認証ページの動的レンダリング

### 5. `firebase-app-hosting-troubleshooting.md`
- **説明**: Firebase App Hostingトラブルシューティング
- **統合先**: `deployment-guide.md` セクション9「トラブルシューティング」
- **統合内容**: Firebase App Hosting関連の問題と解決方法、デバッグ手順

### 6. `required-environment-variables.md`
- **説明**: 必須環境変数一覧
- **統合先**: `deployment-guide.md` セクション2「必須の環境変数」
- **統合内容**: ビルド時/ランタイム別の環境変数、Secret Manager設定

### 7. `build-optimization-guide.md`
- **説明**: ビルド最適化ガイド
- **統合先**: `deployment-guide.md` セクション3「Firebase App Hosting設定」、セクション6「デプロイフロー」
- **統合内容**: ビルド最適化設定、条件付きデータダウンロード、ビルド時間の短縮

## 📝 注意事項

- **最新の情報**: これらのドキュメントの内容は`deployment-guide.md`に統合されています
- **参照**: デプロイ関連の情報が必要な場合は、[deployment-guide.md](../../operations/deployment-guide.md)を参照してください
- **履歴**: これらのドキュメントは履歴目的で保持されています

## 🔗 関連リンク

- [deployment-guide.md](../../operations/deployment-guide.md) - 統合済みデプロイガイド
- [operations/README.md](../../operations/README.md) - Operationsドキュメント一覧

