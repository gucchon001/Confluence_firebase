# リリースノート（2025年9月16日）

## 概要

Confluence仕様書要約チャットボットのLanceDB移行が完了し、本番環境にデプロイしました。このリリースでは、Vertex AI Vector Searchを廃止し、LanceDBを使用した軽量なベクトル検索システムに移行しました。

## 主な変更点

### 1. アーキテクチャの変更

- **Vertex AI Vector Search → LanceDB**：
  - クラウドベースのVertex AI Vector Searchからローカルファイルシステムベースのベクトル検索エンジンLanceDBに移行
  - コスト削減と開発環境での利便性向上

- **埋め込みベクトル生成**：
  - Vertex AI Embedding API → @xenova/transformers（ローカル実行）
  - 768次元のベクトルを生成
  - APIコスト削減

- **メタデータ管理の簡素化**：
  - Firestoreのメタデータ管理を廃止
  - LanceDBに検索結果表示に必要なすべてのメタデータを統合

### 2. 技術的な改善

- **Next.js 15対応**：
  - 動的ルートパラメータの処理方法を更新
  - `params`を`Promise`として扱うように修正

- **Genkit API対応**：
  - `ai.embed`メソッドのパラメータ形式を更新

- **LanceDB API対応**：
  - `execute`メソッドから`toArray`メソッドへの変更
  - 型定義の修正

### 3. ドキュメントの更新

- **デプロイガイド**：新規作成
- **LanceDB使用ガイド**：新規作成
- **トラブルシューティングガイド**：新規作成
- **アーキテクチャ図**：更新
- **仕様書**：更新

## デプロイ情報

- **デプロイURL**: https://confluence-copilot-ppjye.web.app
- **デプロイ日時**: 2025年9月16日

## 既知の問題

- Firebase Functionsのデプロイに問題があります（`functions.region is not a function`エラー）
- 現在はHostingのみデプロイしています

## 今後の予定

1. Firebase Functionsのデプロイ問題を解決
2. LanceDBのパフォーマンス最適化
3. 大規模データセットでのテスト
