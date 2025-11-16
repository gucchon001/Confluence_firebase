# 設定値管理・環境変数呼び出しの分析結果

## 調査概要

設定値の呼び出し関連で非効率で保守性が低い設定を特定するため、以下の観点で調査を実施：
- 環境変数の直接参照箇所
- 設定値の一元管理の有無
- 型安全性・検証ロジック
- ローカル環境と本番環境での設定方法の違い

---

## 🔍 調査結果サマリー

### 問題点

1. **環境変数の直接参照が多数散在** (232箇所、81ファイル)
2. **設定値の一元管理が不十分**
3. **型安全性の欠如**
4. **環境変数の検証ロジックが統一されていない**
5. **ローカル環境と本番環境での設定管理が分離されていない**

---

## 📊 詳細分析

### 1. 環境変数の直接参照の現状

#### 統計
- **`process.env.*` の使用箇所**: 232箇所
- **使用ファイル数**: 81ファイル
- **主要な使用箇所**:
  - `src/lib/confluence-sync-service.ts`: 12箇所
  - `src/lib/lancedb-search-client.ts`: 6箇所
  - `src/components/chat-page.tsx`: 9箇所
  - `src/ai/flows/retrieve-relevant-docs-lancedb.ts`: 14箇所

#### 問題点

**1.1 型安全性の欠如**

```typescript
// ❌ 悪い例: 型が不明確、undefinedの可能性がある
this.baseUrl = process.env.CONFLUENCE_BASE_URL || '';
this.apiToken = process.env.CONFLUENCE_API_TOKEN || '';
```

**1.2 デフォルト値の一貫性がない**

```typescript
// confluence-sync-service.ts
this.baseUrl = process.env.CONFLUENCE_BASE_URL || '';

// jira-sync-service.ts
this.baseUrl = process.env.JIRA_BASE_URL || process.env.CONFLUENCE_BASE_URL || '';

// url-utils.ts
const baseUrl = options?.baseUrl || process.env.CONFLUENCE_BASE_URL || 'https://giginc.atlassian.net';
```

**1.3 環境変数の検証が各サービスで個別実装**

```typescript
// jira-sync-service.ts: 検証あり
if (!this.baseUrl || !this.email || !this.apiToken || !this.projectKey) {
  throw new Error('Jira同期に必要な環境変数が不足しています。');
}

// confluence-sync-service.ts: 検証なし
// 環境変数が未設定でもエラーにならない
this.baseUrl = process.env.CONFLUENCE_BASE_URL || '';
```

---

### 2. 設定値の一元管理の現状

#### 現在の設定ファイル

**2.1 Firebase設定** (`src/lib/firebase-config.ts`)
```typescript
// ✅ 良い例: 一元管理されている
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  // ...
};
```

**2.2 AIモデル設定** (`src/config/ai-models-config.ts`)
```typescript
// ✅ 良い例: 設定値が一元管理されている
export const GeminiConfig = {
  model: 'googleai/gemini-2.5-flash' as const,
  config: {
    maxOutputTokens: 8192,
    temperature: 0.3,
    // ...
  },
};
```

**2.3 Confluence/Jira設定** 
```typescript
// ❌ 悪い例: 各サービス内で直接読み込み
// confluence-sync-service.ts
this.baseUrl = process.env.CONFLUENCE_BASE_URL || '';
this.username = process.env.CONFLUENCE_USER_EMAIL || '';

// jira-sync-service.ts
this.baseUrl = process.env.JIRA_BASE_URL || process.env.CONFLUENCE_BASE_URL || '';
this.email = process.env.JIRA_USER_EMAIL || process.env.CONFLUENCE_USER_EMAIL || '';
```

**2.4 埋め込み設定**
```typescript
// ❌ 悪い例: embeddings.ts内で直接読み込み
const rawApiKey = process.env.GEMINI_API_KEY;
```

---

### 3. 環境変数の検証ロジック

#### 3.1 検証関数の存在

**一部のスクリプトでのみ使用**
```typescript
// src/scripts/list-jira-issues.ts
function getEnv(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`環境変数 ${name} が設定されていません`);
  }
  return value;
}
```

**問題点**:
- 本番コード（`src/lib/*`）では使用されていない
- 検証ロジックが各サービスで個別実装されている

