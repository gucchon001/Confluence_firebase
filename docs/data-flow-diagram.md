# Confluence Vector Search システム設計図

このドキュメントでは、Confluence Vector Search システムのコンポーネント図、データフロー図、シーケンス図を示します。

## コンポーネント図

```mermaid
graph TB
    subgraph "フロントエンド"
        A[Next.js UI] --- B[Chat Page]
        B --- C[RAG Components]
    end
    
    subgraph "バックエンド"
        D[Next.js API Routes] --- E[Genkit Core]
        F[Firebase Cloud Functions] --- G[Batch Processing]
    end
    
    subgraph "データストア"
        H[Firestore] --- I[Document Metadata]
        J[Google Cloud Storage] --- K[JSON Files]
        L[Vector Search] --- M[Embeddings Index]
    end
    
    subgraph "外部サービス"
        N[Confluence API] --- O[Content Source]
        P[Google AI APIs] --- Q[Embedding API]
        P --- R[Gemini LLM]
    end
    
    %% コンポーネント間の関係
    C -.-> |"API呼び出し"| D
    E -.-> |"モデル利用"| P
    G -.-> |"データ取得"| N
    G -.-> |"ファイル保存"| J
    G -.-> |"メタデータ保存"| H
    D -.-> |"メタデータ取得"| H
    D -.-> |"ベクトル検索"| L
    J -.-> |"インデックス更新"| L
```

## データフロー図

```mermaid
graph TD
    A[Confluence API] -->|1. データ取得| B[バッチ同期処理]
    Z[Firestore] -->|1a. 前回の同期時刻取得| B
    B -->|1b. 差分更新| A
    B -->|2. テキスト分割| C[チャンク処理]
    C -->|3. 埋め込みベクトル生成| D[Embedding API]
    D -->|4. ベクトル返却| C
    C -->|5. JSONファイル生成| E[ローカルストレージ]
    C -->|6. メタデータ保存| F[Firestore]
    E -->|7. バケットルートにアップロード| G[Google Cloud Storage]
    B -->|7a. 削除ページ検出| F
    B -->|7b. 削除ページのチャンク削除| F
    B -->|8. 最終バッチ処理完了| H[Vector Search更新]
    G -->|8a. バケット全体を指定| H
    
    I[ユーザークエリ] -->|9. 質問| J[RAGフロー]
    J -->|10. クエリベクトル化| D
    J -->|11. 類似検索| H
    H -->|12. 類似ドキュメントID| J
    J -->|13. メタデータ取得| F
    J -->|14. コンテキスト生成| K[LLM API]
    K -->|15. 回答生成| J
    J -->|16. 回答| I
```

## シーケンス図

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Batch as バッチ同期処理
    participant Confluence as Confluence API
    participant Embed as Embedding API
    participant Local as ローカルストレージ
    participant FS as Firestore
    participant GCS as Google Cloud Storage
    participant VS as Vector Search
    participant RAG as RAGフロー
    participant LLM as LLM API

    %% データ同期フロー
    User->>Batch: 同期処理開始（通常/差分/削除スキップ）
    Batch->>FS: 前回の同期時刻取得
    FS-->>Batch: 同期時刻返却
    Batch->>Confluence: ページデータ取得（差分更新の場合は変更ページのみ）
    Confluence-->>Batch: ページデータ返却
    Batch->>FS: 登録済みページID取得
    FS-->>Batch: ページID一覧返却
    loop 各ページ
        Batch->>Batch: テキスト分割
        loop 各チャンク
            Batch->>Embed: テキスト埋め込み生成（L2正規化）
            Embed-->>Batch: 埋め込みベクトル返却
        end
        Batch->>Local: JSONファイル作成（バッチごと）
        Batch->>FS: メタデータ保存
        Batch->>GCS: JSONファイルをバケットルートにアップロード
        GCS-->>Batch: アップロード完了
        Batch->>VS: 個別ファイルのインデックス更新
        VS-->>Batch: 更新操作開始
        Batch->>VS: 操作状態確認
        VS-->>Batch: 操作完了
    end
    
    %% 削除ページ処理
    alt 削除ページ処理が有効
        Batch->>Batch: 削除ページ検出
        Batch->>FS: 削除ページのチャンク削除
        FS-->>Batch: 削除完了
    end
    
    %% 最終更新処理
    Batch->>VS: バケット全体を指定して最終更新
    VS-->>Batch: 更新操作開始
    Batch->>FS: 同期完了ログ保存
    Batch-->>User: 同期完了通知
    
    %% 検索・回答生成フロー
    User->>RAG: 質問入力
    RAG->>Embed: クエリテキスト埋め込み生成（L2正規化）
    Embed-->>RAG: クエリベクトル返却
    RAG->>VS: 類似ドキュメント検索（findNeighbors）
    VS-->>RAG: 類似ドキュメントID返却
    RAG->>FS: ドキュメントメタデータ取得
    FS-->>RAG: メタデータ返却
    RAG->>LLM: コンテキスト付き質問送信
    LLM-->>RAG: 回答生成
    RAG-->>User: 回答表示
