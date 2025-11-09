# BOM除去ができていない可能性のある要因分析

**作成日**: 2025-11-07  
**最終更新**: 2025-11-09（Gemini APIキーサニタイズ対応後の備考を追記）  
**目的**: BOM除去処理が正しく機能していない可能性のある要因を分析（※本稿は調査過程の記録です）

> **2025-11-09 追記**  
> 本番で発生していた ByteString 例外の最終原因は、Gemini API キー自体に混入した BOM でした。  
> 最新の対策は `docs/analysis/bom-error-root-cause-final.md` を参照してください。本ページの内容はデータ側の仮説を整理した履歴として保持しています。

## エラー状況

本番環境で以下のエラーが発生：
```
TypeError: Cannot convert argument to a ByteString because the character at index 0 has a value of 65279 which is greater than 255.
```

BOM除去処理は実装されているが、エラーが発生している。

## 重要な前提条件

- ✅ **ローカル環境では正常に動作している**
- ✅ **データベースはローカル環境のものをアップロードしている**
- ❌ **本番環境でのみエラーが発生**

この前提条件から、**データベース自体にBOMが含まれている可能性は低い**。本番環境特有の問題に焦点を当てる必要がある。

## 考えられる要因

### 1. **キャッシュキーの問題（最も可能性が高い）**

**問題点**:
- `getEmbeddings`関数で、キャッシュキーは`text.substring(0, 100)`を使用
- BOM除去処理はキャッシュチェックの**後**に実行される
- しかし、キャッシュキーはBOM除去**前**のテキストを使用している

**影響**:
- BOMを含むテキストとBOMを含まないテキストで異なるキャッシュキーが生成される
- キャッシュから取得した場合はBOM除去処理をスキップするが、キャッシュに保存する際にBOM除去後のテキストを使用している
- ただし、キャッシュから取得する場合はBOM除去処理をスキップしているため、問題ないはず

**確認方法**:
- キャッシュキーの生成タイミングを確認
- BOM除去前と後のテキストでキャッシュキーが異なることを確認

### 2. **BOM除去処理のタイミングの問題**

**問題点**:
- `getEmbeddings`関数でBOM除去処理を実行
- その後、`getGeminiEmbeddings`関数でもBOM除去処理を実行
- しかし、`getGeminiEmbeddings`関数に渡されるテキストにBOMが含まれている可能性

**影響**:
- BOM除去処理が正しく機能していない可能性
- または、BOM除去処理の後にBOMが再び追加されている可能性

**確認方法**:
- `getGeminiEmbeddings`関数に渡されるテキストにBOMが含まれているか確認
- BOM除去処理の前後でテキストを比較

### 3. **文字列のエンコーディングの問題**

**問題点**:
- JavaScriptの文字列はUTF-16でエンコードされている
- BOM文字（\uFEFF）はUTF-16の文字として扱われる
- しかし、`replace(/\uFEFF/g, '')`が正しく機能していない可能性

**影響**:
- BOM除去処理が正しく機能していない可能性
- または、BOM文字が別の形式でエンコードされている可能性

**確認方法**:
- BOM文字の文字コードを確認（65279 = 0xFEFF）
- `replace(/\uFEFF/g, '')`が正しく機能しているか確認

### 4. **サロゲートペアの問題**

**問題点**:
- JavaScriptの文字列はUTF-16でエンコードされている
- サロゲートペア（2つの16ビット値で1つの文字を表現）の場合、`charCodeAt(0)`が正しく機能しない可能性

**影響**:
- BOM文字の検出が正しく機能していない可能性
- ただし、BOM文字（\uFEFF）はサロゲートペアではないため、この問題は発生しないはず

**確認方法**:
- BOM文字の文字コードを確認（65279 = 0xFEFF）
- `charCodeAt(0)`が正しく機能しているか確認

### 5. **HTTPリクエストボディのエンコーディング処理（本番環境特有・最も可能性が高い）**

**問題点**:
- 本番環境では、HTTPリクエストボディがUTF-8でエンコードされているが、BOMが含まれている可能性がある
- `req.json()`でパースする際に、BOMが含まれている可能性がある
- ローカル環境では発生しないが、本番環境（Cloud Run）では発生する可能性がある

**影響**:
- HTTPリクエストボディから取得した`question`にBOMが含まれている可能性
- `src/app/api/streaming-process/route.ts`でBOM除去処理を実行しているが、実行される前にBOMが含まれている可能性
- または、BOM除去処理の後にBOMが再び追加されている可能性

