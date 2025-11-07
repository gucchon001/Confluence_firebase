# BOM文字エラーの原因分析

## エラー概要

```
TypeError: Cannot convert argument to a ByteString because the character at index 0 has a value of 65279 which is greater than 255.
```

## ログから確認できる事実

### 1. エラー発生時の状況
- **エラーメッセージ**: `character at index 0 has a value of 65279`（BOM文字）
- **ログでの確認**: `hasBOM: false`, `bomIndex: -1`（BOM文字が検出されない）
- **firstCharCode**: `12525`（正常な日本語文字「ロ」）

### 2. 矛盾点
- `embedContent`に渡す時点ではBOM文字が検出されない
- しかし、`embedContent`内部でBOM文字（65279）が検出されている
- これは、`embedContent`が文字列を受け取って内部で処理する際に、何らかの変換処理が行われている可能性を示唆

## 原因の仮説

### 仮説1: GoogleGenerativeAIライブラリの内部処理問題（最も可能性が高い）

**問題点**:
- `@google/generative-ai`ライブラリの`embedContent`メソッドは、文字列を受け取ってprotobufのByteStringに変換する
- この変換処理（JavaScriptのUTF-16文字列 → UTF-8バイト列）の際に、何らかの問題が発生している可能性
- 特に、日本語文字（UTF-16で2バイト、UTF-8で3バイト）を処理する際に、BOM文字が混入している可能性

**根拠**:
- ログではBOM文字が検出されないのに、`embedContent`内部でBOM文字が検出される
- これは、ライブラリ内部の変換処理で問題が発生していることを示唆

### 仮説2: 文字列のエンコーディング変換時の問題

**問題点**:
- JavaScriptの文字列（UTF-16）からUTF-8バイト列への変換時に、BOM文字が混入している可能性
- `embedContent`が文字列を受け取る際に、内部的にBufferやTextEncoder/TextDecoderを使用して変換する際に、BOM文字が追加されている可能性

**根拠**:
- Buffer経由で処理することで、BOM文字を確実に除去できる可能性がある
- UTF-8バイト列（EF BB BF）としてBOM文字を検出・削除できる

### 仮説3: データベースからのデータにBOM文字が含まれている

**問題点**:
- LanceDBから取得したデータにBOM文字が含まれている可能性
- Confluence APIから取得したデータにBOM文字が含まれている可能性

**対策**:
- データベース保存時にBOM文字を削除する処理を追加済み
- Confluence APIからのデータ取得時にBOM文字を削除する処理を追加済み

## 解決策

### 1. Buffer経由での処理（実装済み）

```typescript
// Buffer経由でBOM文字を確実に除去（UTF-8バイト列として処理）
const textBuffer = Buffer.from(finalCleanText, 'utf8');
const bomBytes = Buffer.from([0xEF, 0xBB, 0xBF]);
if (textBuffer.subarray(0, 3).equals(bomBytes)) {
  cleanedBuffer = textBuffer.subarray(3);
}
finalCleanText = cleanedBuffer.toString('utf8');
```

**効果**:
- UTF-8バイト列レベルでBOM文字を検出・削除できる
- `embedContent`に渡す前に、確実にBOM文字を除去できる

### 2. 複数箇所でのBOM文字削除（実装済み）

- APIルートでの削除: `streaming-process/route.ts`
- データベース保存時の削除: `confluence-sync-service.ts`
- 埋め込み生成時の削除: `embeddings.ts`
- 検索処理時の削除: `lancedb-search-client.ts`
- クエリ前処理時の削除: `query-preprocessor.ts`

### 3. デバッグログの追加（実装済み）

- BOM文字検出時の詳細ログ
- `embedContent`呼び出し時のテキスト内容ログ
- Bufferレベルのバイト列ログ

## エラーが誘発された原因

### 変更履歴からの分析

**コミット**: `848cc783` (2025-10-28)
**変更内容**: `@xenova/transformers` から `@google/generative-ai` に移行

### 根本的な原因

1. **ライブラリの変更**
   - **変更前**: `@xenova/transformers`（ローカルモデル）
     - 文字列を直接処理し、BOM文字の問題が発生しなかった
   - **変更後**: `@google/generative-ai`（Gemini Embeddings API）
     - `embedContent`メソッドがprotobufのByteStringを期待
     - JavaScriptの文字列（UTF-16）からByteString（UTF-8バイト列）への変換時に問題が発生

2. **なぜ以前は発生しなかったのか**
   - `@xenova/transformers`はローカルモデルを使用し、文字列を直接処理
   - BOM文字があっても、モデル内部で処理されるため、エラーが発生しなかった
   - しかし、`@google/generative-ai`はprotobuf経由でAPIを呼び出すため、ByteStringへの変換が必要
   - この変換処理で、BOM文字がByteStringとして扱われず、エラーが発生

3. **なぜ今まで問題が表面化しなかったのか**
   - 移行直後は、BOM文字を含まないクエリが多かった可能性
   - 特定のクエリ（日本語文字が先頭に来る場合など）で初めて問題が表面化
   - または、データベースの同期時にBOM文字が混入した可能性

### エラー発生のタイミング

- **移行日**: 2025-10-28 (コミット `848cc783`)
- **エラー発見**: 2025-11-06（約1週間後）
- **最初のエラー報告**: 「ログイン認証の仕組みはどうなっていますか？」というクエリで発生

### なぜこのクエリで発生したのか

- 日本語文字「ロ」（文字コード12525）が先頭に来る
- `embedContent`が文字列をByteStringに変換する際、何らかの処理でBOM文字が混入
- または、`@google/generative-ai`ライブラリの内部処理で、日本語文字を処理する際に問題が発生

## 次のステップ

1. **Buffer経由の処理で解決するか確認**
   - デプロイ後、同じクエリで再実行
   - ログでBOM文字が完全に除去されているか確認

2. **解決しない場合の追加対策**
   - `@google/generative-ai`ライブラリのバージョンアップ
   - 代替の埋め込み生成方法の検討
   - ライブラリのソースコードを確認して、内部処理を理解

## 参考情報

- BOM文字（U+FEFF）: Unicode文字で、UTF-8ではEF BB BF（3バイト）として表現される
- ByteString: protobufの文字列型で、UTF-8バイト列として扱われる
- JavaScriptの文字列: UTF-16エンコーディングで内部的に表現される
- 移行履歴: `@xenova/transformers` → `@google/generative-ai` (2025-10-28)

