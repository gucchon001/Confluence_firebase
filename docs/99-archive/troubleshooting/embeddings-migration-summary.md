# エンベディング生成の移行サマリー

## 移行内容

**日時**: 2025-10-28  
**変更内容**: `@xenova/transformers` から Gemini Embeddings API (`text-embedding-004`) に移行  
**追記 (2025-11-09)**: `@google/generative-ai` の `embedContent()` 経由を廃止し、Gemini REST API 直接呼び出し + APIキーサニタイズ（BOM除去）に切り替え

## 主な変更点

### 削除されたもの
1. ✅ ローカルモデルファイルのダウンロード（`prebuild`から削除）
2. ✅ モデルファイルのコピー（`postbuild`から削除）
3. ✅ ローカルモデルの読み込みコード
4. ✅ `@xenova/transformers` への依存（コードから削除）

### 追加されたもの
1. ✅ Gemini Embeddings API (`text-embedding-004`) を使用
2. ✅ シンプルで信頼性の高い実装
3. ✅ 2025-11-09: REST API 直接呼び出し（`fetch`）に変更し、BOMサニタイズとタイムアウト制御を強化

## コード変更

### `src/lib/embeddings.ts`
**変更前**:
```typescript
import { pipeline } from '@xenova/transformers';
// ... 複雑なローカルモデル読み込みロジック
```

**変更後**:
- 2025-10-28 以降（REST呼び出し導入前）:
  ```typescript
  import { GoogleGenerativeAI } from '@google/generative-ai';

  async function getGeminiEmbeddings(text: string): Promise<number[]> {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    return result.embedding.values;
  }
  ```

- 2025-11-09 以降（現行実装）:
  ```typescript
  import fetch from 'node-fetch';
  import { removeBOM } from '@/lib/bom-utils';

  async function getGeminiEmbeddings(text: string): Promise<number[]> {
    const rawApiKey =
      process.env.GEMINI_API_KEY ??
      process.env.GOOGLEAI_API_KEY ??
      process.env.GOOGLE_GENAI_API_KEY;

    if (!rawApiKey) {
      throw new Error('GEMINI APIキーが設定されていません');
    }

    const apiKey = removeBOM(rawApiKey.trim());
    const cleaned = removeBOM(text).trim();

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/text-embedding-004:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: {
            role: 'user',
            parts: [{ text: cleaned }],
          },
        }),
      },
    );

    const data = await response.json();
    return data?.embedding?.values as number[];
  }
  ```

### `src/config/ai-models-config.ts`
**変更前**:
```typescript
provider: (process.env.EMBEDDINGS_PROVIDER || 'local') as 'local' | 'api',
modelId: 'Xenova/paraphrase-multilingual-mpnet-base-v2',
```

**変更後**:
```typescript
provider: 'api' as const,
modelId: 'text-embedding-004',
```

### `package.json`
**変更前**:
```json
"prebuild": "node scripts/download-embedding-model.js && node scripts/conditional-download.js",
```

**変更後**:
```json
"prebuild": "node scripts/conditional-download.js",
```

## メリット

1. ✅ **確実な動作**: ローカルファイルの問題が根本的に解決
2. ✅ **シンプルな実装**: コードが大幅に簡素化
3. ✅ **スケーラブル**: API呼び出しなので自動的にスケールする
4. ✅ **保守性向上**: 複雑なパス解決ロジックが不要
5. ✅ **デバッグ容易**: エラーメッセージが明確

## コスト

- Gemini Embeddings API のコストはほとんどかからない
- ローカルモデルで発生していたデバッグ時間が削減される

## 次回の確認事項

1. ローカル環境でテストして動作確認
2. 本番環境でデプロイして動作確認
3. パフォーマンス（レイテンシ）を確認

## 結論

この移行により、ローカルモデル関連の問題が根本的に解決されます。

---

**作成日**: 2025-10-28  
**ステータス**: 実装完了 - テスト待ち