**確認方法**:
- 本番環境のログで`[BOM DETECTED]`を検索して、HTTPリクエストボディにBOMが含まれているか確認
- `req.json()`でパースする前後でBOMをチェック
- HTTPリクエストヘッダーの`Content-Type`や`Content-Encoding`を確認

**修正方法**:
- `req.json()`でパースする前に、リクエストボディを文字列として取得してBOMを除去
- または、`req.json()`でパースした後、すべての文字列フィールドからBOMを除去

### 6. **キャッシュの問題（本番環境特有）**

**問題点**:
- 本番環境では、複数のインスタンスが動作している可能性がある
- 各インスタンスでキャッシュが独立しているため、キャッシュから取得した場合にBOM除去処理をスキップしている可能性
- キャッシュキーはBOM除去**前**のテキストを使用しているが、キャッシュから取得した場合はBOM除去処理をスキップしている

**影響**:
- キャッシュから取得した場合、BOM除去処理が実行されない
- キャッシュに保存する際にBOM除去後のテキストを使用しているが、キャッシュキーはBOM除去前のテキストを使用しているため、不一致が発生する可能性

**確認方法**:
- 本番環境のログで`🚀 埋め込みベクトルをキャッシュから取得`を検索して、キャッシュから取得した場合にBOMが含まれているか確認
- キャッシュキーの生成タイミングを確認

**修正方法**:
- キャッシュキーもBOM除去後のテキストを使用する
- または、キャッシュから取得した場合もBOM除去処理を実行する

### 7. **本番環境特有のリクエスト処理**

**問題点**:
- 本番環境では、プロキシ、ロードバランサー、CDNなどがリクエストを処理している可能性がある
- これらのミドルウェアがリクエストボディにBOMを追加している可能性がある
- または、リクエストボディのエンコーディングを変更している可能性がある

**影響**:
- HTTPリクエストボディにBOMが含まれている可能性
- または、リクエストボディのエンコーディングが変更されている可能性

**確認方法**:
- 本番環境のログでHTTPリクエストヘッダーを確認
- プロキシやロードバランサーの設定を確認

### 8. **Node.jsバージョンや文字列処理の違い**

**問題点**:
- 本番環境とローカル環境でNode.jsバージョンが異なる可能性がある
- Node.jsバージョンによって、文字列処理の挙動が異なる可能性がある
- または、V8エンジンのバージョンが異なる可能性がある

**影響**:
- BOM除去処理の挙動が異なる可能性
- ただし、基本的な文字列処理は同じはずなので、この問題は発生しない可能性が高い

**確認方法**:
- 本番環境とローカル環境のNode.jsバージョンを確認
- 文字列処理の挙動を比較

## 最も可能性が高い要因（本番環境特有）

### **要因1: HTTPリクエストボディのエンコーディング処理（最も可能性が高い）**

本番環境では、HTTPリクエストボディがUTF-8でエンコードされているが、BOMが含まれている可能性がある。`req.json()`でパースする際に、BOMが含まれている可能性がある。

**修正方法**:
- `req.json()`でパースする前に、リクエストボディを文字列として取得してBOMを除去
- または、`req.json()`でパースした後、すべての文字列フィールドからBOMを除去
- `src/app/api/streaming-process/route.ts`でBOM除去処理を実行しているが、実行される前にBOMが含まれている可能性があるため、より早期にBOM除去処理を実行する

### **要因2: キャッシュの問題**

本番環境では、複数のインスタンスが動作している可能性がある。各インスタンスでキャッシュが独立しているため、キャッシュから取得した場合にBOM除去処理をスキップしている可能性がある。

**修正方法**:
- キャッシュキーもBOM除去後のテキストを使用する
- または、キャッシュから取得した場合もBOM除去処理を実行する

## 推奨される修正方法（優先順位順）

### 1. **HTTPリクエストボディのBOM除去処理を強化**（最優先）

`src/app/api/streaming-process/route.ts`で、`req.json()`でパースする前に、リクエストボディを文字列として取得してBOMを除去する。

```typescript
// 修正前
const body = await req.json();
let { question, chatHistory = [], labelFilters = { includeMeetingNotes: false } } = body;

// 修正後
const bodyText = await req.text();
const cleanBodyText = bodyText.replace(/\uFEFF/g, '');
const body = JSON.parse(cleanBodyText);
let { question, chatHistory = [], labelFilters = { includeMeetingNotes: false } } = body;
```

### 2. **キャッシュキーをBOM除去後のテキストで生成**

