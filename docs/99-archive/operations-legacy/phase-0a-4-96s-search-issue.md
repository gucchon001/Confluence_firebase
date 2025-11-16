# 🚨 Phase 0A-4: 96.5秒検索遅延の根本原因と対策

**作成日**: 2025年10月20日  
**ステータス**: 🔧 修正中  
**優先度**: P0 (Critical)

---

## 📊 問題の症状

### パフォーマンス指標
```
サーバー起動時間: 1ms
初期応答時間(TTFB): 5ms
検索時間: 96.5s ❌
AI生成時間: 14.2s
総処理時間: 110.8s
参照数: 12件
```

**検索時間が異常に長い（96.5秒）**

---

## 🔍 根本原因分析（Cloud Logging詳細調査）

### 🎯 **結論: Kuromoji辞書ファイル問題が最優先** 

**分析結果**: 検索遅延の70秒（約72%）は**Kuromoji辞書ファイル不在によるBM25検索の失敗**が原因

---

### 1. ⚠️ **Kuromoji辞書ファイル不在** - **最優先修正項目**

**影響度**: 🔴 **Critical** - 検索時間の70秒（約72%）に影響

#### エラーログ
```
[OptimizedLunrInitializer] Initialization failed: 
[Error: ENOENT: no such file or directory, open '/workspace/.next/standalone/node_modules/kuromoji/dict/base.dat.gz']

[searchLanceDB] Lunr index not ready, falling back to LIKE search
[BM25 Search] Lunr not ready... skipping

[searchLanceDB] Slow search: 69938ms (69.94s) for query: "求人詳細画面の仕様について教えてください"
```

#### 影響の詳細
- 日本語形態素解析（Kuromoji）の初期化失敗
- BM25検索（高速キーワード検索）が完全に無効化
- LIKE検索と救済検索にフォールバック → **約70秒の遅延**
- Vector検索のみに依存するため、より多くのページでチャンク統合が必要

#### なぜこれが最大の問題なのか？
```
Total search time: 96.5秒

内訳:
  - searchLanceDB: 69.9秒 (72%) ← Kuromoji問題
  - enrichWithAllChunks: 30.1秒 (31%) ← チャンク取得問題
  - その他: 3.5秒 (4%)
  
※重複時間があるため合計が100%を超える
```

---

### 2. **`getAllChunksByPageId` の異常な遅延** 

**影響度**: 🟡 **High** - チャンク統合に約30秒かかる

**発見**: 個別のチャンク取得に**約30秒**かかっている

#### 実際のログ例
```
[ChunkMerger] Page 1/12: Processing 702578724 - 【会員向けリファレンス】求人詳細画面 DB各項目の型
[getAllChunksByPageId] ⚡ Prefix match found in 29588ms for pageId: 702578724 (36 chunks)
[ChunkMerger] Page 1: Chunk retrieval took 29588ms for 36 chunks (pageId: 702578724)
[ChunkMerger] ⚠️ SLOW chunk retrieval detected!

[ChunkMerger] Page 2/12: Processing 686620791 - 原稿詳細画面
[getAllChunksByPageId] ⚡ Prefix match found in 30154ms for pageId: 686620791 (40 chunks)
[ChunkMerger] Page 2: Chunk retrieval took 30154ms for 40 chunks (pageId: 686620791)
[ChunkMerger] ⚠️ SLOW chunk retrieval detected!

[ChunkMerger] Page 3/12: Processing 724402327 - 【会員向けリファレンス】求人検索画面 DB各項目の型
[getAllChunksByPageId] ⚡ Prefix match found in 29616ms for pageId: 724402327 (40 chunks)
```

#### 影響範囲
- 12ページでチャンク統合が必要
- 各ページ平均30秒 × 12ページ = **約360秒分の遅延**
- 実測では並行処理により30.1秒に圧縮されているが、依然として異常に長い

#### なぜこんなに遅いのか？
```typescript
// 現在の実装（3段階フォールバック）
// 1. 完全一致 (FAST)
.where(`id = '${pageId}'`)

// 2. 前方一致 (MEDIUM) ← ここで30秒！
.where(`id LIKE '${pageId}%'`)

// 3. 制限付きスキャン (SLOW)
.query().limit(100)
```

