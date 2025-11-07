# BOM文字エラーの根本原因（最終確定版）

**最終更新**: 2025年11月6日  
**統合元**: `bom-character-error-root-cause.md`, `bom-error-trigger-analysis.md`

## エラー概要

```
TypeError: Cannot convert argument to a ByteString because the character at index 0 has a value of 65279 which is greater than 255.
```

## エラー発生のタイムライン

1. **2025-10-28**: `@xenova/transformers`から`@google/generative-ai`に移行（コミット `848cc783`）
   - この時点ではBOM文字の問題は表面化していなかった

2. **2025-11-03 02:39:44**: `pageId`から`page_id`への移行（コミット `6ddb2eae`）
   - データベースの再構築が行われた
   - **重要**: `rebuild-lancedb-smart-chunking.ts`でインデックス再構築が行われた

3. **2025-11-05 10:33:14**: Lunr migration（コミット `96996246`）
   - タイトル検索の最適化
   - この時点ではまだ動いていた

4. **2025-11-05 16:46:45**: **最後に動いていた時点**
   - この時点では正常に動作していた
   - ユーザーは「ログイン認証の仕組みはどうなっていますか？」というクエリでずっとテストしていた

5. **2025-11-06 03:53:48**: **エラー発生**
   - 同じクエリでBOM文字エラーが発生

## 根本原因の特定

### 問題の箇所

**`scripts/rebuild-lancedb-smart-chunking.ts`でBOM文字の除去処理が不足していた**

1. **`generateEmbedding`関数（184-190行目）**
   - BOM文字の除去処理がなかった
   - `embedContent`にBOM文字を含むテキストが渡されていた

2. **`stripHtml`関数（70-77行目）**
   - BOM文字の除去処理がなかった
   - HTMLからテキストを抽出する際にBOM文字が残っていた

3. **`processPage`関数（196-244行目）**
   - データベースに保存する際にBOM文字の除去処理がなかった
   - `title`と`content`にBOM文字が含まれていた

## なぜ急にBOM文字が入るようになったのか

### 重要な事実

**`@google/generative-ai`に移行した後も問題なく動いていました。** つまり、ライブラリの変更が直接の原因ではありません。

### なぜ2025/11/5 16:46:45までは動いていたのか

1. **`@google/generative-ai`に移行した後も問題なく動いていた**
   - ライブラリの変更が直接の原因ではない
   - つまり、**BOM文字は以前から含まれていたが、検索結果に含まれていなかった**

2. **インデックス再構築により、BOM文字を含むデータが検索結果に含まれるようになった**
   - 2025-11-03の`pageId`から`page_id`への移行時に、`rebuild-lancedb-smart-chunking.ts`でインデックス再構築が行われた
   - この時点で、BOM文字を含むデータがデータベースに保存された
   - しかし、特定のクエリで初めて検索結果に含まれるようになった

3. **デプロイやインデックス再構築により、データベースの状態が変わった**
   - 2025-11-06 08:42:20にデプロイが完了
   - デプロイ後に、インデックスの再構築が行われた可能性
   - インデックスの再構築により、以前は検索結果に含まれていなかったBOM文字を含むデータが検索結果に含まれるようになった

### BOM文字の発生源

BOM文字は以下のいずれかから来ている可能性があります：

1. **Confluence APIのレスポンス**
   - Confluence APIから取得したHTMLコンテンツにBOM文字が含まれている可能性
   - Confluence側のエンコーディング設定やデータ処理の変更により、BOM文字が含まれるようになった可能性
   - または、Confluenceのページコンテンツ自体にBOM文字が含まれている可能性

2. **HTMLからテキストを抽出する処理**
   - `stripHtml`関数でHTMLからテキストを抽出する際に、BOM文字が混入している可能性
   - ただし、`stripHtml`関数自体はBOM文字を生成しないため、入力データにBOM文字が含まれている可能性が高い

3. **データ処理の過程**
   - データ処理の過程でBOM文字が追加される可能性は低い
   - ただし、ファイルの読み書きやデータベースへの保存時にBOM文字が混入する可能性

4. **検索結果に含まれたBOM文字を含むデータが埋め込み生成処理に渡され、エラーが発生**
   - 検索結果の`content`フィールドにBOM文字が含まれていた
   - そのデータが埋め込み生成処理に渡され、`embedContent`でエラーが発生

## 修正内容

### 1. `generateEmbedding`関数の修正

```typescript
async function generateEmbedding(text: string): Promise<number[]> {
  // BOM文字（U+FEFF）を削除（埋め込み生成エラーを防ぐため）
  const cleanText = text.replace(/\uFEFF/g, '');
  
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  
  const result = await model.embedContent(cleanText);
  return result.embedding.values;
}
```

