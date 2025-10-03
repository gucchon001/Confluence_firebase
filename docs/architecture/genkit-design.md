# Genkit利用方針

## 1. 概要

本ドキュメントは、「Confluence仕様書要約チャットボット」のバックエンドロジックを実装する際に使用する **Genkit (core)** の利用方針、標準的な実装パターン、および規約を定義する。

## 2. 基本方針（更新）

### 現在の実装状況（2025年1月）
* 現在は直接API呼び出しを使用（Genkit統合は予定段階）
* Next.js API Routes から直接Gemini APIを呼び出し
* ストリーミング機能を実装済み
* Firebase認証とドメイン制限を実装済み

### 将来のGenkit統合方針
* アプリケーションの主要なAI処理は、Genkitの core（`genkit`）を直接呼び出して実装する。
* `@genkit-ai/flow` は使用しないが、`@genkit-ai/next` は必要に応じて使用する。
* Next.js の API Route (`app/api/**`) から、プレーンな関数（LLM生成・検索関数）を直接呼び出す。
* Google Cloud 連携は `@genkit-ai/googleai` / `@genkit-ai/google-cloud` を利用し、`zod` で入出力のバリデーションを行う。

## 3. Genkitの初期化 (genkit.ts)

プロジェクト全体のGenkit設定は、以下の`src/ai/genkit.ts`の記述を標準とする。Google Cloudのテレメトリー（ロギング、トレース）は`enableGoogleCloudTelemetry()`を呼び出して有効化する。

```typescript
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { enableGoogleCloudTelemetry } from '@genkit-ai/google-cloud';

// Google Cloudのロギングとトレースを有効化
// enableGoogleCloudTelemetry();

// GenkitをGoogle AIプラグインで初期化
export const ai = genkit({
  plugins: [googleAI()],
  // logLevel: 'debug',
  // enableTracingAndMetrics: true,
});
```

## 4. 標準実装（RAG：プレーン関数 + Next API）

### 4.1 プレーン関数（例）

```typescript
// src/ai/flows/retrieve-relevant-docs-lancedb.ts
export async function retrieveRelevantDocs({
  question,
  labels,
  labelFilters,
}: {
  question: string;
  labels?: string[];
  labelFilters?: {
    includeMeetingNotes: boolean;
    includeArchived: boolean;
  };
}): Promise<any[]> {
  // LanceDB検索 → フィルタリング → 結果返却
  return results; // JSONシリアライズ可能な配列
}

// src/ai/flows/summarize-confluence-docs.ts
export async function summarizeConfluenceDocs({
  question,
  context: documents,
  chatHistory = [],
}: SummarizeInput): Promise<SummarizeOutput> {
  // プロンプト生成 → ai.generate({ model: 'googleai/gemini-2.5-flash', prompt })
  return { answer, references };
}
```

### 4.2 Next API Route

```typescript
// src/app/api/flow/[flow]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { summarizeConfluenceDocs } from '@/ai/flows/summarize-confluence-docs';
import { retrieveRelevantDocs } from '@/ai/flows/retrieve-relevant-docs-lancedb';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ flow: string }> }
) {
  try {
    const body = await req.json();
    const params = await context.params;
    const flow = params.flow;

    switch (flow) {
      case 'retrieveRelevantDocs': {
        const { question, labels, labelFilters } = body ?? {};
        if (typeof question !== 'string' || question.length === 0) {
          return NextResponse.json(
            { error: 'Invalid input: question is required' },
            { status: 400 }
          );
        }
        const docs = await retrieveRelevantDocs({ question, labels, labelFilters });
        return NextResponse.json(docs);
      }
      case 'summarizeConfluenceDocs': {
        const result = await summarizeConfluenceDocs(body);
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }
  } catch (e: any) {
    console.error('[API Error]', e);
    return NextResponse.json(
      { error: e?.message || 'Internal Error' },
      { status: 500 }
    );
  }
}
```

## 5. 環境変数と機密情報の管理

APIキーやプロジェクトIDなどの機密情報は、`.env` / デプロイ先の環境変数で管理する。

## 6. GCSとFirestoreの連携

Vector Search実装におけるGCS/Firestoreの役割は従来方針（保存/メタデータ取得）に準ずる。

## 7. 現在の実装とGenkit統合の移行計画

### 現在の実装（2025年1月）
- **直接API呼び出し**: Gemini APIを直接呼び出し
- **ストリーミング**: `/api/streaming-process/route.ts` で実装済み
- **認証**: Firebase Authentication + @tomonokai-corp.com ドメイン制限
- **検索**: ハイブリッド検索（LanceDB + Lunr.js + キーワード検索）

### Genkit統合への移行計画
1. **Phase 1**: 現在の直接API呼び出しをGenkitのプレーン関数に移行
2. **Phase 2**: ストリーミング機能をGenkitのストリーミングAPIに移行
3. **Phase 3**: テレメトリーとロギングの統合
4. **Phase 4**: パフォーマンス最適化とモニタリング強化

---

注: 現在は直接API呼び出しを使用中。Genkit統合は将来の拡張として計画中。プレーン関数 + Next API に統一し、`@genkit-ai/next` は必要に応じて使用する。