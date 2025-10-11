# Operations ドキュメント

**最終更新**: 2025年10月11日

Confluence Copilot の運用に関する**現行有効な**ドキュメントです。

---

## 📚 ドキュメント一覧

### 🔄 同期・データ管理

#### [data-synchronization-strategy.md](./data-synchronization-strategy.md) ⭐ **必読**
データ同期戦略と定期実行スケジュール
- データソースの更新頻度と管理戦略
- Firebase Functionsによる自動同期
- 定期実行スケジュール（日次・週次）
- トラブルシューティング

#### [firebase-scheduled-sync-setup.md](./firebase-scheduled-sync-setup.md)
Firebase Cloud Functionsによる自動同期セットアップ
- Secret Manager設定の詳細手順
- Cloud Functionsのデプロイ方法
- 監視・ログ確認方法

---

### 🚀 デプロイ・設定

#### [deployment-guide.md](./deployment-guide.md)
包括的デプロイガイド
- 環境変数設定
- データ準備手順
- デプロイ手順
- トラブルシューティング

#### [firebase-app-hosting-configuration.md](./firebase-app-hosting-configuration.md) ⭐ **必読**
Firebase App Hostingの正しい構成
- apphosting.yaml設定（動作確認済み）
- 環境変数の正しい設定方法
- 安定版情報（v1.0.0-stable）

#### [firebase-app-hosting-troubleshooting.md](./firebase-app-hosting-troubleshooting.md)
Firebase App Hostingトラブルシューティング
- よくあるエラーと解決方法
- ビルド失敗の対応
- チェックリスト

#### [required-environment-variables.md](./required-environment-variables.md)
必須環境変数一覧
- ビルド時/ランタイム別の環境変数
- Firebase Console設定方法
- 注意事項

---

### 🔧 運用・管理

#### [backup-management-guide.md](./backup-management-guide.md)
バックアップ管理ガイド
- 自動バックアップ（毎日午前2時）
- 手動バックアップ・復元手順
- コマンドラインツール

#### [migration-guide.md](./migration-guide.md)
リポジトリ移管ガイド
- 必要ファイルのチェックリスト
- クリーンアップ手順
- 移管先でのセットアップ

#### [network-sharing-guide.md](./network-sharing-guide.md)
ネットワーク共有ガイド
- ローカル開発環境の共有方法
- セットアップスクリプト
- トラブルシューティング

---

### 📊 監査レポート

#### [operations-docs-audit-report.md](./operations-docs-audit-report.md)
ドキュメント監査レポート
- 2025年10月11日実施
- 13ファイルの詳細監査
- アーカイブ推奨の判断基準

---

## 🚀 クイックスタート

### 初回デプロイ

1. **[deployment-guide.md](./deployment-guide.md)** - 包括的なデプロイ手順を確認
2. **[firebase-app-hosting-configuration.md](./firebase-app-hosting-configuration.md)** - 設定方法を確認
3. **[required-environment-variables.md](./required-environment-variables.md)** - 環境変数を設定

### データ同期の設定

1. **[data-synchronization-strategy.md](./data-synchronization-strategy.md)** - 同期戦略を理解
2. **[firebase-scheduled-sync-setup.md](./firebase-scheduled-sync-setup.md)** - 自動同期を設定

### トラブルシューティング

問題が発生した場合：
1. **[firebase-app-hosting-troubleshooting.md](./firebase-app-hosting-troubleshooting.md)** - よくあるエラーを確認
2. ログとメトリクスを確認
3. それでも解決しない場合は開発チームに連絡

---

## 🏷️ 安定版情報

**現在の安定版**: v1.0.0-stable  
**コミット**: a54662bf  
**リリース日**: 2025-10-10

### 安定版に戻す方法

```bash
git checkout v1.0.0-stable
git push origin main --force
```

---

## 🗄️ アーカイブ済みドキュメント

以下のドキュメントは完了したプロジェクトや古い情報のため、`docs/archive/` に移動されました：

### 非推奨 (`docs/archive/deprecated/`)
- `github-secrets-setup.md` - GitHub Actions削除により非推奨
- `automated-data-sync.md` - Firebase Functionsに統一

### デプロイプロジェクト (`docs/archive/deployment-projects/`)
- `deployment-plan-v1.md` - 完了したデプロイ計画 (2025-10-09)

詳細は [アーカイブREADME](../archive/README.md) を参照してください。

---

## 🔗 関連リンク

- [アーキテクチャドキュメント](../architecture/)
- [実装ガイド](../implementation/)
- [仕様書](../specifications/)
- [テストドキュメント](../testing/)
- [アーカイブ](../archive/)

