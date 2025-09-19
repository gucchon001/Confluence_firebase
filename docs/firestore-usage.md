# Firestoreの使用方針

## 1. 概要

このドキュメントでは、アプリケーションにおけるFirestoreの使用方針について説明します。LanceDBへの移行に伴い、Firestoreの役割が変更されましたが、以下の重要な機能については引き続きFirestoreを使用します。

## 2. Firestoreの使用用途

### 2.1 会話履歴の保存・読込機能

ユーザーとAIの会話履歴はFirestoreに保存します。これにより、ユーザーが過去の会話を参照したり、続きから会話を再開したりすることが可能になります。

```
users/{userId}/conversations/{conversationId}
```

| フィールド名 | データ型       | 必須 | 説明                                               |
| :----------- | :------------- | :--- | :------------------------------------------------- |
| `title`      | `string`       | ✔    | 会話のタイトル（最初のユーザーメッセージから生成）。 |
| `createdAt`  | `Timestamp`    | ✔    | 会話が開始された日時。                             |
| `updatedAt`  | `Timestamp`    | ✔    | 最後のメッセージが追加された日時。                 |
| `messages`   | `Array<Map>`   | ✔    | 会話のメッセージ履歴。下記 `Message` オブジェクトの配列。 |

#### `Message` オブジェクトのスキーマ

| フィールド名  | データ型       | 必須 | 説明                                                         |
| :------------ | :------------- | :--- | :----------------------------------------------------------- |
| `role`        | `string`       | ✔    | メッセージの送信者。"user" または "ai"。                     |
| `content`     | `string`       | ✔    | メッセージのテキスト本文。                                   |
| `timestamp`   | `Timestamp`    | ✔    | このメッセージが送信された日時。                             |
| `sources`     | `Array<Map>`   |      | `role`が "ai" の場合のみ存在。下記 `Source` オブジェクトの配列。 |

#### `Source` オブジェクトのスキーマ

| フィールド名 | データ型   | 必須 | 説明                              |
| :----------- | :--------- | :--- | :-------------------------------- |
| `title`      | `string`   | ✔    | 参照元Confluenceページのタイトル。 |
| `url`        | `string`   | ✔    | 参照元ConfluenceページへのURL。   |
| `spaceName`  | `string`   |      | 参照元のConfluenceスペース名。    |
| `lastUpdated`| `string`   |      | 参照元ページの最終更新日時。      |

### 2.2 アカウント保存機能

ユーザーアカウント情報はFirestoreに保存します。Firebase Authenticationと連携して、ユーザー認証とユーザー情報の管理を行います。

```
users/{userId}
```

| フィールド名    | データ型    | 必須 | 説明                               |
| :-------------- | :---------- | :--- | :--------------------------------- |
| `uid`           | `string`    | ✔    | Firebase AuthenticationのユーザーID。 |
| `displayName`   | `string`    |      | Googleアカウントの表示名。         |
| `email`         | `string`    | ✔    | Googleアカウントのメールアドレス。 |
| `createdAt`     | `Timestamp` | ✔    | ユーザーが初回ログインした日時。   |

### 2.3 ログの保存

システムログやエラーログはFirestoreに保存します。これにより、システムの動作状況やエラーの発生状況を監視・分析することが可能になります。

#### 同期ログ

```
syncLogs/{logId}
```

| フィールド名  | データ型    | 説明                                   |
| :------------ | :---------- | :------------------------------------- |
| `operation`   | `string`    | 実行された操作の種類（例: "start", "complete", "error"） |
| `status`      | `string`    | 操作の状態（例: "success", "failed"）  |
| `data`        | `Map`       | 操作に関する詳細データ                 |
| `timestamp`   | `Timestamp` | ログが記録された日時                   |

#### エラーログ

```
errorLogs/{logId}
```

| フィールド名  | データ型    | 説明                                   |
| :------------ | :---------- | :------------------------------------- |
| `operation`   | `string`    | エラーが発生した操作の種類             |
| `code`        | `string`    | エラーコード                           |
| `message`     | `string`    | エラーメッセージ                       |
| `context`     | `Map`       | エラー発生時のコンテキスト情報         |
| `stack`       | `string`    | スタックトレース（開発環境のみ）       |
| `createdAt`   | `Timestamp` | エラーが記録された日時                 |

#### 処理状態

```
processingState/{idempotencyKey}
```

| フィールド名    | データ型    | 説明                                   |
| :-------------- | :---------- | :------------------------------------- |
| `operation`     | `string`    | 処理の種類                             |
| `idempotencyKey`| `string`    | 冪等性を確保するためのキー             |
| `status`        | `string`    | 処理の状態（"processing", "completed", "failed"） |
| `startedAt`     | `Timestamp` | 処理が開始された日時                   |
| `completedAt`   | `Timestamp` | 処理が完了した日時（完了時のみ）       |
| `failedAt`      | `Timestamp` | 処理が失敗した日時（失敗時のみ）       |
| `result`        | `any`       | 処理の結果（完了時のみ）               |
| `error`         | `string`    | エラーメッセージ（失敗時のみ）         |

## 3. Firestoreのセキュリティルール

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
    
    // errorLogsはAdmin SDKからのみアクセス可能
    match /errorLogs/{logId} {
      allow read, write: if false;  // Cloud Functions経由でのみアクセス可能
    }
    
    // processingStateはAdmin SDKからのみアクセス可能
    match /processingState/{idempotencyKey} {
      allow read, write: if false;  // Cloud Functions経由でのみアクセス可能
    }
  }
}
```

## 4. LanceDBとFirestoreの役割分担

| 保存先 | 保存データ | 用途 | 更新頻度 |
| :----- | :--------- | :--- | :------- |
| **LanceDB** | ベクトルデータとメタデータ | ベクトル検索と検索結果表示 | 定期的（差分更新） |
| **Firestore** | ユーザー情報と会話履歴 | ユーザーの会話管理 | リアルタイム |
| **Firestore** | システムログとエラーログ | システム監視と問題分析 | 随時 |

## 5. まとめ

Firestoreは、ユーザー関連データ（アカウント情報、会話履歴）とシステムログの保存に特化して使用します。一方、コンテンツのベクトル検索とメタデータの保存はLanceDBに一元化しました。これにより、各データベースの特性を活かした効率的なシステム構成を実現しています。
