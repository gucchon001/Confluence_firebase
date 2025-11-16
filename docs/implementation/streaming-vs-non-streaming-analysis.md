# ストリーミング版と非ストリーミング版の分析

## 概要

コードベースには、**ストリーミング版**と**非ストリーミング版**の2つの実装が存在します。これらは明示的に定義・命名されたわけではなく、実装の違いから区別されています。

## 実装の違い

### 1. ストリーミング版 (`streaming-summarize-confluence-docs.ts`)

**特徴**:
- `AsyncGenerator`を使用して、チャンクごとに回答を生成・返す
- リアルタイムで回答を配信（TTFB最適化）
- 本番環境で使用されている（`src/app/api/streaming-process/route.ts`）

**実装**:
```typescript
export async function* streamingSummarizeConfluenceDocs(
  params: {
    question: string;
    context: any[];
    chatHistory: any[];
  }
): AsyncGenerator<{
  chunk: string;
  isComplete: boolean;
  chunkIndex: number;
  totalChunks?: number;
  references: any[];
}, void, unknown> {
  // ...
}
```

**使用箇所**:
- `src/app/api/streaming-process/route.ts`（本番API）
- `src/ai/flows/streaming-summarize-confluence-docs.ts`（実装）

**文字数制限**:
- 1位: 1500文字
- 2位: 1000文字
- 3位: 800文字
- 4-6位: 600文字
- 7-10位: 500文字

**コンテンツ抽出**:
- `extractRelevantContentMultiKeyword`を使用（キーワードマッチングによる抽出）

### 2. 非ストリーミング版 (`summarize-confluence-docs.ts`)

**特徴**:
- `Promise`を返して、一度に完全な回答を返す
- テストや特定のエンドポイントで使用

**実装**:
```typescript
export async function summarizeConfluenceDocs({
  question: rawQuestion,
  context: documents,
  chatHistory = [],
}: SummarizeInput): Promise<SummarizeOutput> {
  // ...
}
```

**使用箇所**:
- `src/app/api/flow/[flow]/route.ts`（特定のエンドポイント）
- `src/tests/unit/rag-flow.test.ts`（テスト）
- `src/tests/integration/ask-question.test.ts`（テスト）
- `src/lib/archive/rag-engine.ts`（アーカイブ）

**文字数制限**:
- 1位: 2000文字
- 2位: 1500文字
- 3位: 1200文字
- 4位以降: 800文字

**コンテンツ抽出**:
- `substring(0, maxLength)`を使用（単純な先頭切り取り）

## 問題点

### 1. 命名と定義の不一致

- **ストリーミング版**: 「ストリーミング版」という名前はコメントに記載されているが、明確な定義ドキュメントがない
- **非ストリーミング版**: 「プレーン関数版」というコメントはあるが、「非ストリーミング版」という明確な定義がない
- ユーザーが「定義した記憶がありません」というのは、これらの違いを明示的に定義した記憶がないことを示している

### 2. 実装の重複

- 2つの実装が存在し、それぞれ異なる文字数制限とコンテンツ抽出方法を使用している
- 非ストリーミング版は`extractRelevantContentMultiKeyword`を使用していない（単純な先頭切り取り）

### 3. 使用箇所の不一致

- **本番環境**: ストリーミング版を使用
- **テスト環境**: 非ストリーミング版を使用
- テストと本番で異なる実装を使用している可能性がある

## 推奨事項

### 1. 明確な定義の作成

- ストリーミング版と非ストリーミング版の違いを明確に定義
- それぞれの使用箇所と理由を文書化
- 命名規則を統一

### 2. 実装の統一

- 非ストリーミング版も`extractRelevantContentMultiKeyword`を使用するように修正
- または、ストリーミング版のみを使用し、非ストリーミング版を削除

### 3. ドキュメントの更新

- `docs/architecture/`に明確な定義を追加
- `docs/implementation/`に実装の違いを文書化

## 参考資料

- `src/ai/flows/streaming-summarize-confluence-docs.ts`: ストリーミング版の実装
- `src/ai/flows/summarize-confluence-docs.ts`: 非ストリーミング版の実装
- `src/app/api/streaming-process/route.ts`: 本番環境での使用箇所
- `src/app/api/flow/[flow]/route.ts`: 非ストリーミング版の使用箇所

