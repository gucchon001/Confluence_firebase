# AIモデル設定ガイド

## 概要

本プロジェクトでは、AIモデルの設定を一元管理するために `src/config/ai-models-config.ts` を使用しています。このドキュメントでは、AIモデル設定の構造、使用方法、変更手順について説明します。

## 設定ファイルの場所

```
src/config/ai-models-config.ts
```

## 設定の構造

### 1. Gemini (LLM) モデル設定

Gemini APIを使用したテキスト生成モデルの設定です。

```typescript
export const GeminiConfig = {
  /** モデル名 */
  model: 'googleai/gemini-2.5-flash' as const,
  
  /** モデルパラメータ */
  config: {
    /** 最大出力トークン数 */
    maxOutputTokens: 4096,
    
    /** 温度パラメータ（0.0-1.0） */
    temperature: 0.1,
    
    /** Top-P サンプリング（0.0-1.0） */
    topP: 0.9,
    
    /** Top-K サンプリング */
    topK: 50,
  },
  
  /** タイムアウト設定（ミリ秒） */
  timeout: 60000, // 60秒
} as const;
```

#### パラメータの説明

| パラメータ | 範囲 | 推奨値 | 説明 |
|:---|:---|:---|:---|
| `model` | - | `googleai/gemini-2.5-flash` | 使用するGeminiモデル |
| `maxOutputTokens` | 1-8192 | 4096 | 生成される最大トークン数 |
| `temperature` | 0.0-1.0 | 0.1 | 低い値=一貫性、高い値=創造性 |
| `topP` | 0.0-1.0 | 0.9 | 確率の累積分布の上位何%から選択するか |
| `topK` | 1-100+ | 50 | 上位K個のトークンから選択 |
| `timeout` | 1000+ | 60000 | API呼び出しのタイムアウト（ミリ秒） |

### 2. Embedding モデル設定

テキストのベクトル埋め込みを生成するモデルの設定です。

**重要**:  
- 2025-10-28 に `@xenova/transformers` から Gemini Embeddings API（`text-embedding-004`）へ移行しました。  
- 2025-11-09 以降は `@google/generative-ai` SDK の `embedContent()` を経由せず、**Gemini REST API を直接呼び出す実装**に変更し、BOM サニタイズとタイムアウト制御を強化しています。

```typescript
export const EmbeddingConfig = {
  /** プロバイダー（api - Gemini Embeddings API使用） */
  provider: 'api' as const,
  
  /** モデルID
   * text-embedding-004: Gemini Embeddings API（768次元）
   * 参考: https://ai.google.dev/models/gemini#embedding
   */
  modelId: 'text-embedding-004',
  
  /** 埋め込みベクトルの次元数 */
  dimensions: 768,
} as const;
```

#### パラメータの説明

| パラメータ | 説明 |
|:---|:---|
| `provider` | `api`: Gemini Embeddings API使用（2025-10-28移行、2025-11-09以降はREST API直呼び出し） |
| `modelId` | Gemini Embeddings APIのモデルID（`text-embedding-004`） |
| `dimensions` | 生成されるベクトルの次元数（768次元） |

## 使用箇所

### Gemini設定の使用

以下のファイルで使用されています：

1. **`src/ai/flows/streaming-summarize-confluence-docs.ts`**
   - ストリーミングでの回答生成
   
2. **`src/ai/flows/summarize-confluence-docs.ts`**
   - 通常の回答生成

3. **`src/app/api/streaming-process/route.ts`**
   - ログ記録でのモデル名取得

```typescript
import { GeminiConfig } from '@/config/ai-models-config';

// 使用例
const result = await ai.generate({
  model: GeminiConfig.model,
  prompt: prompt,
  config: GeminiConfig.config
});
```

### Embedding設定の使用

以下のファイルで使用されています：

1. **`src/lib/embeddings.ts`**
   - テキストの埋め込みベクトル生成

```typescript
import fetch from 'node-fetch';
import { EmbeddingConfig } from '@/config/ai-models-config';
import { removeBOM } from '@/lib/bom-utils';

const rawApiKey =
  process.env.GEMINI_API_KEY ??
  process.env.GOOGLEAI_API_KEY ??
  process.env.GOOGLE_GENAI_API_KEY;

if (!rawApiKey) {
  throw new Error('GEMINI APIキーが設定されていません');
}

const apiKey = removeBOM(rawApiKey.trim());
const cleanedText = removeBOM(text).trim();

const response = await fetch(
  `https://generativelanguage.googleapis.com/v1/models/${EmbeddingConfig.modelId}:embedContent?key=${apiKey}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: {
        role: 'user',
        parts: [{ text: cleanedText }],
      },
    }),
  },
);

