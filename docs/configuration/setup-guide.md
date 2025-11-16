# LanceDB同期バッチプログラム実行ガイド

## 1. 前提条件

### 必要なソフトウェア
- Node.js (v18以上)
- npm または yarn
- Git

### 必要な環境変数ファイル
- `.env` (メイン設定)
- `.env.local` (ローカル設定)
- `keys/firebase-adminsdk-key.json` (Firebase認証情報)
- `config/domain-knowledge-config.json` (設定ファイル)

## 2. セットアップ手順

### Step 1: リポジトリのクローン
```bash
git clone <リポジトリURL>
cd Confluence_firebase
```

### Step 2: 依存関係のインストール
```bash
npm install
```

### Step 3: 機密情報ファイルの配置
`sensitive-files.zip`を解凍して以下のファイルを配置：

```
Confluence_firebase/
├── .env
├── .env.local
├── keys/
│   └── firebase-adminsdk-key.json
└── config/
    └── domain-knowledge-config.json
```

### Step 4: 環境変数の確認
```bash
# .envファイルが正しく配置されているか確認
cat .env
```

## 3. 同期バッチプログラムの実行方法

### 基本的な同期（全ページ）
```bash
npm run sync:confluence:batch
```

### 差分同期
```bash
npm run sync:confluence:differential
```

### 軽量パイプライン実行
```bash
npm run pipeline:lightweight
```

### 完全パイプライン実行
```bash
npm run pipeline:complete
```

## 4. 個別スクリプトの実行

### 直接実行（tsx使用）
```bash
# 統一Confluence同期（10ページ）
npx tsx src/scripts/unified-confluence-sync.ts

# バッチ同期（全ページ）
npx tsx src/scripts/batch-sync-confluence.ts

# 軽量パイプライン
npx tsx src/scripts/run-lightweight-pipeline.ts

# 完全パイプライン
npx tsx src/scripts/run-complete-pipeline.ts
```

## 5. トラブルシューティング

### よくある問題と解決方法

#### 1. 環境変数が読み込まれない
```bash
# .envファイルの存在確認
ls -la .env*

# 環境変数の確認
echo $GEMINI_API_KEY
```

#### 2. Firebase認証エラー
```bash
# Firebase認証ファイルの確認
ls -la keys/
cat keys/firebase-adminsdk-key.json
```

#### 3. 依存関係エラー
```bash
# 依存関係の再インストール
rm -rf node_modules package-lock.json
npm install
```

#### 4. LanceDBエラー
```bash
# LanceDBディレクトリの確認
ls -la .lancedb/

# LanceDBテーブルの確認
npx tsx src/scripts/check-table-schema.ts
```

## 6. ログの確認

### 同期ログの確認
```bash
# 最新のログファイルを確認
ls -la logs/
tail -f logs/sync_log_*.json
```

### デバッグ情報の表示
```bash
# データベース状態の確認
npx tsx src/scripts/check-data-basic.ts

# 同期進捗の確認
npx tsx src/scripts/check-sync-progress.ts
```

## 7. パフォーマンス監視

### パフォーマンス測定
```bash
npm run monitor:performance
```

### メモリ使用量の確認
```bash
npx tsx src/scripts/performance-monitor.ts
```

## 8. 緊急時の対応

### 全データクリア
```bash
npx tsx src/scripts/clear-all-data.ts
```

### テーブル再構築
```bash
npx tsx src/scripts/rebuild-lancedb-table.ts
```

### 特定ページの同期
```bash
npx tsx src/scripts/sync-specific-page.ts <ページID>
```

