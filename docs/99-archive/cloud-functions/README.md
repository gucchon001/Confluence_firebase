# Cloud Functions アーカイブ

このディレクトリには、GitHub Actionsに移行したため不要になったCloud Functions関連ファイルを保存しています。

## ファイル一覧

### scheduled-sync-deprecated.ts
- **元の場所**: `functions/src/scheduled-sync.ts`
- **アーカイブ日**: 2025年1月13日
- **理由**: GitHub Actionsに完全移行したため不要
- **機能**: Firebase Cloud Functionsによる定期同期（使用されていない）

## 移行理由

Firebase Cloud Functionsには以下の制約があり、GitHub Actionsに移行しました：

1. **プロジェクトルートアクセス不可**: `functions/`ディレクトリ内のコードのみがデプロイされる
2. **スクリプト実行制限**: `npm run sync:confluence:differential`が実行できない
3. **ファイルシステム制限**: プロジェクト全体のファイルにアクセスできない

## 現在の代替手段

- **定期同期**: GitHub Actions（`.github/workflows/sync-confluence.yml`）
- **手動同期**: GitHub Actions UI またはローカル実行
- **Cloud Storage連携**: GitHub Actions内で実行

## 注意事項

これらのファイルは参考用に保存されています。削除しないでください。
