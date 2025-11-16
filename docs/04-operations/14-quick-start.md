# 🚀 クイックスタートガイド

## 他PCでLanceDB同期を実行する手順

### 1. 必要なファイルの準備
- `sensitive-files.zip` を解凍
- プロジェクトフォルダに配置

### 2. 依存関係のインストール
```bash
npm install
```

### 3. 同期の実行

#### 実行コマンド例:
```bash
# 軽量同期 (推奨)
npm run sync:confluence:differential

# 全ページ同期
npm run sync:confluence:batch

# パイプライン実行
npm run lightweight-pipeline
```

### 4. 実行後の確認
```bash
# データベース状態確認
npx tsx src/scripts/check-data-basic.ts

# 同期進捗確認
npx tsx src/scripts/check-sync-progress.ts
```

### 5. トラブルシューティング

#### 環境変数エラー
```bash
# .envファイルの確認
cat .env
```

#### Firebase認証エラー
```bash
# 認証ファイルの確認
ls -la keys/
```

#### 依存関係エラー
```bash
# 再インストール
rm -rf node_modules package-lock.json
npm install
```

## よく使用するコマンド

| コマンド | 説明 |
|---------|------|
| `npm run sync:confluence:differential` | 差分同期（推奨） |
| `npm run sync:confluence:batch` | 全ページ同期 |
| `npm run lightweight-pipeline` | 軽量パイプライン |
| `npx tsx src/scripts/check-data-basic.ts` | データベース確認 |
| `npx tsx src/scripts/check-sync-progress.ts` | 同期進捗確認 |