const data = await response.json();
const embedding = data?.embedding?.values as number[];
```

**実装ファイル**: `src/lib/embeddings.ts` を参照してください（例では `removeBOM()` と REST API 呼び出しによるサニタイズ済み実装を抜粋）。

## 設定変更手順

### 1. モデルの変更

別のGeminiモデルに変更する場合：

```typescript
// src/config/ai-models-config.ts
export const GeminiConfig = {
  model: 'googleai/gemini-2.0-pro' as const, // ← ここを変更
  config: {
    // パラメータはそのまま
  }
}
```

利用可能なモデル：
- `googleai/gemini-2.5-flash` - 高速、低コスト（推奨）
- `googleai/gemini-2.0-pro` - 高性能、高コスト
- `googleai/gemini-1.5-flash` - 旧バージョン

### 2. パラメータの調整

#### より創造的な回答が欲しい場合

```typescript
config: {
  temperature: 0.3, // 0.1 → 0.3 に上げる
  topP: 0.95,       // 0.9 → 0.95 に上げる
  topK: 100,        // 50 → 100 に上げる
}
```

#### より一貫性のある回答が欲しい場合

```typescript
config: {
  temperature: 0.05, // 0.1 → 0.05 に下げる
  topP: 0.8,         // 0.9 → 0.8 に下げる
  topK: 30,          // 50 → 30 に下げる
}
```

#### より長い回答を生成したい場合

```typescript
config: {
  maxOutputTokens: 8192, // 4096 → 8192 に増やす
}
```

### 3. Embeddingモデルの変更

**注意**: 現在は Gemini Embeddings API (`text-embedding-004`) のみをサポートしています。他のモデルに変更する場合は、`src/lib/embeddings.ts` の REST 呼び出し実装およびサニタイズ処理を合わせて更新してください。

```typescript
// src/config/ai-models-config.ts
export const EmbeddingConfig = {
  provider: 'api' as const,
  modelId: 'text-embedding-004', // Gemini Embeddings API
  dimensions: 768,
}
```

**利用可能なモデル**:
- `text-embedding-004` - 768次元（現在使用中）
  - 参考: https://ai.google.dev/models/gemini#embedding

**移行履歴**:
- 2025-10-28: `@xenova/transformers`から`@google/generative-ai`に移行
- 2025-11-09: `@google/generative-ai` SDK の `embedContent()` から REST API 直接呼び出しに変更（BOMサニタイズとタイムアウト強化）
- 詳細: `docs/troubleshooting/embeddings-migration-summary.md`

## 環境変数による設定

**注意**: 現在の実装では、環境変数による設定は使用されていません。設定は`src/config/ai-models-config.ts`で一元管理されています。

```env
# .env ファイル

# Gemini API Key（必須）
GEMINI_API_KEY=your-api-key-here
```

## ベストプラクティス

### 1. パラメータ調整の順序

1. まず `temperature` を調整（最も影響が大きい）
2. 次に `maxOutputTokens` を調整（回答の長さ）
3. 必要に応じて `topP` と `topK` を微調整

### 2. テストの実施

設定変更後は以下をテスト：

```bash
# 開発サーバーで動作確認
npm run dev

# テストの実行
npm test
```

### 3. パフォーマンスモニタリング

設定変更後は以下を監視：
- **応答時間**: タイムアウトが発生しないか
- **回答品質**: 期待する回答が得られるか
- **コスト**: API使用量が予算内か

## トラブルシューティング

### タイムアウトエラーが発生する

```typescript
timeout: 90000, // 60000 → 90000 に増やす
```

### 回答が短すぎる

```typescript
config: {
  maxOutputTokens: 8192, // 4096 → 8192 に増やす
}
```

### 回答が不安定

```typescript
config: {
  temperature: 0.05, // 温度を下げる
}
```

### Embeddingが遅い

- キャッシュ設定を確認（`src/lib/embeddings.ts`の簡易メモリキャッシュ）
- Gemini Embeddings APIのレート制限を確認
- ネットワーク接続を確認

## 参考資料

### Gemini API
- [Gemini API Documentation](https://ai.google.dev/docs)
- [モデル一覧](https://ai.google.dev/models/gemini)
- [Gemini Embeddings API](https://ai.google.dev/models/gemini#embedding)

### 移行関連ドキュメント
- [エンベディング生成の移行サマリー](../troubleshooting/embeddings-migration-summary.md)
- [BOM文字エラーの根本原因](../analysis/bom-error-root-cause-final.md)

## 更新履歴

| 日付 | 変更内容 |
|:---|:---|
| 2025-11-06 | Gemini Embeddings API移行を反映（2025-10-28移行） |
| 2025-10-08 | 初版作成 - AIモデル設定を一元化 |

## 関連ドキュメント

- [検索システム総合ガイド](../architecture/search-system-comprehensive-guide.md)
- [Genkit設計ガイド](../architecture/genkit-design.md)
- [システム仕様書](../specifications/spec.md)