```

## 実装フローの詳細

### 1. データ取得と処理
- Confluenceから全ページデータを取得（約1000ページ）
  - 差分更新モード（`--differential`）では前回の同期以降に更新されたページのみを取得
- テキストをチャンクに分割（合計約2500チャンク）
- 各チャンクの埋め込みベクトルを生成（768次元、L2正規化）
- バッチ単位（100ページごと）でJSONファイルを生成
  - Vector Search仕様に準拠した形式（`id`、`embedding`、`restricts`、`crowding_tag`）
- Firestoreにメタデータを保存

### 2. データ保存と転送
- 生成されたJSONファイルをローカルの`temp`ディレクトリに保存
- JSONファイルをGoogle Cloud Storage（GCS）のバケットルートに直接アップロード
  - Vector Search仕様に準拠（サブディレクトリ不可）
- 各バッチごとにVector Searchインデックスに個別ファイルをインポート
- 削除ページ処理（`--skip-deleted`オプションで無効化可能）
  - Confluenceから削除されたページのチャンクをFirestoreから削除
- 全バッチ処理完了後、バケット全体を指定して最終更新を実行

### 3. 検索と回答生成
- ユーザーの質問をベクトル化（768次元、L2正規化）
- Vector Searchで類似ドキュメントを検索（`findNeighbors` API）
- 検索結果IDを使ってFirestoreからメタデータを取得
- 取得したコンテキストと質問をLLMに送信
- 生成された回答をユーザーに表示

## 技術スタック

- **フロントエンド**: Next.js
- **バックエンド**: Next.js API Routes + Firebase Cloud Functions
- **データベース**: Firestore
- **ストレージ**: Google Cloud Storage
- **ベクトル検索**: Vertex AI Vector Search
- **埋め込み生成**: Google AI Text Embedding API (text-embedding-004)
- **LLM**: Google AI Gemini Pro (gemini-2.0-flash)
- **AI Framework**: Genkit (core)

## コンポーネントの詳細説明

### フロントエンド
- **Next.js UI**: Reactベースのフロントエンドフレームワーク
- **Chat Page**: ユーザーとのチャットインターフェース
- **RAG Components**: 検索結果表示や回答生成のUIコンポーネント

### バックエンド
- **Next.js API Routes**: フロントエンドからのAPIリクエストを処理
- **Genkit Core**: AIモデルとの連携を担当するフレームワーク
- **Firebase Cloud Functions**: バッチ処理やスケジュールされたタスクを実行
- **Batch Processing**: Confluenceデータの定期同期処理

### データストア
- **Firestore**: ドキュメントのメタデータと検索結果表示用データを保存
- **Document Metadata**: チャンクのタイトル、URL、ラベルなどの情報
- **Google Cloud Storage**: 大容量のJSONファイルを保存
- **JSON Files**: ベクトルデータとメタデータを含む構造化ファイル
- **Vector Search**: 高速なベクトル類似度検索を提供（DOT_PRODUCT_DISTANCE + UNIT_L2_NORM）
- **Embeddings Index**: 埋め込みベクトルのインデックス

### 外部サービス
- **Confluence API**: ドキュメントのソースデータを提供
- **Content Source**: ページ、スペース、ラベルなどの構造化コンテンツ
- **Google AI APIs**: AIモデルへのアクセスを提供
- **Embedding API**: テキストの埋め込みベクトル生成
- **Gemini LLM**: 質問応答と要約生成のための大規模言語モデル
