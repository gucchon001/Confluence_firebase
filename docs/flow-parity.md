## スクリプト / 画面 フロー一致（Parity）

### 既定値の統一
- `topK = 12`
- `useLunrBM25 = true`
- `labelFilters = { includeMeetingNotes: false, includeArchived: false }`

### 呼び出し点
- スクリプト: `src/scripts/test-hybrid-search.ts` → `searchLanceDB(params)`
- 画面(UI): `src/app/api/search/route.ts`（ベクトル検索API）。ハイブリッドは `src/lib/rag-engine.ts` を介したユースケースで実行

### 比較観点
- 参照（references）件数
- `source` 分布（bm25/vector/hybrid）
- `scoreText` 表示
- ラベル除外の一致

### 防止策
- 既定値は単一点管理（`defaultSearchParams` は現行コードに未定義のため定義箇所を見直す）
- 回帰テストでスクリプト結果とAPI結果を差分比較


