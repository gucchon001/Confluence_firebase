# Confluence Vector Search システム設計図 (LanceDB版)

このドキュメントでは、LanceDBを使用したConfluence Vector Search システムのコンポーネント図、データフロー図、シーケンス図を示します。

## コンポーネント図

```mermaid
graph TB
    subgraph "フロントエンド"
        A[Next.js UI] --- B[Chat Page]
        B --- C[RAG Components]
    end
    
    subgraph "バックエンド"
        D[Next.js API Routes] --- E[Genkit Core]
        F[Node.js Scripts] --- G[Batch Processing]
    end
    
    subgraph "データストア"
        H[Firestore] --- I[ユーザーデータ/ログ]
        L[LanceDB] --- M[ベクトル/メタデータ]
    end
    
    subgraph "外部サービス"
        N[Confluence API] --- O[Content Source]
        P[Google AI APIs] --- R[Gemini LLM]
    end
    
    subgraph "ローカル処理"
        S[Xenova Transformers] --- T[埋め込み生成]
    end
    
    %% コンポーネント間の関係
    C -.-> |"API呼び出し"| D
    E -.-> |"モデル利用"| P
    G -.-> |"データ取得"| N
    G -.-> |"埋め込み生成"| S
    G -.-> |"ベクトル/メタデータ保存"| L
    D -.-> |"ユーザーデータ取得"| H
    D -.-> |"ベクトル検索"| L
```

## データフロー図

```mermaid
graph TD
    A[Confluence API] -->|1. データ取得| B[バッチ同期処理]
    Z[Firestore] -->|1a. 同期ログ記録| B
    B -->|1b. 差分更新| A
    B -->|2. テキスト分割| C[チャンク処理]
    C -->|3. 埋め込みベクトル生成| D[Xenova Transformers]
    D -->|4. ベクトル返却| C
    C -->|5. ベクトルとメタデータ保存| E[LanceDB]
    B -->|6. 同期ログ保存| Z
    
    I[ユーザークエリ] -->|7. 質問| J[RAGフロー]
    J -->|8. クエリベクトル化| D
    J -->|9. 類似検索| E
    E -->|10. 類似ドキュメント（メタデータ含む）| J
    J -->|11. コンテキスト生成| K[LLM API]
    K -->|12. 回答生成| J
    J -->|13. 回答| I
    J -->|14. 会話履歴保存| Z
```

## シーケンス図

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Batch as バッチ同期処理
    participant Confluence as Confluence API
    participant Embed as Xenova Transformers
    participant LDB as LanceDB
    participant FS as Firestore
    participant RAG as RAGフロー
    participant LLM as LLM API

    %% データ同期フロー
    User->>Batch: 同期処理開始（通常/差分/削除スキップ）
    Batch->>FS: 同期ログ記録開始
    Batch->>Confluence: ページデータ取得（差分更新の場合は変更ページのみ）
    Confluence-->>Batch: ページデータ返却
    loop 各ページ
        Batch->>Batch: テキスト分割
        loop 各チャンク
            Batch->>Embed: テキスト埋め込み生成（L2正規化）
            Embed-->>Batch: 埋め込みベクトル返却
            Batch->>LDB: ベクトルとメタデータ保存
            LDB-->>Batch: 保存完了
        end
    end
    
    %% 削除ページ処理
    alt 削除ページ処理が有効
        Batch->>Batch: 削除ページ検出
        Batch->>LDB: 削除ページのチャンク削除
        LDB-->>Batch: 削除完了
    end
    
    Batch->>FS: 同期完了ログ保存
    Batch-->>User: 同期完了通知
    
    %% 検索・回答生成フロー
    User->>RAG: 質問入力
    RAG->>Embed: クエリテキスト埋め込み生成（L2正規化）
    Embed-->>RAG: クエリベクトル返却
    RAG->>LDB: 類似ドキュメント検索
    LDB-->>RAG: 類似ドキュメント（メタデータ含む）返却
    RAG->>LLM: コンテキスト付き質問送信
    LLM-->>RAG: 回答生成
    RAG->>FS: 会話履歴保存
    RAG-->>User: 回答表示
```

## 実装フローの詳細

### 1. データ取得と処理
- Confluenceから全ページデータを取得（約1000ページ）
  - 差分更新モード（`--differential`）では前回の同期以降に更新されたページのみを取得
- テキストをチャンクに分割（合計約2500チャンク）
- 各チャンクの埋め込みベクトルを生成（Xenova Transformersライブラリ使用、768次元、L2正規化）
- 生成したベクトルとメタデータをLanceDBに直接保存

### 2. データ保存
- LanceDBにベクトルとメタデータを保存（`.lancedb/`ディレクトリ）
  - メタデータには、タイトル、スペースキー、ラベル、コンテンツなどを含む
  - 検索時に必要なすべての情報をLanceDBに保存
- Firestoreには同期ログとユーザーデータのみ保存
  - 同期の開始・完了・エラー情報
  - ユーザーアカウント情報と会話履歴

### 3. 検索と回答生成
- ユーザーの質問をベクトル化（Xenova Transformersライブラリ使用、768次元、L2正規化）
- LanceDBで類似ドキュメントを検索
- LanceDBから直接メタデータを取得（Firestoreアクセス不要）
- 取得したコンテキストと質問をLLMに送信
- 生成された回答をユーザーに表示
- 会話履歴をFirestoreに保存

## 技術スタック

- **フロントエンド**: Next.js
- **バックエンド**: Next.js API Routes + Node.js Scripts
- **データベース**: 
  - Firestore（ユーザーデータ、会話履歴、ログ）
  - LanceDB（ベクトルデータ、検索メタデータ）
- **ベクトル生成**: Xenova Transformersライブラリ（ローカル埋め込み生成）
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
- **Node.js Scripts**: バッチ処理やスケジュールされたタスクを実行
- **Batch Processing**: Confluenceデータの定期同期処理

### データストア
- **Firestore**: ユーザーデータ、会話履歴、同期ログを保存
- **LanceDB**: ローカルベクトルデータベース（埋め込みベクトルとメタデータを保存）
  - ベクトル検索と検索結果表示に必要なすべてのデータを一元管理

### 外部サービス
- **Confluence API**: ドキュメントのソースデータを提供
- **Content Source**: ページ、スペース、ラベルなどの構造化コンテンツ
- **Google AI APIs**: AIモデルへのアクセスを提供
- **Gemini LLM**: 質問応答と要約生成のための大規模言語モデル

### ローカル処理
- **Xenova Transformers**: ローカルでの埋め込みベクトル生成
  - 外部APIに依存せず、コスト削減とプライバシー保護を実現