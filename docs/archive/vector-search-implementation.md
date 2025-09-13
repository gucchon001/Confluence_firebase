# Vector Search 実装計画書・実装状況

## 1. 概要

本ドキュメントは、Confluence仕様書要約チャットボットにおける Google Cloud Vertex AI Vector Search の実装計画を定義します。現在は JSON ファイルにローカル保存していますが、本番環境では Vector Search を使用して効率的な検索を実現します。

## 2. 実装ステップ

### 2.1 Vector Search インデックスの作成

1. **Google Cloud Console での準備**
   - Vertex AI API の有効化
   - 必要なロールの付与 (Vertex AI Administrator など)
   - Vector Search インデックスの作成
     - 名前: `confluence-embeddings`
     - 次元数: 768 (text-embedding-004 の出力次元数)
     - メトリック: Cosine
     - シャード数: 2 (必要に応じて調整)

2. **環境変数の設定**
   ```
   VERTEX_AI_PROJECT_ID=your-project-id
   VERTEX_AI_LOCATION=asia-northeast1
   VERTEX_AI_INDEX_ID=confluence-embeddings
   ```

### 2.2 データアップロード実装

1. **必要なライブラリ**
   ```bash
   npm install @google-cloud/aiplatform
   ```

2. **実装方法**
   - REST API または Google Cloud SDK を使用
   - バッチアップロード処理の実装
   - エラーハンドリングとリトライ機構

3. **データポイント構造**
   ```javascript
   {
     id: `${pageId}-${chunkIndex}`,
     embedding: [...],  // 768次元のベクトル
     restricts: [
       { namespace: 'source', allow: ['confluence'] },
       { namespace: 'pageId', allow: [pageId] },
     ],
     crowding_tag: pageId,  // 同じページのチャンクは同じタグを持つ
     numeric_restricts: [
       { namespace: 'lastUpdated', value: timestamp },
     ],
     metadata: {
       title: "ページタイトル",
       text: "チャンクのテキスト",
       url: "Confluence URL",
       labels: "ラベル1,ラベル2,...",
       pageId: "ページID",
       chunkIndex: "0",
       lastUpdated: "2023-09-01T12:00:00Z",
     },
   }
   ```

### 2.3 検索機能の実装

1. **検索パラメータ**
   - 近傍数: 10
   - 距離閾値: 0.7
   - ラベルフィルタリング (オプション)

2. **src/ai/flows/retrieve-relevant-docs.ts の更新**
   - 既存のモックデータ機能を維持しながら、実際の Vector Search 呼び出しを実装
   - ラベルによるフィルタリングのサポート

## 3. Cloud Functions 化

1. **実行環境**
   - Node.js 18 以上
   - メモリ: 1GB
   - タイムアウト: 540秒 (9分)

2. **認証**
   - サービスアカウントの使用
   - 必要な権限:
     - `roles/aiplatform.user`
     - `roles/datastore.user`

3. **スケジューリング**
   - Cloud Scheduler を使用
   - Cron 式: `0 1 * * *` (毎日午前1時に実行)

## 4. エラーハンドリングと監視

1. **エラー対応**
   - API エラーのリトライ (指数バックオフ)
   - 部分的な失敗の許容 (一部のページのアップロードが失敗しても続行)

2. **ログ記録**
   - Cloud Logging への詳細なログ出力
   - エラー通知の設定

3. **監視メトリクス**
   - 処理されたページ数
   - 生成された埋め込み数
   - 処理時間
   - エラー率

## 5. 実装状況（2024-09-08更新）

1. **ローカルスクリプト実装完了**
   - Confluenceデータの取得
   - テキスト抽出・チャンク分割
   - Embedding生成
   - ローカルJSON保存

2. **Vector Search アップロード実装完了**
   - REST APIを使用したアップロード機能の実装
   - バッチ処理によるデータのアップサート
   - エラーハンドリング

3. **Vector Search インデックス作成完了**
   - インデックスID: `7360896096425476096`
   - 次元数: 768
   - メトリック: Cosine
   - リージョン: `asia-northeast1`

4. **Cloud Functions 実装完了**
   - HTTPトリガー関数 `syncConfluenceData`
   - スケジュール実行関数 `scheduledSyncConfluenceData`
   - デバッグモードの実装
   - 詳細なログ出力

5. **実装上の課題解決**
   - 400 Bad Request エラーの原因特定と修正
   - `feature_vector` フィールドを明示的に数値配列に変換する処理を追加
   - バッチサイズを小さくして処理負荷を軽減
   - フォールバックロジックの修正（開発中は結果が0件でもモックデータにフォールバックしないように変更）

6. **次のステップ**
   - 検索機能の実装
   - `retrieve-relevant-docs.ts` の本番分岐に Vector Search 呼び出し実装
   - 検索パラメータの最適化

## 6. 今後の拡張

1. **検索精度の向上**
   - ハイブリッド検索 (キーワード + セマンティック)
   - 再ランキング機構

2. **スケーラビリティ**
   - シャード数の最適化
   - レプリケーション設定

3. **メタデータ活用**
   - ラベルベースのフィルタリング強化
   - 時系列データの活用 (最新情報の優先など)
