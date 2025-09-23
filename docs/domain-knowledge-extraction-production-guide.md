# ドメイン知識抽出パイプライン - 本番実行ガイド

## 概要

Confluenceからシステム仕様書を抽出し、LLMを使用してドメイン知識（ドメイン名、機能名、操作名、システム項目、システム用語、関連キーワード）を自動抽出するパイプラインです。

## 機能概要

### 抽出対象のキーワードカテゴリ

1. **ドメイン名**: システムの主要な機能領域（例：教室管理、求人管理）
2. **機能名**: 具体的な機能名（例：求人情報新規登録機能）
3. **操作名**: 基本操作（例：新規登録、閲覧、編集、削除）
4. **システム項目**: 入力フォームの項目名、データベースフィールド名（例：商品概要、対象サイト）
5. **システム用語**: 技術的な用語、UIコンポーネント名（例：入力フォーム、データベース、ログ）
6. **関連キーワード**: 検索に有効な用語（例：管理者、企業、教室）

### 重複削除機能

- **ページ内重複削除**: 同一ページ内での重複キーワードを削除
- **ページ間重複削除**: 複数ページ間での重複キーワードを削除
- **カテゴリ間重複**: 適切な重複（同一キーワードが複数カテゴリに属する）は保持

## 本番実行手順

### 前提条件

1. **環境変数の設定**
   ```bash
   # .env ファイルまたは環境変数として設定
   CONFLUENCE_BASE_URL=https://your-confluence-instance.com
   CONFLUENCE_USER_EMAIL=your-email@company.com
   CONFLUENCE_API_TOKEN=your-api-token
   CONFLUENCE_SPACE_KEY=your-space-key
   GEMINI_API_KEY=your-gemini-api-key
   ```

2. **依存関係のインストール**
   ```bash
   npm install
   ```

### 実行コマンド

#### フル実行（推奨）
```bash
npm run domain-knowledge-extraction-v2
```

#### ステップ別実行
```bash
# Confluenceデータ抽出のみ
npm run domain-knowledge-extraction-v2 -- --steps confluence

# LLM知識抽出のみ
npm run domain-knowledge-extraction-v2 -- --steps llm

# 検証・統合のみ
npm run domain-knowledge-extraction-v2 -- --steps validation
```

### 実行時間の目安

- **全ページ実行**: 約15-20分（1,067ページ）
- **Confluence抽出**: 約3-5分
- **LLM抽出**: 約10-15分
- **重複削除・統合**: 約1-2分

### 出力ファイル

実行完了後、以下のファイルが生成されます：

```
data/
├── confluence-extraction-v2/
│   └── confluence-pages-v2.json          # Confluence抽出結果
├── llm-extraction-v2/
│   ├── extracted-knowledge-v2.json       # LLM抽出結果
│   └── deduplication-result-v2.json     # 重複削除結果
└── domain-knowledge-v2/
    ├── final-domain-knowledge-v2.json    # 最終統合結果
    └── keyword-lists-v2.json            # キーワード一覧
```

## 設定ファイル

### 基本設定（config/domain-knowledge-config.json）

```json
{
  "confluence": {
    "baseUrl": "${CONFLUENCE_BASE_URL}",
    "email": "${CONFLUENCE_USER_EMAIL}",
    "apiToken": "${CONFLUENCE_API_TOKEN}",
    "spaceKey": "${CONFLUENCE_SPACE_KEY}",
    "maxPages": null,           // null = 全ページ、数値 = 制限
    "batchSize": 5,
    "outputDir": "data/confluence-extraction-v2"
  },
  "llm": {
    "apiKey": "${GEMINI_API_KEY}",
    "model": "gemini-2.5-flash",
    "batchSize": 50,            // 並列処理数
    "outputDir": "data/llm-extraction-v2",
    "maxRetries": 3,
    "delayBetweenRequests": 0   // リクエスト間隔（ms）
  },
  "validation": {
    "outputDir": "data/validation-v2"
  },
  "pipeline": {
    "steps": ["confluence", "llm", "validation"],
    "outputDir": "data/domain-knowledge-v2"
  }
}
```

### デバッグ用設定

```json
{
  "confluence": {
    "maxPages": 10,             // 10ページのみ実行
    "specificPageId": "704774344" // 特定ページのみ実行
  },
  "llm": {
    "batchSize": 1,             // シーケンシャル実行
    "delayBetweenRequests": 1000 // 1秒間隔
  }
}
```

## トラブルシューティング

### よくある問題と解決方法

1. **API制限エラー**
   ```
   エラー: Rate limit exceeded
   解決: llm.delayBetweenRequests を増加（例：1000ms）
   ```

2. **メモリ不足エラー**
   ```
   エラー: JavaScript heap out of memory
   解決: llm.batchSize を減少（例：20 → 10）
   ```

3. **Confluence接続エラー**
   ```
   エラー: Authentication failed
   解決: 環境変数の設定を確認
   ```

4. **LLM応答エラー**
   ```
   エラー: JSON parse error
   解決: 自動的にリトライされる（maxRetries: 3）
   ```

### ログ確認

実行中のログで以下を確認：
- 進捗状況（バッチ数/総バッチ数）
- エラー発生時の詳細情報
- 最終統計情報

## 品質保証

### 重複削除の検証

実行後、以下を確認：
```bash
npx tsx src/scripts/generate-keyword-lists.ts
```

期待される結果：
- 重複率: 約19-20%（カテゴリ間重複は正常）
- 各カテゴリ内での重複: 0%

### 統計情報の確認

最終結果ファイル（final-domain-knowledge-v2.json）の統計：
- 総ページ数: 1,067
- 総キーワード数: 約9,000-10,000
- ドメイン名数: 約200-300
- システム項目数: 約3,000-4,000
- システム用語数: 約2,000-3,000

## メンテナンス

### 定期実行

推奨頻度：月1回または仕様書更新時

### データ更新

新しいConfluenceページが追加された場合：
1. 既存の出力ファイルをバックアップ
2. フル実行を実行
3. 結果を比較・検証

### パフォーマンス最適化

処理時間を短縮したい場合：
1. `llm.batchSize` を増加（50 → 100）
2. `llm.delayBetweenRequests` を0に設定
3. プロンプト長を調整（現在1500文字）

## 注意事項

1. **API使用量**: Gemini APIの使用量に注意
2. **データサイズ**: 出力ファイルは約100MB程度
3. **実行環境**: Node.js 18以上推奨
4. **ネットワーク**: 安定したインターネット接続が必要

## サポート

問題が発生した場合：
1. ログファイルを確認
2. 設定ファイルの検証
3. 環境変数の確認
4. 必要に応じてデバッグ用設定で実行