#### 3.2 Gemini APIキーの検証（良い例）

```typescript
// src/ai/genkit.ts
function resolveSanitizedGeminiApiKey(): string | undefined {
  const rawKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLEAI_API_KEY ?? process.env.GOOGLE_GENAI_API_KEY;
  if (!rawKey) {
    console.error('🚨 GEMINI APIキーが設定されていません');
    return undefined;
  }
  // BOM除去、サニタイズ処理...
  return sanitizedKey;
}
```

**良い点**:
- 複数の環境変数を試行
- エラーメッセージが明確
- サニタイズ処理を含む

---

### 4. ローカル環境と本番環境での設定方法

#### 4.1 ローカル環境

**`.env.local` ファイル** (存在)
```bash
# 環境変数を定義
CONFLUENCE_BASE_URL=https://giginc.atlassian.net
CONFLUENCE_USER_EMAIL=kanri@jukust.jp
# ...
```

**`.env.example` ファイル** (存在)
```bash
# テンプレートを提供
CONFLUENCE_BASE_URL=https://<your-domain>.atlassian.net
CONFLUENCE_USER_EMAIL=<your-email>
# ...
```

#### 4.2 本番環境

**`setup/apphosting.yaml`** (Firebase App Hosting用)
```yaml
env:
  - variable: CONFLUENCE_BASE_URL
    value: https://giginc.atlassian.net
    availability:
      - RUNTIME
  
  - variable: CONFLUENCE_USER_EMAIL
    value: kanri@jukust.jp
    availability:
      - RUNTIME
  
  # シークレット参照
  - variable: GEMINI_API_KEY
    secret: gemini_api_key
    availability:
      - BUILD
      - RUNTIME
```

#### 4.3 問題点

1. **設定値の重複定義**
   - `.env.local` と `apphosting.yaml` で同じ設定が重複
   - どちらが優先されるかが不明確

2. **環境別設定の管理が不透明**
   - ローカル環境と本番環境で異なる設定方法を使用
   - 設定値の検証方法が統一されていない

3. **Secret Manager との統合が不十分**
   - `apphosting.yaml` では Secret Manager を参照できるが、ローカル環境では `.env.local` を使用
   - 本番環境での設定変更が困難

---

### 5. 非効率な設定の具体例

#### 5.1 Jira設定のフォールバック処理

```typescript
// ❌ 悪い例: 複数箇所で同じフォールバックロジックが散在
// jira-sync-service.ts
this.baseUrl = process.env.JIRA_BASE_URL || process.env.CONFLUENCE_BASE_URL || '';

// url-utils.ts
const baseUrl = options?.baseUrl || process.env.CONFLUENCE_BASE_URL || 'https://giginc.atlassian.net';

// jira-url-utils.ts
const baseUrl = options?.baseUrl || process.env.JIRA_BASE_URL || process.env.CONFLUENCE_BASE_URL || 'https://giginc.atlassian.net';
```

**問題点**:
- 同じフォールバックロジックが3箇所に存在
- デフォルト値が異なる (`''` vs `'https://giginc.atlassian.net'`)
- 変更時に複数箇所を修正する必要がある

#### 5.2 環境判定の重複

```typescript
// ❌ 悪い例: 複数箇所で同じ環境判定
if (process.env.NODE_ENV === 'development') { ... }
if (process.env.NODE_ENV !== 'production') { ... }
```

**問題点**:
- `NODE_ENV` の判定が73箇所に存在
- 環境判定ロジックが統一されていない

#### 5.3 型変換の重複

```typescript
// ❌ 悪い例: 型変換ロジックが各箇所で個別実装
const maxIssues = process.env.JIRA_MAX_ISSUES !== undefined
  ? parseInt(process.env.JIRA_MAX_ISSUES, 10)
  : 1000;

const maxIssues = process.env.MAX_ISSUES ? parseInt(process.env.MAX_ISSUES, 10) : undefined;
```

---

## 🎯 推奨改善案

### 1. 設定値の一元管理（優先度: 高）

#### 1.1 統合設定ファイルの作成

