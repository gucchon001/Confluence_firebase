# Phase 0A: 基盤強化 - 実装計画書

**バージョン**: 1.0  
**作成日**: 2025年10月11日  
**ステータス**: 計画確定

---

## 1. 概要

本ドキュメントは、「基盤強化優先戦略（Foundation First）」に基づき、Phase 0Aで実施する具体的な実装タスク、アーキテクチャ設計、および成果物を定義する。

## 2. アーキテクチャ方針（合意事項）

1.  **独立バッチ処理**: ラベル付けとKG構築は、Confluence同期とは独立したPub/SubトリガーのCloud Functionsとして実装する。
2.  **モデル品質**: ラベル付けモデルは `gemini-1.5-flash` を使用。特別なレビュープロセスは設けない。
3.  **ラベル移行**: LLMを活用したワンタイムのマイグレーションスクリプトで旧ラベルを新`StructuredLabel`へ移行する。
4.  **UI変更なし**: フィルタリングUIの変更は当面見送る。
5.  **ページリンク活用**: Confluenceページ間のリンクをKGの`RELATES_TO`関係性として取り込む。
6.  **評価データ準備**: 検索結果の統合重み付け調整のため、評価データセットを準備する。
7.  **適応的エンティティ抽出**: クエリからのエンティティ抽出は、まず高速なキーワードマッチを行い、失敗した場合のみLLMを呼び出す「適応的（Adaptive）」アプローチを採用する。

---

## 3. 実装タスク詳細

### Phase 0A-1: ラベルシステム拡張 (2週間)

#### 1.1. スキーマ定義
- **ファイル**: `src/types/structured-label.ts` (新規作成)
- **内容**: `StructuredLabel`インターフェースを定義する。
  ```typescript
  export interface StructuredLabel {
    category: 'spec' | 'ticket' | 'manual' | 'data';
    domain: string;
    feature: string;
    priority: 'high' | 'medium' | 'low' | 'unknown';
    status: 'draft' | 'review' | 'approved' | 'deprecated' | 'unknown';
    version?: string;
    tags?: string[];
  }
  ```
- **ドキュメント**: `docs/architecture/structured-label-design.md` (新規作成)

#### 1.2. 自動ラベル付けFlow
- **ファイル**: `functions/src/ai/flows/auto-label-flow.ts` (新規作成)
- **内容**: Confluenceのページコンテンツを入力とし、`StructuredLabel`をJSONで出力するGenkit Flowを実装する。

#### 1.3. データモデル更新
- **ファイル**: `src/lib/firestore-admin.ts`, `src/lib/lancedb-client.ts` (修正)
- **内容**: FirestoreとLanceDBのスキーマを更新し、`StructuredLabel`を保存できるようにする。LanceDBでは、フィルタリングのために主要なラベル要素（domain, feature）を独立したカラムとして保存する。

#### 1.4. `LabelManagerV2` の実装
- **ファイル**: `src/lib/label-manager-v2.ts` (新規作成)
- **内容**: `StructuredLabel`を扱う新しい`LabelManagerV2`を実装する。

#### 1.5. ラベル移行スクリプト
- **ファイル**: `scripts/migration/migrate-labels.ts` (新規作成)
- **内容**: 全ドキュメントを読み込み、既存の`string[]`ラベルと内容から新しい`StructuredLabel`を生成し、DBを更新するワンタイムスクリリプト。

---

### Phase 0A-2: Knowledge Graph構築 (3〜4週間)

#### 2.1. スキーマ定義
- **ファイル**: `src/types/knowledge-graph.ts` (新規作成)
- **内容**: `KgNode`と`KgEdge`の型を定義する。
  ```typescript
  export type NodeType = 'Function' | 'SystemItem' | 'Keyword' | 'Page' | 'Label';
  export type EdgeType = 'DESCRIBES' | 'CONTAINS' | 'RELATES_TO' | 'ASSOCIATED_WITH' | 'TAGGED_WITH';
  
  export interface KgNode {
    id: string; // e.g., 'page-12345' or 'function-classroom-management'
    type: NodeType;
    name: string;
    properties?: Record<string, any>;
  }

  export interface KgEdge {
    source: string; // id of source node
    target: string; // id of target node
    type: EdgeType;
  }
  ```
- **ドキュメント**: `docs/architecture/knowledge-graph-schema.md` (新規作成)

#### 2.2. KG構築プロセスの実装
- **ファイル**: `functions/src/kg-builder.ts` (新規作成)
- **内容**: Pub/Subトリガーで起動するCloud Function。
  1. `domain-knowledge`とFirestoreから全ページ情報を取得。
  2. Confluenceページ間のリンクを解析。
  3. ノードとエッジを生成。
  4. LanceDBの`kg_nodes`と`kg_edges`テーブルに保存。

#### 2.3. グラフ検索API
- **ファイル**: `src/lib/graph-search-client.ts` (新規作成)
- **内容**: LanceDB上のノードとエッジのテーブルを検索し、特定のエンティティに関連する情報を取得するクライアント。

---

### Phase 0A-3: パフォーマンス・品質最適化 (2週間)

#### 3.1. 検索アーキテクチャの再設計
- **ファイル**: `src/lib/search-orchestrator.ts` (新規作成)
- **内容**: `SearchOrchestrator`を実装。
  1. クエリを受け取り、「適応的エンティティ抽出」を実行。
  2. Vector, BM25, Keyword, Graphの各検索クライアントを並列で呼び出す。
  3. `ResultFuser`を呼び出して結果を統合・リランキングする。

#### 3.2. 適応的エンティティ抽出の実装
- **ファイル**: `src/lib/entity-extractor.ts` (新規作成)
- **内容**: クエリからエンティティを抽出するロジック。KGのエンティティリストとの完全一致検索をまず行い、失敗したらLLMを呼び出す。

#### 3.3. 評価データセットの作成
- **ファイル**: `src/tests/evaluation/dataset.json` (新規作成)
- **内容**: 様々な種類のクエリと、それに対する理想的な検索結果（ページのIDなど）をペアにした評価用JSONデータ。
- **ファイル**: `scripts/run-evaluation.ts` (新規作成)
- **内容**: `dataset.json`を元に検索を実行し、精度（MRR, nDCGなど）を計算して、最適な統合重み付けを見つけるためのスクリプト。

---

## 4. 更新されるデータフロー

```mermaid
graph TD
    subgraph "Daily/Weekly Schedule"
        A[Firebase Scheduler] --> B(1. Confluence Sync Function);
        A --> C(2. Auto-Labeling Function);
        A --> D(3. KG Build Function);
    end
    
    B -- "Pub/Sub: pages_synced" --> C;
    C -- "Pub/Sub: labels_updated" --> D;

    subgraph "Search Pipeline"
        E[User Query] --> F[Search Orchestrator];
        F --> G[Adaptive Entity Extractor];
        G --> H((Knowledge Graph));
        G --> I{LLM (if needed)};
        
        F --> J[Vector Search];
        F --> K[BM25/Keyword Search];
        F --> L[Graph Search];
        
        J --> M[Result Fuser];
        K --> M;
        L --> M;
        M --> N[Final Answer];
    end
```
