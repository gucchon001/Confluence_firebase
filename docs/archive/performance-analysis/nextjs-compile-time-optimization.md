# Next.jsコンパイル時間の最適化

## 問題の特定

ユーザーが「サーバー立ち上げに時間がかかる」と感じているのは、
実際には**Next.jsの初回ページコンパイル時間**です。

### ログから確認

```
✓ Compiled /api/streaming-process in 9.4s (2829 modules)
POST /api/streaming-process 200 in 32408ms
```

**内訳**:
- **コンパイル時間**: 9.4秒 ← ユーザーが待たされる
- **実際の処理時間**: 23秒（32.4 - 9.4 = 23秒）
  - サーバー起動: 2ms
  - 検索: 4.8秒
  - AI生成: 14.8秒
  - その他: 3.2秒

---

## 🔍 コンパイル時間の原因

### 1. モジュール数が多い

```
2829 modules  ← 非常に多い！
```

**主な原因**:
- 多数のライブラリ（Firebase, LanceDB, Genkit, etc.）
- 複雑な依存関係
- TypeScriptのトランスパイル

### 2. 開発モード特有の問題

**開発モード**:
- 初回リクエスト時にオンデマンドでコンパイル
- ホットリロード対応のため、最適化が限定的

**本番モード**:
- ビルド時に事前コンパイル
- 最適化が適用される

---

## 🚀 最適化方法

### オプション1: 本番ビルドを使用（最も効果的）

**開発モード**:
```bash
npm run dev  # 初回コンパイル: 9.4秒
```

**本番モード**:
```bash
npm run build  # ビルド時にコンパイル
npm run start  # 起動後すぐに応答可能
```

**効果**: 初回リクエストでも**コンパイル時間0秒**

**欠点**: 
- コード変更のたびに再ビルドが必要
- 開発効率が低下

---

### オプション2: SWC最適化（Next.js 13+）

Next.jsは既にSWCを使用していますが、追加の最適化オプションがあります：

```typescript
// next.config.ts
const config: NextConfig = {
  // SWC最適化
  swcMinify: true,
  
  // 並列コンパイルを有効化
  experimental: {
    workerThreads: true,
    cpus: 4  // CPUコア数に応じて調整
  },
  
  // キャッシュを有効化
  webpack: (config, { isServer }) => {
    // Webpack永続キャッシュ
    config.cache = {
      type: 'filesystem',
      buildDependencies: {
        config: [__filename]
      }
    };
    return config;
  }
};
```

**効果**: コンパイル時間 **9.4秒 → 5-6秒**（約40%削減）

---

### オプション3: Dynamic Importによる遅延ロード

重いライブラリを動的にインポート：

```typescript
// ❌ 静的インポート（コンパイル時に全て読み込む）
import { searchLanceDB } from '@/lib/lancedb-search-client';
import { streamingSummarizeConfluenceDocs } from '@/ai/flows/streaming-summarize-confluence-docs';

// ✅ 動的インポート（必要な時だけ読み込む）
const { searchLanceDB } = await import('@/lib/lancedb-search-client');
const { streamingSummarizeConfluenceDocs } = await import('@/ai/flows/streaming-summarize-confluence-docs');
```

**効果**: コンパイル時間 **9.4秒 → 3-4秒**（約60%削減）

**欠点**: 
- コードの複雑化
- 初回実行時にわずかな遅延

---

### オプション4: モジュール数の削減

**未使用のインポートを削除**:
- Firebase Admin SDKの不要な機能
- 使用していないライブラリ
- 重複するユーティリティ

**効果**: コンパイル時間 **9.4秒 → 7-8秒**（約20%削減）

---

## 📊 推奨される対策

### 短期的対策（開発モード）

**オプション2 + オプション4の組み合わせ**:
- Webpack永続キャッシュを有効化
- 未使用のインポートを削除

**期待効果**: 9.4秒 → **5-6秒**（約40%削減）

### 長期的対策（本番環境）

**本番ビルドモードで運用**:
```bash
npm run build
npm run start
```

**効果**: コンパイル時間 **0秒**（事前ビルド済み）

---

## 🎯 結論

### 現在の状況

**ユーザーが感じる「起動時間」の内訳**:
- Next.jsコンパイル: **9.4秒** ← 主な原因
- 実際のサーバー起動: **2ms** ← 問題なし

### 推奨アクション

1. **即座に実施可能**: Webpack永続キャッシュの有効化（40%削減）
2. **中期的**: 未使用のインポート削除（20%削減）
3. **本番環境**: ビルドモードで運用（100%削減）

次に、**Webpack永続キャッシュ**を実装しますか？

---

**作成日**: 2025-10-08

