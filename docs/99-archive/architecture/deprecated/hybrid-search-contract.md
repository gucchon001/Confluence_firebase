# ハイブリッド検索 契約（Contract）

## 更新履歴
- **2025年1月**: 現在の実装状況を反映
  - ストリーミング機能との統合
  - Firebase認証との連携
  - 最新の技術スタック情報

## 入力（SearchParams）
- `query: string`
- `topK?: number`（既定: 12）
- `useLunrIndex?: boolean`（既定: false）
- `labelFilters?: { includeMeetingNotes: boolean; includeArchived: boolean }`
- `tableName?: string`（既定: `confluence`）

## 出力（SearchResult）必須項目
- `pageId: number`
- `title: string`
- `content: string`
- `labels: string[]`
- `url: string`
- `source: 'vector' | 'bm25' | 'hybrid' | 'title'`
- `scoreKind: 'vector' | 'bm25' | 'hybrid' | 'title'`
- `scoreRaw: number`
- `scoreText: string`（表示用: 例 `BM25 8.20` / `Vector 83.1%`）

## 処理フロー
1. クエリ前処理（正規化、キーワード抽出）
2. 並列検索実行：
   - ベクトル検索（LanceDB 0.22.0、768次元）
   - BM25検索（Lunr.js 2.3.9、日本語トークナイザー）
   - キーワード検索（LanceDB LIKE句）
   - タイトル厳格一致検索
3. 結果統合・再ランキング
4. スコア計算・フィルタリング
5. 上位Nを`SearchResult`に整形

## 実装状況（2025年1月）
- ✅ ベクトル検索: 完全実装（768次元、Xenova Transformers）
- ✅ BM25検索: 完全実装（シングルトン問題解決済み）
- ✅ キーワード検索: 完全実装（LanceDB LIKE句）
- ✅ タイトル厳格一致検索: 完全実装
- ✅ ハイブリッド統合: 完全実装
- ✅ スコア計算: 統一されたスコア表示形式
- ✅ 関連性ソート: 動的な関連性スコアリング
- ✅ ストリーミング統合: リアルタイム検索結果表示

## 規約
- フィールド名・型は厳守（特に `pageId`）
- `scoreText` は 0 なら `BM25 0.00` のように明示
- 既定値は単一点管理（`defaultSearchParams`）
- ストリーミングAPIとの統合を考慮した設計