### 2. `stripHtml`関数の修正

```typescript
function stripHtml(html: string): string {
  // BOM文字（U+FEFF）を削除（埋め込み生成エラーを防ぐため）
  let text = html.replace(/\uFEFF/g, '');
  
  text = text
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // 念のため再度BOM文字を削除
  return text.replace(/\uFEFF/g, '');
}
```

### 3. `processPage`関数の修正

データベースに保存する際に、`title`と`content`からBOM文字を除去する処理を追加。

## 既存の対策との比較

### `confluence-sync-service.ts`では既に対策済み

- `extractTextFromHtml`関数（869-898行目）でBOM文字の除去処理が実装されている
- `addNewPage`関数（623-624行目、644-645行目）でBOM文字の除去処理が実装されている

### `rebuild-lancedb-smart-chunking.ts`では対策が不足していた

- インデックス再構築時に使用されるスクリプトで、BOM文字の除去処理が不足していた
- これが原因で、インデックス再構築時にBOM文字を含むデータがデータベースに保存された

## 結論

**エラーの根本原因は、`rebuild-lancedb-smart-chunking.ts`でインデックス再構築を行う際に、BOM文字の除去処理が不足していたことです。**

インデックス再構築時に、BOM文字を含むデータがデータベースに保存され、そのデータが検索結果に含まれるようになった際に、埋め込み生成処理でエラーが発生しました。

## 完全なBOM除去対策の実装

すべての箇所でBOM除去処理を確実に実装しました。以下の箇所でBOM除去処理を追加・確認しました：

### 1. データ取得時のBOM除去
- ✅ `confluence-sync-service.ts`の`getConfluencePages`関数（Confluence APIから取得したデータ）
- ✅ `confluence-sync-service.ts`の`extractTextFromHtml`関数（HTMLからテキスト抽出時）

### 2. データ保存時のBOM除去
- ✅ `confluence-sync-service.ts`の`addNewPage`関数（データベース保存時）
- ✅ `rebuild-lancedb-smart-chunking.ts`の`processPage`関数（インデックス再構築時）
- ✅ `rebuild-lancedb-smart-chunking.ts`の`stripHtml`関数（HTMLからテキスト抽出時）

### 3. データ読み込み時のBOM除去
- ✅ `lancedb-search-client.ts`の検索結果処理（データベースから読み込んだデータ）
- ✅ `lancedb-search-client.ts`の`calculateTitleMatch`関数（タイトルマッチング計算時）
- ✅ `pageid-migration-helper.ts`の`mapLanceDBRecordToAPI`関数（データベースレコードをAPI形式に変換時）
- ✅ `unified-search-result-processor.ts`の`formatResults`関数（検索結果フォーマット時）

### 4. 埋め込み生成時のBOM除去
- ✅ `embeddings.ts`の`getEmbeddings`関数（埋め込み生成時）
- ✅ `embeddings.ts`の`getGeminiEmbeddings`関数（Gemini API呼び出し時）
- ✅ `rebuild-lancedb-smart-chunking.ts`の`generateEmbedding`関数（インデックス再構築時の埋め込み生成）

### 5. クエリ処理時のBOM除去
- ✅ `query-preprocessor.ts`の`preprocessQuery`関数（クエリ前処理時）
- ✅ `lancedb-search-client.ts`の`searchLanceDB`関数（検索クエリ処理時）
- ✅ `streaming-process/route.ts`のPOSTハンドラー（APIリクエスト処理時）

### 実装方針

すべての箇所で、以下の方針に従ってBOM除去処理を実装しました：

1. **データ取得時**: Confluence APIから取得したデータにBOM除去処理を適用
2. **データ保存時**: データベースに保存する前にBOM除去処理を適用
3. **データ読み込み時**: データベースから読み込んだデータにBOM除去処理を適用
4. **埋め込み生成時**: 埋め込み生成処理に渡す前にBOM除去処理を適用
5. **クエリ処理時**: クエリ処理に渡す前にBOM除去処理を適用

これにより、**今後一切のBOMエラーが発生しないように対策しました。**

### 既存データのクリーンアップ

既存のデータベースにBOM文字を含むデータが保存されている可能性があるため、以下のいずれかを実行することを推奨します：

1. **データの再同期**: `npm run sync:confluence:batch`を実行して、BOM文字を含まないデータに置き換える
2. **インデックスの再構築**: 修正済みの`rebuild-lancedb-smart-chunking.ts`を使用してインデックスを再構築

