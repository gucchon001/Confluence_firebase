# API設計書: Confluence仕様書要約チャットボット

## 1. 概要

本ドキュメントは、「Confluence仕様書要約チャットボット」のフロントエンドとバックエンド（Next.js API Routes および Cloud Functions for Firebase）間のAPI仕様を定義する。

## 1.1 更新履歴

- 2025-09-11: Vector Search対応の更新
  - 差分更新と削除ページ処理の機能を追加
  - Vector Search用のメタデータ（restricts、crowding_tag）を追加
  - レスポンスに参照情報の詳細を追加

## 2. ベースURL

### 2.1 Next.js API Routes
Next.jsアプリケーションにデプロイされたAPIルート。
例: `https://<app-domain>/api/<endpoint>`

### 2.2 Cloud Functions for Firebase
Cloud Functions for Firebaseによってデプロイされた各関数のURL。
例: `https://<region>-<project-id>.cloudfunctions.net/<function-name>`

## 3. APIエンドポイント仕様

### 3.1 `POST /sync-confluence`

Confluenceからデータを取得し、ベクトルデータベースを更新するバッチ処理を開始する。

* **説明**: 管理者用のエンドポイント。Cloud Schedulerから定期的に呼び出されることを想定。
* **認証**: IAMによる認証（呼び出し元サービスアカウントを制限）。
* **リクエストボディ**:
    ```json
    {
      "differential": false,
      "skip_deleted": false
    }
    ```
    | フィールド        | 型           | 必須 | デフォルト | 説明                                     |
    | :---------------- | :----------- | :--- | :-------- | :--------------------------------------- |
    | `differential`    | `boolean`    |      | `false`   | 差分更新モードを有効にするかどうか。有効にすると前回の同期以降に更新されたページのみを処理する。 |
    | `skip_deleted`    | `boolean`    |      | `false`   | 削除ページの処理をスキップするかどうか。`false`の場合、Confluenceから削除されたページのチャンクをFirestoreからも削除する。 |
* **レスポンス (200 OK)**:
    ```json
    {
      "status": "success",
      "message": "Sync process started.",
      "sync_mode": "full",
      "handle_deleted": true,
      "operation_id": "batch-sync-2025-09-11-12345"
    }
    ```

### 3.2 `GET /conversations`

ユーザーの過去の会話履歴一覧を取得する。

* **説明**: ユーザーIDに基づき、過去の会話のリストを返す。
* **認証**: Firebase AuthenticationによるIDトークン認証。
* **クエリパラメータ**:
    | パラメータ | 型           | 必須 | デフォルト | 説明                                     |
    | :-------- | :----------- | :--- | :-------- | :--------------------------------------- |
    | `limit`   | `number`     |      | `10`      | 取得する会話の最大数。                   |
    | `offset`  | `number`     |      | `0`       | ページネーションのオフセット。           |
* **レスポンス (200 OK)**:
    ```json
    {
      "conversations": [
        {
          "conversation_id": "string",
          "title": "string",
          "last_updated": "timestamp",
          "message_count": 6
        }
      ],
      "total_count": 25,
      "has_more": true
    }
    ```

### 3.3 `GET /conversations/{conversation_id}`

特定の会話のメッセージ履歴を取得する。

* **説明**: 指定された`conversation_id`のメッセージのやり取りを返す。
* **認証**: Firebase AuthenticationによるIDトークン認証。
* **レスポンス (200 OK)**:
    ```json
    {
      "conversation_id": "string",
      "title": "string",
      "created_at": "timestamp",
      "last_updated": "timestamp",
      "messages": [
        {
          "message_id": "string",
          "role": "user",
          "content": "string",
          "timestamp": "timestamp"
        },
        {
          "message_id": "string",
          "role": "assistant",
          "content": "string",
          "timestamp": "timestamp",
          "references": [
            {
              "title": "string",
              "url": "string",
              "space_key": "string",
              "score": 0.95
            }
          ]
        }
      ]
    }
    ```

### 3.4 `POST /sync-status`

現在のベクトルデータベース同期状態を取得する。

* **説明**: 管理者用のエンドポイント。最新の同期状態や統計情報を返す。
* **認証**: IAMによる認証（呼び出し元サービスアカウントを制限）。
* **レスポンス (200 OK)**:
    ```json
    {
      "last_sync": {
        "timestamp": "2025-09-11T04:35:22.123Z",
        "status": "complete",
        "total_pages": 987,
        "total_chunks": 2345,
        "total_embeddings": 2345,
        "deleted_pages": 5,
        "sync_mode": "differential",
        "duration_seconds": 1234
      },
      "index_stats": {
        "vectors_count": 2345,
        "shards_count": 1,
        "last_updated": "2025-09-11T04:40:15.456Z"
      },
      "ongoing_operations": [
        {
          "operation_id": "batch-sync-2025-09-11-12345",
          "status": "in_progress",
          "start_time": "2025-09-11T05:10:00.000Z",
          "progress": 0.65
        }
      ]
    }
    ```