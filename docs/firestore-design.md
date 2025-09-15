# データベース設計書: Confluence仕様書要約チャットボット

## 1. 概要

本ドキュメントは、アプリケーションが使用するCloud Firestoreのデータ構造、スキーマ、およびセキュリティルールの方針を定義する。

## 2. コレクション構造

本アプリケーションのデータは、以下の主要なコレクション構造で管理する。

```
[Root]
├── users (Collection)
│   └── {userId} (Document)
│       │   // ユーザー情報
│       └── conversations (Subcollection)
│           └── {conversationId} (Document)
│               // 会話のメタデータとメッセージ履歴
│
└── syncLogs (Collection)
    └── {logId} (Document)
        // バッチ同期やGCSアップロードなどの実行ログ
```

* **users**: 全ユーザーの情報と会話履歴を格納するコレクション。
* **conversations**: 各ユーザーに紐づく会話の履歴を格納するサブコレクション。
* **syncLogs**: 同期処理やアップロード処理の監視用ログを格納するコレクション（`operation`, `status`, `data`, `timestamp`）。

## 3. ドキュメントスキーマ

### 3.1 `users/{userId}`

ユーザーの基本情報を格納する。

| フィールド名    | データ型    | 必須 | 説明                               |
| :-------------- | :---------- | :--- | :--------------------------------- |
| `uid`           | `string`    | ✔    | Firebase AuthenticationのユーザーID。 |
| `displayName`   | `string`    |      | Googleアカウントの表示名。         |
| `email`         | `string`    | ✔    | Googleアカウントのメールアドレス。 |
| `createdAt`     | `Timestamp` | ✔    | ユーザーが初回ログインした日時。   |

### 3.2 `users/{userId}/conversations/{conversationId}`

一つの会話セッションに関するすべての情報を格納する。

| フィールド名 | データ型       | 必須 | 説明                                               |
| :----------- | :------------- | :--- | :------------------------------------------------- |
| `title`      | `string`       | ✔    | 会話のタイトル（最初のユーザーメッセージから生成）。 |
| `createdAt`  | `Timestamp`    | ✔    | 会話が開始された日時。                             |
| `updatedAt`  | `Timestamp`    | ✔    | 最後のメッセージが追加された日時。                 |
| `messages`   | `Array<Map>`   | ✔    | 会話のメッセージ履歴。下記 `Message` オブジェクトの配列。 |

#### `Message` オブジェクトのスキーマ

`messages` 配列に格納されるオブジェクトの構造。

| フィールド名  | データ型       | 必須 | 説明                                                         |
| :------------ | :------------- | :--- | :----------------------------------------------------------- |
| `role`        | `string`       | ✔    | メッセージの送信者。"user" または "ai"。                     |
| `content`     | `string`       | ✔    | メッセージのテキスト本文。                                   |
| `timestamp`   | `Timestamp`    | ✔    | このメッセージが送信された日時。                             |
| `sources`     | `Array<Map>`   |      | `role`が "ai" の場合のみ存在。下記 `Source` オブジェクトの配列。 |

#### `Source` オブジェクトのスキーマ

`sources` 配列に格納されるオブジェクトの構造。

| フィールド名 | データ型   | 必須 | 説明                              |
| :----------- | :--------- | :--- | :-------------------------------- |
| `title`      | `string`   | ✔    | 参照元Confluenceページのタイトル。 |
| `url`        | `string`   | ✔    | 参照元ConfluenceページへのURL。   |
| `spaceName`  | `string`   |      | 参照元のConfluenceスペース名。    |
| `lastUpdated`| `string`   |      | 参照元ページの最終更新日時。      |

## 4. LanceDBとFirestoreの役割分担

### 4.1 データフロー

1. **データ同期時**
   - Confluenceからデータを取得し、チャンク分割
   - 埋め込みベクトルとメタデータを含むデータをLanceDBに保存
   - 同期ログをFirestoreの`syncLogs`コレクションに保存

2. **検索時**
   - LanceDBでベクトル検索を実行
   - 検索結果（メタデータ含む）を直接取得
   - 検索結果をユーザーに表示

### 4.2 LanceDBとFirestoreの役割分担

| 保存先 | 保存データ | 用途 | 更新頻度 |
| :----- | :--------- | :--- | :------- |
| **LanceDB** | ベクトルデータ<br>メタデータ（タイトル、内容など） | ベクトル検索と検索結果表示 | 1日1回 |
| **Firestore** | ユーザー情報と会話履歴 | ユーザーの会話管理 | リアルタイム |
| **Firestore** | 同期ログ | バッチ処理の監視 | バッチ実行時 |

## 5. セキュリティルール方針

Firestoreのセキュリティルールは、以下の基本方針に基づいて設定する。

1. **デフォルト拒否**: 明示的に許可されていないアクセスはすべて拒否する。
2. **ユーザーデータの保護**: ユーザーは自分自身のデータ (`/users/{userId}`) にのみアクセス（読み書き）できる。
3. **サーバーからのアクセス**: バックエンド（Cloud Functions）からのデータアクセスは、Admin SDKを使用するため、セキュリティルールの制約を受けない。

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ユーザーは自分のドキュメントとサブコレクションのみ読み書き可能
    match /users/{userId}/{documents=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // syncLogsはAdmin SDKからのみアクセス可能
    match /syncLogs/{logId} {
      allow read, write: if false;  // Cloud Functions経由でのみアクセス可能
    }
  }
}
```

## 6. インデックス設定

以下のインデックスを作成して、効率的なクエリを実現する。

1. **会話履歴の並び替え**
   - コレクション: `users/{userId}/conversations`
   - フィールド: `updatedAt` (降順)

## 7. データ移行計画

既存の`chats`コレクションから新しいデータ構造への移行を以下の手順で実施する。

1. **移行スクリプトの作成**
   - 既存の`chats`コレクションから全データを読み取り
   - 新しい構造（`users/{userId}/conversations/{conversationId}`）に変換
   - バッチ処理で新しい構造に書き込み

2. **移行状態の管理**
   - 移行状態を管理するドキュメントを作成
   - 移行完了したユーザーIDを記録

3. **UI上での移行機能**
   - 設定画面に移行ボタンを追加
   - 移行進捗状況の表示
   - 移行完了後の通知