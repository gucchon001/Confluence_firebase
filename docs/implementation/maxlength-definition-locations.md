# maxLengthの定義箇所

## 概要

`maxLength`は、LLMに渡すコンテンツの最大文字数を制限するためのパラメータです。ランキングに基づいて動的に設定されます。

## 定義箇所

### 1. `src/ai/flows/streaming-summarize-confluence-docs.ts`（ストリーミング版）

**位置**: 336行目

**定義**:
```typescript
const maxLength = index === 0 ? 1500 : index === 1 ? 1000 : index === 2 ? 800 : index < 6 ? 600 : 500;
```

**仕様**:
- **1位**: 1500文字
- **2位**: 1000文字
- **3位**: 800文字
- **4-6位**: 600文字
- **7-10位**: 500文字

**使用箇所**:
```typescript
const truncatedContent = doc.content && doc.content.length > maxLength
  ? extractRelevantContentMultiKeyword(doc.content, sanitizedQuestion, maxLength)
  : doc.content || '内容なし';
```

### 2. `src/ai/flows/summarize-confluence-docs.ts`（非ストリーミング版）

**位置**: 293行目

**定義**:
```typescript
const maxLength = index === 0 ? 2000 : index === 1 ? 1500 : index === 2 ? 1200 : 800;
```

**仕様**:
- **1位**: 2000文字
- **2位**: 1500文字
- **3位**: 1200文字
- **4位以降**: 800文字

**使用箇所**:
```typescript
const truncatedContent = doc.content && doc.content.length > maxLength 
  ? doc.content.substring(0, maxLength) + '...' 
  : doc.content || '内容なし';
```

**注意**: 非ストリーミング版では、`extractRelevantContentMultiKeyword`を使用せず、単純に`substring`で切り取っています。

### 3. `src/ai/flows/content-extraction-utils.ts`（関数パラメータ）

**位置**: `extractRelevantContentMultiKeyword`関数の139行目

**定義**:
```typescript
export function extractRelevantContentMultiKeyword(
  content: string,
  query: string,
  maxLength: number  // パラメータとして受け取る
): string {
  // ...
}
```

**説明**: この関数は`maxLength`をパラメータとして受け取り、`streaming-summarize-confluence-docs.ts`から渡された値を使用します。

## 設定の違い

### ストリーミング版 vs 非ストリーミング版

| ランク | ストリーミング版 | 非ストリーミング版 |
|--------|----------------|------------------|
| 1位 | 1500文字 | 2000文字 |
| 2位 | 1000文字 | 1500文字 |
| 3位 | 800文字 | 1200文字 |
| 4-6位 | 600文字 | 800文字 |
| 7-10位 | 500文字 | 800文字 |

### 理由

ストリーミング版は、リアルタイムで回答を生成するため、より短い文字数制限を設定しています。
非ストリーミング版は、一度にすべての回答を生成するため、より長い文字数制限を設定しています。

## 使用フロー

1. **`streaming-summarize-confluence-docs.ts`**: ランキングに基づいて`maxLength`を計算
2. **`extractRelevantContentMultiKeyword`**: `maxLength`をパラメータとして受け取り、コンテンツ抽出を実行
3. **結果**: 抽出されたコンテンツがLLMのコンテキストに含まれる

## 変更履歴

### 2025年11月（現在）

- **ストリーミング版**: ランキングに基づく動的な文字数制限を導入
  - 以前: すべてのドキュメントで530文字に固定
  - 現在: ランキングに応じて500-1500文字に変更

- **非ストリーミング版**: ランキングに基づく動的な文字数制限を導入
  - 以前: すべてのドキュメントで800文字に固定
  - 現在: ランキングに応じて800-2000文字に変更

## 参考資料

- `docs/implementation/content-extraction-specification.md`: コンテンツ抽出の仕様
- `docs/deployment/content-truncation-improvement-deployment.md`: コンテンツ切り詰め改善の本番環境適用ガイド

