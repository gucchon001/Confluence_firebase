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

```typescript
export const EmbeddingConfig = {
  /** プロバイダー（local または api） */
  provider: 'local' as 'local' | 'api',
  
  /** モデルID */
  modelId: 'Xenova/paraphrase-multilingual-mpnet-base-v2',
  
  /** 埋め込みベクトルの次元数 */
  dimensions: 768,
} as const;
```

#### パラメータの説明

| パラメータ | 説明 |
|:---|:---|
| `provider` | `local`: ローカル実行、`api`: 外部API使用 |
| `modelId` | Hugging FaceのモデルID（Xenova transformers対応） |
| `dimensions` | 生成されるベクトルの次元数 |

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
import { EmbeddingConfig } from '@/config/ai-models-config';

// 使用例
if (EmbeddingConfig.provider !== 'local') {
  console.warn('EMBEDDINGS_PROVIDERはlocalのみサポート。');
}

extractor = await pipeline('feature-extraction', EmbeddingConfig.modelId);
```

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

別のXenovaモデルに変更する場合：

```typescript
// src/config/ai-models-config.ts
export const EmbeddingConfig = {
  provider: 'local' as 'local' | 'api',
  modelId: 'Xenova/multilingual-e5-base', // ← ここを変更
  dimensions: 768, // モデルに応じて次元数も変更
}
```

利用可能なモデル（例）：
- `Xenova/paraphrase-multilingual-mpnet-base-v2` - 768次元（推奨）
- `Xenova/multilingual-e5-base` - 768次元
- `Xenova/all-MiniLM-L6-v2` - 384次元（英語のみ）

## 環境変数による設定

一部の設定は環境変数でオーバーライドできます：

```env
# .env ファイル

# Embeddingプロバイダー（デフォルト: local）
EMBEDDINGS_PROVIDER=local

# EmbeddingモデルID（デフォルト: Xenova/paraphrase-multilingual-mpnet-base-v2）
EMBEDDINGS_MODEL=Xenova/paraphrase-multilingual-mpnet-base-v2
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

- モデルを軽量なものに変更
- キャッシュ設定を確認（`src/lib/embedding-cache.ts`）

## 参考資料

### Gemini API
- [Gemini API Documentation](https://ai.google.dev/docs)
- [モデル一覧](https://ai.google.dev/models/gemini)

### Xenova Transformers
- [Xenova Transformers GitHub](https://github.com/xenova/transformers.js)
- [サポートされているモデル](https://huggingface.co/models?library=transformers.js)

## 更新履歴

| 日付 | 変更内容 |
|:---|:---|
| 2025-10-08 | 初版作成 - AIモデル設定を一元化 |

## 関連ドキュメント

- [検索システム総合ガイド](../architecture/search-system-comprehensive-guide.md)
- [Genkit設計ガイド](../architecture/genkit-design.md)
- [システム仕様書](../specifications/spec.md)

