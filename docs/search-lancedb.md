## LanceDB 検索・スキーマ仕様

### スキーマ（テーブル: `confluence`）
- `pageId: number`  ※小文字 i で統一
- `title: string`
- `content: string`
- `labels: string[]`
- `url: string`
- `space_key: string`
- `vector: number[] | Float32Array`
  - 次元数: 384（`src/lib/lancedb-schema.ts` の `FullLanceDBSchema` 準拠）

### クエリ規約
- ベクトル検索: `tbl.search(vector).limit(k)`
- キーワード/タイトル完全一致など、非ベクトルは `tbl.query().where(expr).limit(k)` を使用
- `pageId` 等価: 一部環境で `=` マッチが不安定なため、`"pageId" >= pid AND "pageId" < pid+1` をユーティリティで生成

### ラベルフィルタ
- 除外例: `['議事録','meeting-notes','アーカイブ','archive','スコープ外']`
- 早期に適用（ベクトル結果・BM25結果双方に）

### 出力整形
- `SearchResult` に射影: `source`, `scoreKind`, `scoreRaw`, `scoreText`, `pageId`, `title`, `content`, `labels`, `url`
- 文字列フィールドは取得直後に `String()` で正規化、比較時は小文字化