```typescript
// src/config/app-config.ts
import { z } from 'zod';

// 環境変数のスキーマ定義
const EnvSchema = z.object({
  // Confluence設定
  CONFLUENCE_BASE_URL: z.string().url(),
  CONFLUENCE_USER_EMAIL: z.string().email(),
  CONFLUENCE_API_TOKEN: z.string().min(1),
  CONFLUENCE_SPACE_KEY: z.string().min(1),
  
  // Jira設定（オプション、Confluence設定をフォールバック）
  JIRA_BASE_URL: z.string().url().optional(),
  JIRA_USER_EMAIL: z.string().email().optional(),
  JIRA_API_TOKEN: z.string().min(1).optional(),
  JIRA_PROJECT_KEY: z.string().optional(),
  JIRA_MAX_ISSUES: z.string().regex(/^\d+$/).optional(),
  
  // Gemini設定
  GEMINI_API_KEY: z.string().min(1),
  
  // Firebase設定
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  // ...
  
  // 環境判定
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // その他
  USE_INMEMORY_FS: z.string().optional(),
  K_SERVICE: z.string().optional(),
});

// 環境変数の検証と型安全な取得
function getEnv(): z.infer<typeof EnvSchema> {
  const raw = {
    CONFLUENCE_BASE_URL: process.env.CONFLUENCE_BASE_URL,
    CONFLUENCE_USER_EMAIL: process.env.CONFLUENCE_USER_EMAIL,
    // ...
  };
  
  try {
    return EnvSchema.parse(raw);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missing = error.errors.map(e => e.path.join('.')).join(', ');
      throw new Error(`必須環境変数が設定されていません: ${missing}`);
    }
    throw error;
  }
}

// アプリケーション設定（検証済み環境変数から構築）
export const appConfig = {
  confluence: {
    baseUrl: getEnv().CONFLUENCE_BASE_URL,
    userEmail: getEnv().CONFLUENCE_USER_EMAIL,
    apiToken: getEnv().CONFLUENCE_API_TOKEN,
    spaceKey: getEnv().CONFLUENCE_SPACE_KEY,
  },
  
  jira: {
    baseUrl: getEnv().JIRA_BASE_URL || getEnv().CONFLUENCE_BASE_URL,
    userEmail: getEnv().JIRA_USER_EMAIL || getEnv().CONFLUENCE_USER_EMAIL,
    apiToken: getEnv().JIRA_API_TOKEN || getEnv().CONFLUENCE_API_TOKEN,
    projectKey: getEnv().JIRA_PROJECT_KEY,
    maxIssues: getEnv().JIRA_MAX_ISSUES ? parseInt(getEnv().JIRA_MAX_ISSUES, 10) : 1000,
  },
  
  gemini: {
    apiKey: getEnv().GEMINI_API_KEY,
  },
  
  firebase: {
    apiKey: getEnv().NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: getEnv().NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    // ...
  },
  
  environment: {
    isDevelopment: getEnv().NODE_ENV === 'development',
    isProduction: getEnv().NODE_ENV === 'production',
    isTest: getEnv().NODE_ENV === 'test',
  },
  
  deployment: {
    isCloudRun: !!getEnv().K_SERVICE,
    useInMemoryFS: getEnv().USE_INMEMORY_FS === 'true' && !!getEnv().K_SERVICE,
  },
} as const;

// 型安全な環境変数アクセス
export type AppConfig = typeof appConfig;
```

**利点**:
- 型安全性の確保
- 環境変数の検証が一元化
- デフォルト値の統一管理
- 変更箇所の最小化

#### 1.2 各サービスでの使用

```typescript
// ✅ 改善後: confluence-sync-service.ts
import { appConfig } from '@/config/app-config';

export class ConfluenceSyncService {
  private baseUrl: string;
  private username: string;
  private apiToken: string;
  private spaceKey: string;

  constructor() {
    // 型安全で検証済みの設定値を使用
    this.baseUrl = appConfig.confluence.baseUrl;
    this.username = appConfig.confluence.userEmail;
    this.apiToken = appConfig.confluence.apiToken;
    this.spaceKey = appConfig.confluence.spaceKey;
  }
}
```

---

### 2. 環境変数検証ヘルパーの統一（優先度: 中）

#### 2.1 統一検証関数の作成

```typescript
// src/lib/env-utils.ts
export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`必須環境変数 ${key} が設定されていません`);
  }
  return value;
}

export function getOptionalEnv(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}

export function getBooleanEnv(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

export function getNumberEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.warn(`環境変数 ${key} が数値として解析できません。デフォルト値を使用します。`);
    return defaultValue;
  }
  return parsed;
}
```