**推測される原因**:
- LanceDB本番環境でのクエリパフォーマンス低下
- `LIKE` クエリがフルスキャンに近い動作をしている可能性
- インデックスが効いていない

---

## 🛠️ 緊急対応策（優先順位を変更）

### **Stage 1: Kuromoji辞書ファイル修正** 🔴 **最優先** 

#### 目的
BM25検索を復活させて、**検索時間の70秒（72%）を削減**

#### 現在の問題
```typescript
// next.config.ts の copy-webpack-plugin 設定
{
  from: path.resolve(__dirname, 'node_modules/kuromoji/dict'),
  to: path.resolve(__dirname, '.next/standalone/node_modules/kuromoji/dict'),
  noErrorOnMissing: true,
}
```

**問題点**:
- Firebase App Hostingのビルド環境では `/workspace/.next/standalone/` にデプロイされる
- しかし、辞書ファイルがこのパスに正しくコピーされていない
- `noErrorOnMissing: true` により、エラーが隠蔽されている

#### 解決策（3つのアプローチ）

**Option A: Standaloneモードの辞書パス修正** ⭐ **推奨**
```typescript
// next.config.ts
webpack: (config, { isServer }) => {
  if (isServer) {
    config.plugins.push(
      new (require('copy-webpack-plugin'))({
        patterns: [
          {
            from: path.resolve(__dirname, 'node_modules/kuromoji/dict'),
            to: path.resolve(__dirname, '.next/server/node_modules/kuromoji/dict'),
            noErrorOnMissing: false, // エラーを表示
          },
          // Standaloneモード用にも明示的にコピー
          {
            from: path.resolve(__dirname, 'node_modules/kuromoji/dict'),
            to: path.resolve(__dirname, '.next/standalone/node_modules/kuromoji/dict'),
            noErrorOnMissing: false,
          },
        ],
      })
    );
  }
}
```

**Option B: 環境変数でパスを動的に設定**
```typescript
// src/lib/optimized-lunr-initializer.ts
const KUROMOJI_DICT_PATH = process.env.KUROMOJI_DICT_PATH || 
  path.resolve(process.cwd(), 'node_modules/kuromoji/dict');
```

**Option C: 辞書ファイルを静的アセットとしてコピー**
```bash
# package.json scripts
"postbuild": "cp -r node_modules/kuromoji/dict .next/standalone/node_modules/kuromoji/"
```

#### 期待される効果
```
Before: 96.5秒
After:  30秒以内 (-69% / 3倍高速化)

内訳:
  - searchLanceDB: 69.9秒 → 5秒 (-93%)
  - enrichWithAllChunks: 30.1秒 → 20秒 (-33%, BM25による絞り込み効果)
  - AI生成: 14.2秒 → 14.2秒 (変化なし)
```

---

### **Stage 2: タイムアウトとスキップ** 🟡 **補完的対策** ✅ **実装済み**

**注意**: Stage 1（Kuromoji修正）を実施後、まだ遅延が残る場合のみ実施

#### 目的
個別のチャンク取得が5秒を超えた場合、タイムアウトしてスキップ

#### 実装内容
```typescript
async function getAllChunksByPageId(pageId: string): Promise<any[]> {
  // Phase 0A-4 EMERGENCY: 5秒タイムアウトを設定
  const TIMEOUT_MS = 5000;
  
  try {
    const result = await Promise.race([
      getAllChunksByPageIdInternal(pageId),
      new Promise<any[]>((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
      )
    ]);
    return result;
  } catch (error: any) {
    if (error.message.includes('Timeout')) {
      console.warn(`⚠️ [getAllChunksByPageId] Timeout (${TIMEOUT_MS}ms) for pageId: ${pageId}, skipping chunk enrichment`);
      return [];
    }
    console.error(`[getAllChunksByPageId] Error fetching chunks for pageId ${pageId}:`, error.message);
    return [];
  }
}
```

