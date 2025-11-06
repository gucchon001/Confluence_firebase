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