`src/lib/embeddings.ts`で、キャッシュキーをBOM除去後のテキストで生成する。

```typescript
// 修正前
const cacheKey = `embedding:${text.substring(0, 100)}`;

// 修正後
// BOM除去処理の後にキャッシュキーを生成
const cacheKey = `embedding:${text.substring(0, 100)}`;
```

### 3. **キャッシュから取得した場合もBOM除去処理を実行**

`src/lib/embeddings.ts`で、キャッシュから取得した場合もBOM除去処理を実行する。

```typescript
// 修正前
if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) {
  return cached.embedding;
}

// 修正後
if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) {
  // キャッシュから取得した場合もBOM除去処理を実行（念のため）
  const cleanText = text.replace(/\uFEFF/g, '');
  if (cleanText !== text) {
    console.warn(`🔍 [BOM REMOVED FROM CACHED] BOM removed from cached text`);
  }
  return cached.embedding;
}
```

### 4. **BOM検出ログを追加**（既に実装済み）

BOM検出ログを追加して、BOMが検出された場合にログを出力する。

## 根本原因の特定（コード確認結果）

### 実装状況の確認

コードを確認した結果、以下のことが判明しました：

1. **HTTPリクエストボディのBOM除去処理は実装済み**
   - `src/app/api/streaming-process/route.ts`の203-226行目で、`req.text()`でリクエストボディを取得してBOM除去処理を実装
   - `question`変数にもBOM除去処理を実装（304-314行目）

2. **キャッシュキーの生成はBOM除去後のテキストで実装済み**
   - `src/lib/embeddings.ts`の87-90行目で、キャッシュキーをBOM除去後のテキストで生成
   - キャッシュから取得した場合もBOM除去処理を実装（97-116行目）

3. **`getGeminiEmbeddings`関数でのBOM除去処理は実装済み**
   - `src/lib/embeddings.ts`の206-377行目で、`embedContent`を呼び出す前に複数回BOM除去処理を実装
   - 最終確認ログも実装（339-360行目）

### 問題の可能性

**最も可能性が高い原因：`embedContent`呼び出し直前にBOMが再び混入している可能性**

1. **`embedContent`呼び出し直前のチェックが不十分**
   - `getGeminiEmbeddings`関数では、`embedContent`を呼び出す前に複数回BOM除去処理を実装しているが、エラーが発生しているということは、`embedContent`に渡されるテキストの先頭にBOMが含まれている可能性がある
   - エラーメッセージ「character at index 0 has a value of 65279」は、`embedContent`に渡されるテキストの先頭にBOMが含まれていることを示している

2. **本番環境特有の問題**
   - 本番環境では、複数のインスタンスが動作している可能性がある
   - 各インスタンスでキャッシュが独立しているため、キャッシュから取得した場合にBOM除去処理をスキップしている可能性がある
   - しかし、コードを確認した結果、キャッシュから取得した場合もBOM除去処理を実装しているため、この問題は発生しないはず

3. **データベースから取得したデータにBOMが含まれている可能性**
   - `retrieve-relevant-docs-lancedb.ts`では、検索結果に`removeBOM`関数を適用している（275行目、279行目）
   - しかし、検索結果の`content`フィールドが`getEmbeddings`に渡される際に、BOMが再び混入している可能性がある

### 推測される根本原因

**`embedContent`呼び出し直前にBOMが再び混入している可能性が最も高い**

1. **`getGeminiEmbeddings`関数でのBOM除去処理のタイミング**
   - `getGeminiEmbeddings`関数では、`embedContent`を呼び出す前に複数回BOM除去処理を実装しているが、エラーが発生しているということは、`embedContent`に渡されるテキストの先頭にBOMが含まれている可能性がある
   - エラーメッセージ「character at index 0 has a value of 65279」は、`embedContent`に渡されるテキストの先頭にBOMが含まれていることを示している

2. **本番環境特有の問題**
   - 本番環境では、複数のインスタンスが動作している可能性がある
   - 各インスタンスでキャッシュが独立しているため、キャッシュから取得した場合にBOM除去処理をスキップしている可能性がある
   - しかし、コードを確認した結果、キャッシュから取得した場合もBOM除去処理を実装しているため、この問題は発生しないはず

3. **データベースから取得したデータにBOMが含まれている可能性**
   - `retrieve-relevant-docs-lancedb.ts`では、検索結果に`removeBOM`関数を適用している（275行目、279行目）
   - しかし、検索結果の`content`フィールドが`getEmbeddings`に渡される際に、BOMが再び混入している可能性がある

