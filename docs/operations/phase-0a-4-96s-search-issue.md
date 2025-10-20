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

### 1. **`getAllChunksByPageId` の異常な遅延** ⚠️

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
- 実測では並行処理により96.5秒に圧縮されているが、依然として異常に長い

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

### 2. **Kuromoji辞書ファイルが見つからない** ❌

#### エラーログ
```
[OptimizedLunrInitializer] Initialization failed: 
[Error: ENOENT: no such file or directory, open '/workspace/.next/standalone/node_modules/kuromoji/dict/base.dat.gz']
```

#### 影響
```
[searchLanceDB] Lunr index not ready, falling back to LIKE search
```

**結果**:
- BM25検索が完全に無効化
- Vector検索のみに依存
- より多くのページでチャンク統合が必要になり、遅延が累積

---

## 🛠️ 緊急対応策（2段階実装）

### **Stage 1: タイムアウトとスキップ** ✅ **実装済み**

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

#### 期待される効果
```
Before: 96.5秒 (30秒 × 12ページ)
After:  60秒以内 (5秒タイムアウト × 12ページ = 最大60秒)
改善率: 約38%削減
```

**トレードオフ**:
- タイムアウトしたページはチャンク統合なし（最初のチャンクのみ）
- 回答品質への影響: 限定的（検索結果の上位は表示される）

---

### **Stage 2: Kuromoji辞書ファイル修正** 🔜 **次のステップ**

#### 目的
BM25検索を復活させて、Vector検索の負荷を軽減

#### 解決策
`next.config.ts` の `copy-webpack-plugin` 設定を見直し、正しいパスにコピー

```typescript
// 現在の設定（動作していない）
{
  from: path.resolve(__dirname, 'node_modules/kuromoji/dict'),
  to: path.resolve(__dirname, '.next/standalone/node_modules/kuromoji/dict'),
  noErrorOnMissing: true,
}

// 修正案（次のステップで検討）
// Firebase App Hostingのビルド環境でのパス解決を確認
```

#### 期待される効果
- BM25検索の復活
- Vector検索結果の補完により精度向上
- チャンク統合が必要なページ数の削減（推定: 12→8ページ程度）

---

## 📈 修正後の期待パフォーマンス

### Stage 1のみ（タイムアウト実装）
```
検索時間: 96.5秒 → 60秒以内 (-38%)
総処理時間: 110.8秒 → 74秒以内 (-33%)
```

### Stage 1 + Stage 2（Kuromoji修正後）
```
検索時間: 96.5秒 → 40秒以内 (-59%)
総処理時間: 110.8秒 → 54秒以内 (-51%)
```

### 最終目標（Phase 5基準）
```
検索時間: 10秒以内
総処理時間: 30秒以内
```

---

## 🚀 次のアクション

### 即時実行
1. ✅ `getAllChunksByPageId` にタイムアウト実装（完了）
2. 🔜 変更をコミット＆プッシュ
3. 🔜 本番デプロイ
4. 🔜 Cloud Loggingで効果確認

### 短期（Stage 2）
5. 🔜 Kuromoji辞書ファイルのパス問題を調査
6. 🔜 Firebase App Hostingのビルド環境でのパス解決を確認
7. 🔜 `next.config.ts` を修正
8. 🔜 再デプロイ

### 中長期（根本的解決）
9. 🔜 LanceDBのインデックス最適化を検討
10. 🔜 チャンク取得クエリの再設計（`LIKE` クエリの代替案）
11. 🔜 チャンク統合ロジックの見直し（必要性の再評価）

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

