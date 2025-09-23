## ハイブリッド検索 契約（Contract）

### 入力（SearchParams）
- `query: string`
- `topK?: number`（既定: 12）
- `useLunrIndex?: boolean`（既定: false）
- `labelFilters?: { includeMeetingNotes: boolean; includeArchived: boolean }`
- `tableName?: string`（既定: `confluence`）

### 出力（SearchResult）必須項目
- `pageId: number`
- `title: string`
- `content: string`
- `labels: string[]`
- `url: string`
- `source: 'vector' | 'bm25' | 'hybrid' | 'title'`
- `scoreKind: 'vector' | 'bm25' | 'hybrid' | 'title'`
- `scoreRaw: number`
- `scoreText: string`（表示用: 例 `BM25 8.20` / `Vector 83.1%`）

### 処理フロー
1. 形態素/キーワード抽出（top 1-3）
2. ベクトル検索（早期ラベル除外）
3. BM25（Lunr）候補取得（必要ならフィルタ付き）
4. 候補結合→MMR多様化→RRF融合
5. 上位Nを`SearchResult`に整形

### 規約
- フィールド名・型は厳守（特に `pageId`）
- `scoreText` は 0 なら `BM25 0.00` のように明示
- 既定値は単一点管理（`defaultSearchParams`）


