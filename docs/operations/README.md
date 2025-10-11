# Operations ドキュメント

Confluence Copilot の運用に関するドキュメントです。

## 📚 目次

### 構成・設定
- [Firebase App Hosting 構成ガイド](./firebase-app-hosting-configuration.md) - App Hostingの正しい構成方法（**必読**）
- [必須環境変数一覧](./required-environment-variables.md) - 環境変数の完全なリスト
- [Confluence データの自動同期](./automated-data-sync.md) - 定期的なデータ更新フロー

### トラブルシューティング
- [Firebase App Hosting トラブルシューティング](./firebase-app-hosting-troubleshooting.md) - よくあるエラーと解決方法

## 🚀 クイックスタート

### 初回デプロイ

1. **apphosting.yaml の配置確認**
   ```bash
   ls apphosting.yaml  # プロジェクトルートに存在すること
   ```

2. **シークレットの作成**
   ```powershell
   $env:GEMINI_API_KEY = "your-actual-key"
   $env:CONFLUENCE_API_TOKEN = "your-actual-token"
   .\scripts\setup-firebase-secrets.ps1
   ```

3. **デプロイ**
   ```bash
   git push  # 自動的にビルドが開始される
   ```

### 問題が発生した場合

1. [トラブルシューティングガイド](./firebase-app-hosting-troubleshooting.md)を確認
2. チェックリストを実行
3. それでも解決しない場合は安定版に戻す

## 🏷️ 安定版情報

**現在の安定版**: v1.0.0-stable  
**コミット**: a54662bf  
**リリース日**: 2025-10-10

### 安定版に戻す方法

```bash
git checkout v1.0.0-stable
git push origin main --force
```

## 📖 詳細ドキュメント

各ドキュメントの詳細については、上記のリンクを参照してください。

## 🔗 関連リンク

- [アーキテクチャドキュメント](../architecture/)
- [実装ガイド](../implementation/)
- [テストドキュメント](../testing/)