#### 2.2 使用例

```typescript
// ✅ 改善後
import { getRequiredEnv, getOptionalEnv, getNumberEnv } from '@/lib/env-utils';

const baseUrl = getRequiredEnv('CONFLUENCE_BASE_URL');
const maxIssues = getNumberEnv('JIRA_MAX_ISSUES', 1000);
const useInMemoryFS = getBooleanEnv('USE_INMEMORY_FS', false);
```

---

### 3. 環境別設定の管理改善（優先度: 中）

#### 3.1 設定ファイルの整理

**ローカル環境**: `.env.local` を使用
**本番環境**: Firebase App Hosting の環境変数設定を使用
**開発環境**: `.env.development` を使用（オプション）

#### 3.2 設定値の優先順位の明確化

```typescript
// 設定値の優先順位:
// 1. 環境変数（process.env）
// 2. .env.local（ローカル環境のみ）
// 3. デフォルト値
```

---

### 4. 設定値の型安全性向上（優先度: 低）

#### 4.1 Zod スキーマの使用

```typescript
import { z } from 'zod';

const ConfluenceConfigSchema = z.object({
  baseUrl: z.string().url(),
  userEmail: z.string().email(),
  apiToken: z.string().min(1),
  spaceKey: z.string().min(1),
});

type ConfluenceConfig = z.infer<typeof ConfluenceConfigSchema>;
```

---

## 📋 実施すべき改善タスク

### 優先度: 高

1. **統合設定ファイルの作成** (`src/config/app-config.ts`)
   - 環境変数のスキーマ定義
   - 型安全な設定値のエクスポート
   - 環境変数の検証ロジック

2. **主要サービスの移行**
   - `confluence-sync-service.ts`
   - `jira-sync-service.ts`
   - `url-utils.ts`
   - `jira-url-utils.ts`

### 優先度: 中

3. **環境変数検証ヘルパーの統一** (`src/lib/env-utils.ts`)
   - 統一検証関数の作成
   - 既存コードへの適用

4. **環境判定の統一**
   - `appConfig.environment.isDevelopment` などの使用
   - `process.env.NODE_ENV` の直接参照を削減

### 優先度: 低

5. **設定値のドキュメント化**
   - 必須環境変数の一覧
   - 環境別設定の説明

6. **設定値のテスト**
   - 環境変数の検証ロジックのテスト
   - 型安全性のテスト

---

## 🔄 移行計画

### Phase 1: 基盤整備（1週間）
- 統合設定ファイルの作成
- 環境変数検証ヘルパーの作成
- 型定義の整備

### Phase 2: 主要サービスの移行（2週間）
- `confluence-sync-service.ts` の移行
- `jira-sync-service.ts` の移行
- URL関連ユーティリティの移行

### Phase 3: その他の移行（2週間）
- その他のサービス・コンポーネントの移行
- 環境判定の統一
- テストの追加

### Phase 4: リファクタリング（1週間）
- `process.env.*` の直接参照の削除
- ドキュメントの更新
- コードレビュー

---

## 📊 期待効果

### 保守性の向上
- 設定値の変更が1箇所で完結
- 環境変数の検証ロジックが統一
- 型安全性によりエラーが早期発見

### 開発効率の向上
- 設定値の変更が容易
- 環境変数の不足が起動時に検出
- 型推論によりIDEの補完が有効

### 運用の改善
- 環境別設定の管理が明確化
- 設定値のドキュメント化
- 設定ミスによるエラーの削減

---

## ⚠️ 注意事項

1. **後方互換性の確保**
   - 移行時は既存の `process.env.*` 参照を段階的に置き換え
   - 設定値の取得方法を変更しても動作に影響がないようにする

2. **環境変数の検証タイミング**
   - アプリケーション起動時に検証する（実行時エラーを防止）
   - 必須環境変数が不足している場合は起動を拒否

3. **Secret Manager との統合**
   - 本番環境では Secret Manager から環境変数を取得
   - ローカル環境では `.env.local` を使用

---

## 📚 参考資料

- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Firebase App Hosting Configuration](https://firebase.google.com/docs/app-hosting/configure)
- [Zod Documentation](https://zod.dev/)

