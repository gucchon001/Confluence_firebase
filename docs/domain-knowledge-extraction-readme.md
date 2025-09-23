# ドメイン知識抽出・構造化ツール

## 概要

Confluence上の仕様書から構造化されたドメイン知識を自動抽出し、検索システムの精度向上を実現するツールです。

## 特徴

- **大規模データ処理**: 1000ページ以上の仕様書を効率的に処理
- **LLM活用**: Gemini 2.5 Flashを使用した高精度な知識抽出
- **品質担保**: 自動検証と人間レビューによる品質管理
- **継続的更新**: 定期的な知識ベース更新に対応

## アーキテクチャ

```
Confluence API → データ取得 → LLM分析 → 知識検証 → 統合知識ベース
     ↓              ↓           ↓          ↓           ↓
  ページ情報    構造化データ   機能・キーワード  品質レポート   検索システム
```

## セットアップ

### 1. 環境変数の設定

```bash
# Confluence API設定
export CONFLUENCE_BASE_URL="https://your-domain.atlassian.net"
export CONFLUENCE_USERNAME="your-email@example.com"
export CONFLUENCE_API_TOKEN="your-api-token"
export CONFLUENCE_SPACE_KEY="CLIENTTOMO"

# LLM API設定
export GEMINI_API_KEY="your-gemini-api-key"
```

### 2. 依存関係のインストール

```bash
npm install @google/generative-ai
```

### 3. 設定ファイルの生成

```bash
npx tsx src/scripts/run-domain-knowledge-extraction.ts --generate-config
```

生成された設定ファイル `config/domain-knowledge-config.json` を編集してください。

## 使用方法

### 基本的な実行

```bash
# フルパイプラインの実行
npx tsx src/scripts/run-domain-knowledge-extraction.ts
```

### 段階的な実行

```bash
# Confluenceデータ抽出のみ
SKIP_LLM=true SKIP_VALIDATION=true npx tsx src/scripts/run-domain-knowledge-extraction.ts

# LLM抽出のみ（Confluenceデータが既に存在する場合）
SKIP_CONFLUENCE=true SKIP_VALIDATION=true npx tsx src/scripts/run-domain-knowledge-extraction.ts

# 検証のみ
SKIP_CONFLUENCE=true SKIP_LLM=true npx tsx src/scripts/run-domain-knowledge-extraction.ts
```

### 設定オプション

```bash
# 最大ページ数を制限
CONFLUENCE_MAX_PAGES=100 npx tsx src/scripts/run-domain-knowledge-extraction.ts

# バッチサイズを調整
LLM_BATCH_SIZE=3 npx tsx src/scripts/run-domain-knowledge-extraction.ts
```

## 出力ファイル

### Confluenceデータ抽出結果
```
data/confluence-extraction/
├── confluence-data.json          # メインデータ
├── extraction-stats.json         # 統計情報
└── pages/                        # ページ別ファイル
    ├── page1.json
    └── page2.json
```

### LLM知識抽出結果
```
data/llm-extraction/
├── extracted-knowledge.json      # 抽出された知識
├── extraction-stats.json         # 処理統計
└── merged-knowledge.json         # 統合された知識ベース
```

### 検証結果
```
data/validation/
├── quality-report.json           # 詳細レポート
├── problematic-pages.json        # 問題のあるページ
└── summary-report.md            # 人間が読みやすいサマリー
```

## 設定ファイル

### `config/domain-knowledge-config.json`

```json
{
  "confluence": {
    "spaceKey": "CLIENTTOMO",
    "outputDir": "./data/confluence-extraction",
    "batchSize": 50,
    "includeArchived": false,
    "maxPages": 1000
  },
  "llm": {
    "apiKey": "",
    "model": "gemini-1.5-flash",
    "batchSize": 5,
    "outputDir": "./data/llm-extraction",
    "maxRetries": 3,
    "delayBetweenRequests": 2000
  },
  "skipConfluenceExtraction": false,
  "skipLLMExtraction": false,
  "skipValidation": false
}
```

## 品質管理

### 自動検証項目

1. **機能名の品質**
   - 長さ（2-50文字）
   - 具体性（一般的すぎる名前の検出）
   - 一貫性（類似名の検出）

2. **キーワードの品質**
   - 重複の検出
   - 長さの適切性
   - 空のキーワードの検出

3. **信頼度の評価**
   - 低信頼度の検出
   - 抽出失敗の検出

4. **完全性の確認**
   - 期待される機能の抽出確認
   - コンテンツ品質の評価

### 品質スコア

- **90-100点**: 優秀
- **70-89点**: 良好
- **50-69点**: 要改善
- **0-49点**: 要再処理

## トラブルシューティング

### よくある問題

1. **API制限エラー**
   ```
   Error: Request timeout after 30000ms
   ```
   - 解決策: `delayBetweenRequests` を増やす

2. **メモリ不足**
   ```
   Error: JavaScript heap out of memory
   ```
   - 解決策: `batchSize` を減らす

3. **LLM API制限**
   ```
   Error: Rate limit exceeded
   ```
   - 解決策: `maxRetries` を増やし、`delayBetweenRequests` を調整

### ログの確認

```bash
# 詳細ログを有効にする
DEBUG=true npx tsx src/scripts/run-domain-knowledge-extraction.ts
```

## 継続的改善

### 1. 定期的な実行

```bash
# 週次実行の例
0 2 * * 1 npx tsx src/scripts/run-domain-knowledge-extraction.ts
```

### 2. 品質監視

- 品質スコアの推移を監視
- 問題のあるページの特定
- プロンプトの継続的改善

### 3. フィードバック収集

- 抽出結果の人間レビュー
- 検索精度の測定
- ユーザーフィードバックの収集

## パフォーマンス最適化

### 処理時間の短縮

1. **バッチサイズの調整**
   - Confluence: 50-100
   - LLM: 3-10

2. **並列処理の活用**
   - バッチ内での並列処理
   - 適切な遅延設定

3. **キャッシュの活用**
   - 既存データの再利用
   - 増分更新の実装

### コスト最適化

1. **API使用量の削減**
   - 重複処理の回避
   - 効率的なプロンプト設計

2. **処理の最適化**
   - 不要なページの除外
   - 品質フィルタリング

## ライセンス

このツールは MIT ライセンスの下で提供されています。

## サポート

問題が発生した場合は、以下の情報を含めて報告してください：

1. 実行環境（OS、Node.js バージョン）
2. 設定ファイルの内容（機密情報を除く）
3. エラーメッセージの全文
4. ログファイルの内容