#### 期待される効果（Stage 1実施後の追加効果）
```
Before (Stage 1のみ): 30秒
After (Stage 1 + Stage 2): 25秒以内 (-17%追加削減)

チャンク取得タイムアウトにより:
  - enrichWithAllChunks: 20秒 → 5秒 (-75%)
```

**トレードオフ**:
- タイムアウトしたページはチャンク統合なし（最初のチャンクのみ）
- 回答品質への影響: 限定的（検索結果の上位は表示される）

---

## 📈 修正後の期待パフォーマンス

### Stage 1のみ（Kuromoji修正） ⭐ **最大の効果**
```
検索時間: 96.5秒 → 30秒以内 (-69% / 3倍高速化)
総処理時間: 110.8秒 → 44秒以内 (-60%)

内訳:
  - searchLanceDB: 69.9秒 → 5秒 (-93%)
  - enrichWithAllChunks: 30.1秒 → 20秒 (-33%)
  - AI生成: 14.2秒 → 14.2秒 (変化なし)
```

### Stage 1 + Stage 2（Kuromoji + タイムアウト）
```
検索時間: 96.5秒 → 25秒以内 (-74%)
総処理時間: 110.8秒 → 39秒以内 (-65%)

内訳:
  - searchLanceDB: 69.9秒 → 5秒 (-93%)
  - enrichWithAllChunks: 30.1秒 → 5秒 (-83%, タイムアウト効果)
  - AI生成: 14.2秒 → 14.2秒 (変化なし)
```

### 最終目標（Phase 5基準）
```
検索時間: 10秒以内
総処理時間: 30秒以内
```

---

## 🚀 次のアクション（優先順位を変更）

### **最優先実行（Stage 1: Kuromoji修正）**
1. 🔴 `next.config.ts` の `copy-webpack-plugin` 設定を修正（Option Aを実装）
2. 🔴 `noErrorOnMissing: false` に変更してエラーを可視化
3. 🔴 ローカルビルドでKuromoji辞書ファイルの存在を確認
4. 🔴 変更をコミット＆プッシュ
5. 🔴 本番デプロイ
6. 🔴 Cloud Loggingで `[OptimizedLunrInitializer] Initialization failed` エラーが消えたことを確認
7. 🔴 検索時間が30秒以内に短縮されたことを確認

### **補完的実施（Stage 2: タイムアウト）**
8. ✅ `getAllChunksByPageId` にタイムアウト実装（完了）
9. 🟡 Stage 1の効果確認後、まだ遅延が残る場合にデプロイ

### **短期（追加調査）**
10. 🔜 モニタリング権限の付与（`monitoring.metricDescriptors.create`）
11. 🔜 非推奨パッケージの更新（`npm audit fix`）

### **中長期（根本的解決）**
12. 🔜 LanceDBのインデックス最適化を検討
13. 🔜 チャンク取得クエリの再設計（`LIKE` クエリの代替案）
14. 🔜 チャンク統合ロジックの見直し（必要性の再評価）

---

## 📝 補足: なぜチャンク統合が必要なのか？

### 背景
Confluenceの大きなページは複数のチャンク（断片）に分割されてLanceDBに保存されています。

### 問題
Vector検索では、**1つのチャンクのみ**がヒットします。  
→ ページ全体のコンテキストが不足し、回答品質が低下

### 解決策（Phase 0A-1.5で導入）
検索結果の各ページについて、**全チャンクを取得して統合**し、完全なコンテキストをAIに提供

### トレードオフ
- ✅ 回答品質: 大幅向上（完全なコンテキスト）
- ❌ パフォーマンス: 本番環境でチャンク取得が異常に遅い（30秒/ページ）

### 今後の検討事項
- チャンク統合の必要性を再評価
- 代替案: チャンク分割時にオーバーラップを持たせる？
- 代替案: 検索時にTop-Kチャンクを取得（全チャンクではなく）

---

**作成者**: AI Assistant  
**最終更新**: 2025年10月20日  
**参考**: 外部分析レポート（遅延の原因分析）

