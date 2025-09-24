# Confluence Vector Search システム設計図 (LanceDB版)

このドキュメントでは、LanceDBを使用したConfluence Vector Search システムのコンポーネント図、データフロー図、シーケンス図を示します。

## 更新履歴
- **2024年12月**: 現在の実装に合わせて最新化
  - 埋め込みモデル: paraphrase-multilingual-mpnet-base-v2（768次元）
  - LLM: Gemini API (gemini-2.5-flash)
  - ハイブリッド検索: ベクトル検索 + BM25検索 + キーワード検索
  - 日本語対応: Kuromojiトークナイザー使用
  - ドメイン知識抽出システム: 8,122個のキーワードを管理する知識ベース
  - 動的キーワード抽出器: クエリに応じた動的な検索精度向上

## コンポーネント図

```mermaid
graph TB
    subgraph "フロントエンド"
        A[Next.js UI] --- B[Chat Page]
        B --- C[RAG Components]
    end
    
    subgraph "バックエンド"
        D[Next.js API Routes] --- E[AI API Routes]
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
        N2[Lunr.js] --- N3[BM25検索]
        U[ドメイン知識DB] --- V[動的キーワード抽出器]
    end
    
    %% コンポーネント間の関係
    C -.-> |"API呼び出し"| D
    E -.-> |"Gemini API呼び出し"| P
    G -.-> |"データ取得"| N
    G -.-> |"埋め込み生成"| S
    G -.-> |"ベクトル/メタデータ保存"| L
    D -.-> |"ユーザーデータ取得"| H
    D -.-> |"ハイブリッド検索"| L
    D -.-> |"BM25検索"| N2["Lunr.js"]
    L -.-> |"キーワード抽出"| V
    V -.-> |"ドメイン知識参照"| U
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
    
    I[ユーザークエリ] -->|7. 質問| J[ハイブリッド検索フロー]
    J -->|8a. クエリベクトル化| D
    J -->|8b. 動的キーワード抽出| W[動的キーワード抽出器]
    W -->|8c. ドメイン知識参照| X[ドメイン知識DB]
    J -->|9a. ベクトル検索| E
    J -->|9b. キーワード検索| E
    J -->|9c. BM25検索| V[Lunr.js]
    J -->|9d. タイトル厳格一致検索| E
    E -->|10a. ベクトル検索結果| J
    E -->|10b. キーワード検索結果| J
    V -->|10c. BM25検索結果| J
    E -->|10d. タイトル検索結果| J
    J -->|11. スコアリング統合・重複除去| Y[結果統合]
    Y -->|12. 統合検索結果| J
    J -->|13. コンテキスト生成| K[LLM API]
    K -->|14. 回答生成| J
    J -->|15. 回答| I
    J -->|16. 会話履歴保存| Z
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
    participant LLM as Gemini API
    participant DK as ドメイン知識DB
    participant KW as 動的キーワード抽出器

    %% データ同期フロー
    User->>Batch: 同期処理開始（通常/差分/削除スキップ）
    Batch->>FS: 同期ログ記録開始
    Batch->>Confluence: ページデータ取得（差分更新の場合は変更ページのみ）
    Confluence-->>Batch: ページデータ返却
    loop 各ページ
        Batch->>Batch: テキスト分割
        loop 各チャンク
            Batch->>Embed: テキスト埋め込み生成（768次元、L2正規化）
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
    
    %% ハイブリッド検索・回答生成フロー
    User->>RAG: 質問入力
    RAG->>Embed: クエリテキスト埋め込み生成（768次元、L2正規化）
    Embed-->>RAG: クエリベクトル返却
    RAG->>KW: 動的キーワード抽出要求
    KW->>DK: ドメイン知識参照
    DK-->>KW: 関連キーワード返却
    KW-->>RAG: 抽出キーワード返却
    par 並列検索実行
        RAG->>LDB: ベクトル検索（意味的類似性）
        LDB-->>RAG: ベクトル検索結果
    and
        RAG->>LDB: キーワード検索（LIKE句）
        LDB-->>RAG: キーワード検索結果
    and
        RAG->>Lunr: BM25検索（全文検索）
        Lunr-->>RAG: BM25検索結果
    and
        RAG->>LDB: タイトル厳格一致検索
        LDB-->>RAG: タイトル検索結果
    end
    RAG->>RAG: 早期ラベルフィルタリング
    RAG->>RAG: スコアリング統合（キーワード・ラベル・ハイブリッド）
    RAG->>RAG: 重複除去・結果統合
    RAG->>LLM: コンテキスト付き質問送信（Gemini API）
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

### 3. ハイブリッド検索と回答生成
- ユーザーの質問をベクトル化（Xenova Transformersライブラリ使用、768次元、L2正規化）
- 動的キーワード抽出（ドメイン知識データベースから関連キーワードを抽出・分類）
- 並列実行による複数検索ソースの組み合わせ：
  - **ベクトル検索**: LanceDBで類似ベクトル検索（意味的類似性）
  - **キーワード検索**: LanceDBのLIKE句によるタイトル・コンテンツ検索
  - **BM25検索**: Lunr.jsによる全文検索（BM25アルゴリズム）
  - **タイトル厳格一致検索**: タイトルがクエリに完全一致する検索
- 早期ラベルフィルタリング（議事録、アーカイブ等の除外）
- スコアリング統合（キーワードスコア、ラベルスコア、ハイブリッドスコア）
- 重複除去と結果統合
- LanceDBから直接メタデータを取得（Firestoreアクセス不要）
- 取得したコンテキストと質問をGemini APIに送信
- 生成された回答をユーザーに表示
- 会話履歴をFirestoreに保存

## 技術スタック

- **フロントエンド**: Next.js
- **バックエンド**: Next.js API Routes + Node.js Scripts
- **データベース**: 
  - Firestore（ユーザーデータ、会話履歴、ログ）
  - LanceDB（ベクトルデータ、検索メタデータ）
- **検索エンジン**: ハイブリッド検索システム
  - ベクトル検索: LanceDBによる意味的類似性検索
  - キーワード検索: LanceDBのLIKE句による部分一致検索
  - BM25検索: Lunr.jsによる全文検索
  - タイトル厳格一致検索: 完全一致による高精度検索
- **ベクトル生成**: Xenova Transformersライブラリ（paraphrase-multilingual-mpnet-base-v2、768次元）
- **LLM**: Google AI Gemini API (gemini-2.5-flash)
- **AI Framework**: 現在は直接API呼び出し（Genkit統合予定）

## コンポーネントの詳細説明

### フロントエンド
- **Next.js UI**: Reactベースのフロントエンドフレームワーク
- **Chat Page**: ユーザーとのチャットインターフェース
- **RAG Components**: 検索結果表示や回答生成のUIコンポーネント

### バックエンド
- **Next.js API Routes**: フロントエンドからのAPIリクエストを処理
- **AI API Routes**: Gemini APIとの直接連携（Genkit統合予定）
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
- **Gemini LLM**: 質問応答と要約生成のための大規模言語モデル（gemini-2.5-flash）

### ローカル処理
- **Xenova Transformers**: ローカルでの埋め込みベクトル生成
  - paraphrase-multilingual-mpnet-base-v2モデル使用（768次元）
  - 外部APIに依存せず、コスト削減とプライバシー保護を実現
- **Lunr.js**: ローカルでのBM25全文検索
  - 軽量なJavaScript検索ライブラリ
  - インデックス構築とBM25アルゴリズムによる関連性スコアリング
  - 日本語テキスト対応（Kuromojiトークナイザー使用）

- **ドメイン知識データベース**: システム仕様書から抽出された構造化知識
  - 8,122個のキーワードを管理（1,067ページから抽出）
  - 6つのカテゴリ: ドメイン名、機能名、操作名、システム項目、システム用語、関連キーワード
  - 重複削除機能による高品質な知識ベース

- **動的キーワード抽出器**: クエリに応じた動的なキーワード抽出
  - ドメイン知識データベースから関連キーワードを抽出
  - 動的優先度管理による検索精度向上
  - クエリの意図に応じた適切なキーワード分類