## 確認方法

1. **本番環境のログで`[BOM DETECTED]`を検索**
   - `[BOM DETECTED IN getEmbeddings]`
   - `[BOM DETECTED IN getGeminiEmbeddings]`
   - `[BOM DETECTED] searchLanceDB received query with BOM`
   - `[BOM DETECTED IN LANCEDB DATA]`
   - `[INVALID CHAR DETECTED IN getEmbeddings]`
   - `[INVALID CHAR DETECTED IN QUESTION]`

2. **HTTPリクエストボディにBOMが含まれているか確認**
   - `req.json()`でパースする前後でBOMをチェック
   - HTTPリクエストヘッダーの`Content-Type`や`Content-Encoding`を確認

3. **キャッシュから取得した場合にBOMが含まれているか確認**
   - 本番環境のログで`🚀 埋め込みベクトルをキャッシュから取得`を検索
   - キャッシュから取得した場合にBOMが含まれているか確認

4. **BOM除去処理の前後でテキストを比較**
   - BOM除去処理の前後でテキストを比較して、BOM除去処理が正しく機能しているか確認

5. **`embedContent`呼び出し直前のテキストを確認**
   - `getGeminiEmbeddings`関数の390行目で`embedContent`を呼び出す直前のテキストを確認
   - エラーログで`[FINAL CHECK FAILED]`や`[CRITICAL]`を検索
   - エラーログで`[CRITICAL BOM DETECTED BEFORE embedContent]`を検索（新規追加）

## 追加された対策

### `embedContent`呼び出し直前の最終チェックを追加

`src/lib/embeddings.ts`の362-387行目で、`embedContent`を呼び出す直前に、テキストの先頭にBOMが含まれていないか最終確認を追加しました。

```362:387:src/lib/embeddings.ts
  // 🔍 最終確認: embedContentに渡す直前に、テキストの先頭にBOMが含まれていないか確認
  const veryLastCheckFirstCharCode = finalText.length > 0 ? finalText.charCodeAt(0) : -1;
  if (veryLastCheckFirstCharCode === 0xFEFF || veryLastCheckFirstCharCode > 255) {
    const deploymentInfo = getDeploymentInfo();
    console.error(`🚨 [CRITICAL BOM DETECTED BEFORE embedContent] Text still has BOM or invalid character before embedContent call:`, {
      deploymentTime: deploymentInfo.deploymentTime,
      deploymentTimestamp: deploymentInfo.deploymentTimestamp,
      uptime: deploymentInfo.uptime,
      firstCharCode: veryLastCheckFirstCharCode,
      isBOM: veryLastCheckFirstCharCode === 0xFEFF,
      textLength: finalText.length,
      textPreview: finalText.substring(0, 100),
      charCodes: Array.from(finalText.substring(0, 10)).map(c => c.charCodeAt(0)),
      hexCode: `0x${veryLastCheckFirstCharCode.toString(16).toUpperCase()}`
    });
    // 最後の手段: BOM文字を強制的に削除
    finalText = finalText.replace(/\uFEFF/g, '').trim();
    if (finalText.length === 0) {
      finalText = 'No content available';
    }
    console.warn(`🔧 [FORCE REMOVED BOM] BOM forcefully removed before embedContent:`, {
      afterFirstCharCode: finalText.length > 0 ? finalText.charCodeAt(0) : -1,
      afterLength: finalText.length,
      afterPreview: finalText.substring(0, 50)
    });
  }
```

この対策により、`embedContent`を呼び出す直前に、テキストの先頭にBOMが含まれている場合、エラーログを出力し、強制的にBOMを除去します。

## 次のステップ

1. **本番環境でエラーログを確認**
   - `[CRITICAL BOM DETECTED BEFORE embedContent]`を検索して、`embedContent`呼び出し直前にBOMが検出された場合のログを確認
   - `[INVALID CHAR DETECTED IN getEmbeddings]`を検索して、`getEmbeddings`関数に渡されるテキストにBOMが含まれている場合のログを確認
   - `[INVALID CHAR DETECTED IN QUESTION]`を検索して、HTTPリクエストボディから取得した`question`にBOMが含まれている場合のログを確認

2. **エラーログから原因を特定**
   - エラーログから、BOMが検出された箇所を特定
   - BOMが検出された箇所から、BOMが混入した原因を特定

3. **原因に応じた対策を実施**
   - BOMが検出された箇所に応じて、適切な対策を実施

