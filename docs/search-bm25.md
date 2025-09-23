## BM25 / Lunr 検索 仕様

- 目的: Confluence本文/タイトルに対するキーワード検索の一次候補抽出（BM25相当）、および UI/スクリプト間の挙動統一。

### インデックス
- エンジン: `lunr@2.x`
- 対象フィールド: `title`(boost 2.0), `content`(boost 1.0)
- 追加メタ情報: `pageId:number`, `labels:string[]`, `url:string`, `space_key?:string`
- 正規化: 全角/半角・空白トリム、ひらがな/カタカナはそのまま（形態素は別段階）

### クエリ
- エントリポイント:
  - `searchCandidates(query: string, limit: number = 50): Promise<LunrSearchResult[]>`
  - `searchWithFilters(query: string, filters: { labels?: string[]; excludeLabels?: string[] } = {}, limit: number = 50): Promise<LunrSearchResult[]>`
- 入力: ユーザーの自然文 `query`（前段の抽出で top 1-3 keywords を渡す実装も可）
- フィルタ: `excludeLabels` は Low/Archive/Meeting などを除外、`labels` は特定ラベルのみを含める

### 返却
- 候補: `{ pageId, score, title, snippet?, labels, url }[]`（score は BM25 スコア）
- 実装側で `pageId` により LanceDB 詳細を join して `SearchResult` に整形

### 留意点
- インデックス初期化: アプリ起動時に非同期で実施。未初期化時は LIKE 検索にフォールバック可
- 用語の大文字・小文字: そのまま保持。マッチ判定は小文字化比較
- API は上記2関数に限定して使用（その他の内部関数は使用禁止）


