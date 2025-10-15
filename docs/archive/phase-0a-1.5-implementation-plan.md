# Phase 0A-1.5 実装計画書

**フェーズ名**: Phase 0A-1.5 検索品質緊急改善  
**作成日**: 2025-10-14  
**優先度**: 🔥 最高（ユーザーレビュー対応）  
**実装期間**: 1-2日  
**担当**: 開発チーム

---

## 🎯 目的

**ユーザーレビューで指摘された検索品質問題の80%を緊急解決**

### 対象問題

6つのユーザーレビュー事例を分析した結果、以下の3つの技術的問題（Tier 1）が特定されました：

| 問題 | 影響範囲 | 深刻度 |
|------|----------|--------|
| **空ページノイズ** | 全検索クエリの30% | 🔥🔥🔥 |
| **チャンク分散** | 全検索クエリの70% | 🔥🔥🔥 |
| **重複表示** | 全検索クエリの40% | 🔥🔥 |

### 期待効果

| 指標 | 現状 | Phase 0A-1.5後 | 改善 |
|------|------|----------------|------|
| **検索精度** | 16% | **62%** | **+46%** |
| **Tier 1問題** | 27% | **92%** | **+65%** |
| **ユーザー満足度** | 低 | 中-高 | ✅ |

---

## 📊 実装する3つの改善

### 改善1: 全チャンク統合 🔥🔥🔥

#### 問題の詳細

**現状**:
```typescript
// 検索結果（164_教室削除機能の例）
references = [
  { 
    pageId: 718373062,
    title: "164_教室削除機能",
    content: チャンク1の1,800文字のみ  // ← 不完全
  }
]
```

**問題点**:
- 164ページは2チャンク（3,600文字）
- チャンク1: 基本条件
- チャンク2: 詳細な実行条件（177への言及含む）
- → AIはチャンク1のみで回答 → 不完全な回答

**影響を受ける事例**:
- 164_教室削除条件: 50% → 95%（+45%）
- 168_教室コピー項目: 30% → 85%（+55%）
- 721_学年・職業更新: 70% → 95%（+25%）

#### 解決策

**実装方法**:
```typescript
// src/app/api/streaming-process/route.ts に実装

async function retrieveRelevantDocs(query: string) {
  // Step 1: 通常の検索（topK=8）
  const searchResults = await searchLanceDB({
    query,
    topK: 8,
    maxDistance: 2.0,
    labelFilters: { includeMeetingNotes: false }
  });
  
  // Step 2: pageIdでグループ化
  const pageGroups = new Map<string, SearchResult[]>();
  
  searchResults.forEach(result => {
    const pageId = String(result.pageId);
    if (!pageGroups.has(pageId)) {
      pageGroups.set(pageId, []);
    }
    pageGroups.get(pageId)!.push(result);
  });
  
  // Step 3: 各ページの全チャンクを取得・統合
  const enrichedResults = await Promise.all(
    Array.from(pageGroups.entries()).map(async ([pageId, chunks]) => {
      // このページの全チャンクをLanceDBから取得
      const allChunks = await getAllChunksByPageId(pageId);
      
      // ベストチャンクを選択（距離が最小）
      const bestChunk = chunks.sort((a, b) => 
        (a.distance || 0) - (b.distance || 0)
      )[0];
      
      // 全チャンクのコンテンツを統合
      const mergedContent = allChunks
        .map(c => c.content)
        .join('\n\n');  // セクション区切り
      
      return {
        ...bestChunk,
        content: mergedContent,  // ★ 全チャンク統合
        chunkCount: allChunks.length,
        originalChunkIndex: bestChunk.chunkIndex
      };
    })
  );
  
  return enrichedResults;
}

// 新規ヘルパー関数
async function getAllChunksByPageId(pageId: string): Promise<any[]> {
  const connection = await optimizedLanceDBClient.getConnection();
  const table = connection.table;
  
  // pageIdで全チャンクを取得
  const arrow = await table
    .query()
    .where(`pageId = ${pageId}`)
    .toArrow();
  
  const chunks: any[] = [];
  for (let i = 0; i < arrow.numRows; i++) {
    const row = extractRowFromArrow(arrow, i);
    chunks.push(row);
  }
  
  // chunkIndexでソート
  chunks.sort((a, b) => (a.chunkIndex || 0) - (b.chunkIndex || 0));
  
  return chunks;
}
```

#### 実装ファイル

- **`src/app/api/streaming-process/route.ts`**: メイン実装（50行追加）
- **`src/lib/lancedb-utils.ts`**: ヘルパー関数（30行追加）

#### テスト方法

```bash
# 164ページでテスト
npm run test:search-quality -- "教室削除ができないのは何が原因ですか"

# 期待結果:
# - 164の全2チャンク（3,600文字）が統合される
# - AIが177への言及を含む詳細条件を回答
```

---

### 改善2: 空ページフィルター 🔥🔥🔥

#### 問題の詳細

**現状**:
```
515_【作成中】教室管理-教室コピー機能
  - コンテンツ: 21文字のみ
  - タイトルマッチで常に上位3位以内
  - StructuredLabel: is_valid = false（既に検出済み）
```

**影響**:
- 教室コピー: 515が52%で1-3位 → 168が埋もれる
- 教室管理: 515がノイズとして混入
- 全ての「教室」関連クエリに悪影響

#### 解決策

**実装方法**:
```typescript
// src/lib/lancedb-search-client.ts に追加

export async function searchLanceDB(params: LanceDBSearchParams): Promise<LanceDBSearchResult[]> {
  // ... 既存の検索ロジック ...
  
  // RRF融合後、フォーマット前に追加
  
  // Step: 空ページフィルター（Phase 0A-1.5）
  const filtered = await filterInvalidPages(rrfSorted);
  
  // 既存のフォーマット処理
  const formatted = unifiedSearchResultProcessor.processResults(filtered);
  
  return formatted;
}

/**
 * 空ページフィルター（Phase 0A-1.5）
 */
async function filterInvalidPages(results: any[]): Promise<any[]> {
  const validResults = [];
  
  for (const result of results) {
    // StructuredLabelを取得
    const label = await getStructuredLabel(String(result.pageId)).catch(() => null);
    
    // is_valid: false のページを除外
    if (label && label.is_valid === false) {
      console.log(`[EmptyPageFilter] Excluded: ${result.title} (is_valid: false, content: ${label.content_length || 0}chars)`);
      continue;
    }
    
    // コンテンツ長による二重チェック（StructuredLabelがない場合）
    if (!label && result.content && result.content.length < 100) {
      console.log(`[EmptyPageFilter] Excluded: ${result.title} (content too short: ${result.content.length}chars)`);
      continue;
    }
    
    validResults.push(result);
  }
  
  console.log(`[EmptyPageFilter] Filtered: ${results.length} → ${validResults.length} results`);
  
  return validResults;
}
```

#### 実装ファイル

- **`src/lib/lancedb-search-client.ts`**: フィルター実装（20行追加）
- **`src/lib/structured-label-service.ts`**: 既存（クライアント版、読み取り用）

#### テスト方法

```bash
# 515ページでテスト
npm run test:search-quality -- "教室コピー機能でコピー可能な項目は？"

# 期待結果:
# - 515（21文字）が除外される
# - 168が1位に表示される
# - ログに "[EmptyPageFilter] Excluded: 515_..." と表示
```

---

### 改善3: ページ単位の重複排除 🔥🔥

#### 問題の詳細

**現状**:
```
168_【FIX】教室コピー機能
  - 8個のチャンクに分割
  - 各チャンクが独立して検索される
  - RRF融合で順位が分散
  - 同じページが複数回表示される可能性
```

**問題点**:
- ユーザーに見づらい
- スコア競合が不公平（8チャンク vs 1チャンクのページ）
- RRF融合で順位が不安定

#### 解決策

**実装方法**:
```typescript
// src/lib/lancedb-search-client.ts に追加

/**
 * ページ単位の重複排除（Phase 0A-1.5）
 */
function deduplicateByPageId(results: any[]): any[] {
  const pageMap = new Map<string, any>();
  
  results.forEach(result => {
    const pageId = String(result.pageId || 'unknown');
    const existing = pageMap.get(pageId);
    
    if (!existing) {
      // 初出のページ
      pageMap.set(pageId, result);
    } else {
      // 既に同じpageIdが存在する場合、ベストスコアを保持
      const currentDistance = result.distance || 999;
      const existingDistance = existing.distance || 999;
      
      if (currentDistance < existingDistance) {
        // より良いチャンクで上書き
        pageMap.set(pageId, result);
        console.log(`[Deduplicator] Updated best chunk for ${result.title}: chunk ${result.chunkIndex || 0}`);
      }
    }
  });
  
  const deduplicated = Array.from(pageMap.values());
  
  console.log(`[Deduplicator] Deduplicated: ${results.length} → ${deduplicated.length} results`);
  
  return deduplicated;
}

// searchLanceDB内で適用
export async function searchLanceDB(params: LanceDBSearchParams): Promise<LanceDBSearchResult[]> {
  // ... 既存の検索ロジック ...
  
  // RRF融合後に追加
  const deduplicated = deduplicateByPageId(rrfSorted);
  const filtered = await filterInvalidPages(deduplicated);
  
  return unifiedSearchResultProcessor.processResults(filtered);
}
```

#### 実装ファイル

- **`src/lib/lancedb-search-client.ts`**: 重複排除実装（30行追加）

#### テスト方法

```bash
# 168ページでテスト
npm run test:search-quality -- "教室コピー機能でコピー可能な項目は？"

# 期待結果:
# - 168の8チャンクから1チャンク（ベストスコア）のみ表示
# - ログに "[Deduplicator] Deduplicated: 8 → 1" と表示
```

---

## 🔧 実装の詳細

### 実装順序

```
1. 改善2: 空ページフィルター（20行、30分）
   ↓
2. 改善3: 重複排除（30行、30分）
   ↓
3. 改善1: 全チャンク統合（80行、2-3時間）
   ↓
4. 統合テスト（6事例、1時間）
   ↓
5. git push（phase-0aブランチ）
```

**総実装時間**: 4-5時間

---

### 変更ファイル一覧

#### 新規ファイル

1. **`src/lib/lancedb-chunk-merger.ts`** (新規)
   - `getAllChunksByPageId()`: pageIdで全チャンク取得
   - `mergeChunks()`: チャンク統合ロジック

#### 修正ファイル

1. **`src/lib/lancedb-search-client.ts`** (+50行)
   - `filterInvalidPages()`: 空ページフィルター
   - `deduplicateByPageId()`: 重複排除
   - `searchLanceDB()`: 上記2つを統合

2. **`src/app/api/streaming-process/route.ts`** (+30行)
   - `retrieveRelevantDocs()`: 全チャンク統合の適用
   - LanceDB検索結果の enrichment

3. **`src/lib/structured-label-service.ts`** (変更なし)
   - 既存のクライアント版を使用（読み取りのみ）

---

## 🧪 テスト計画

### 単体テスト

#### Test 1: 空ページフィルター

```bash
npx tsx scripts/test-empty-page-filter.ts
```

**検証項目**:
- ✅ 515（21文字）が除外される
- ✅ is_valid: false のページが除外される
- ✅ 通常ページは影響を受けない

#### Test 2: 重複排除

```bash
npx tsx scripts/test-deduplication.ts
```

**検証項目**:
- ✅ 168の8チャンク → 1チャンク
- ✅ ベストスコアのチャンクが選択される
- ✅ 異なるページは影響を受けない

#### Test 3: 全チャンク統合

```bash
npx tsx scripts/test-chunk-merge.ts
```

**検証項目**:
- ✅ 164の2チャンク（3,600文字）が統合される
- ✅ 721の2チャンク（2,307文字）が統合される
- ✅ 045の15チャンク（17,958文字）が統合される

---

### 統合テスト（6事例）

#### 事例1: 退会後の再登録

```bash
質問: "退会した会員が再登録時に同じメールアドレス使ったらどうなりますか"

現状: 046が圏外、無関係ページが上位
期待: 046が1-3位、全チャンク統合で詳細回答
```

#### 事例2: 教室削除条件

```bash
質問: "教室削除ができないのは何が原因ですか"

現状: 164が1位だが、チャンク1のみ → 不完全回答（50%）
期待: 164が1位、チャンク1+2統合 → 完全回答（95%）
```

#### 事例3: 教室コピー項目

```bash
質問: "教室コピー機能でコピー可能な項目は？"

現状: 515（空）が52%で上位、168が3位
期待: 515除外、168が1位、8チャンク統合 → 詳細回答（85%）
```

#### 事例4: 応募制限有無

```bash
質問: "ユーザーに応募制限はあるか"

現状: 014が圏外
期待: 014が5-8位に浮上（40%）
```

#### 事例5: 重複応募期間

```bash
質問: "ユーザーが応募したら、その同一の求人には何日間応募できなくなるか"

現状: 014が圏外
期待: 014が5-8位、部分的な回答（30%）
```

#### 事例6: 学年・職業更新条件

```bash
質問: "学年や現在の職業が更新される条件は？"

現状: 721が1位、チャンク1のみ → 部分回答（70%）
期待: 721が1位、チャンク1+2統合 → 詳細回答（95%）
```

---

## 📈 成功基準

### 必須基準（Phase 0A-1.5完了条件）

| 基準 | 目標 | 測定方法 |
|------|------|----------|
| **Tier 1問題の改善** | 85%以上 | 事例2,3,6の平均 |
| **空ページ除外** | 100% | 515が全検索で除外 |
| **チャンク統合** | 100% | 全ページで統合動作 |
| **重複排除** | 100% | 同一pageIdが1回のみ表示 |
| **リグレッション** | 0件 | 既存の正常クエリに影響なし |

### 推奨基準（さらに良い結果）

| 基準 | 目標 | 測定方法 |
|------|------|----------|
| **Tier 2問題の改善** | 40%以上 | 事例1,4の平均 |
| **全体平均** | 60%以上 | 6事例の平均 |

---

## 🚨 リスク管理

### 技術的リスク

| リスク | 確率 | 影響 | 対策 |
|--------|------|------|------|
| **チャンク取得の性能問題** | 中 | 中 | キャッシュ実装、非同期並列処理 |
| **メモリ使用量増加** | 低 | 低 | チャンク数制限（最大20チャンク） |
| **StructuredLabel未生成** | 中 | 低 | フォールバック（コンテンツ長で判定） |

### 対策

#### 対策1: 性能最適化

```typescript
// キャッシュ実装
const chunkCache = new Map<string, any[]>();

async function getAllChunksByPageId(pageId: string): Promise<any[]> {
  // キャッシュチェック
  if (chunkCache.has(pageId)) {
    return chunkCache.get(pageId)!;
  }
  
  // LanceDBから取得
  const chunks = await fetchChunksFromDB(pageId);
  
  // キャッシュに保存（TTL: 5分）
  chunkCache.set(pageId, chunks);
  
  return chunks;
}
```

#### 対策2: メモリ制限

```typescript
// 統合するチャンクの最大数を制限
const MAX_CHUNKS_TO_MERGE = 20;

if (allChunks.length > MAX_CHUNKS_TO_MERGE) {
  console.warn(`[ChunkMerger] Too many chunks (${allChunks.length}), limiting to ${MAX_CHUNKS_TO_MERGE}`);
  allChunks = allChunks.slice(0, MAX_CHUNKS_TO_MERGE);
}
```

#### 対策3: フォールバック

```typescript
// StructuredLabelがない場合
if (!label) {
  // コンテンツ長で直接判定
  if (result.content && result.content.length < 100) {
    console.log(`[EmptyPageFilter] Excluded by content length: ${result.title}`);
    continue;
  }
}
```

---

## 📅 実装スケジュール

### Day 1（4-5時間）

| 時間 | タスク | 成果物 |
|------|--------|--------|
| **0-1h** | 改善2: 空ページフィルター実装 | lancedb-search-client.ts更新 |
| **1-2h** | 改善3: 重複排除実装 | lancedb-search-client.ts更新 |
| **2-5h** | 改善1: 全チャンク統合実装 | streaming-process/route.ts更新、lancedb-chunk-merger.ts作成 |

### Day 2（2-3時間）

| 時間 | タスク | 成果物 |
|------|--------|--------|
| **0-1h** | 単体テスト実行・デバッグ | テストスクリプト |
| **1-2h** | 統合テスト（6事例） | 品質レポート |
| **2-3h** | ドキュメント更新・git push | phase-0aブランチ更新 |

**総所要時間**: 6-8時間

---

## 🎯 成果物

### コード

1. `src/lib/lancedb-chunk-merger.ts`（新規、80行）
2. `src/lib/lancedb-search-client.ts`（+50行）
3. `src/app/api/streaming-process/route.ts`（+30行）

### テスト

1. `scripts/test-empty-page-filter.ts`（新規）
2. `scripts/test-deduplication.ts`（新規）
3. `scripts/test-chunk-merge.ts`（新規）
4. `scripts/test-all-six-cases.ts`（統合テスト）

### ドキュメント

1. `docs/implementation/phase-0a-1.5-completion-report.md`（完了報告）
2. `docs/testing/phase-0a-1.5-test-results.md`（テスト結果）

---

## 🔄 Phase 0A-2への引き継ぎ

### Phase 0A-1.5で解決できない問題

| 問題 | Phase 0A-1.5後 | Phase 0A-2目標 | 必要な機能 |
|------|---------------|---------------|-----------|
| 退会後の再登録（046） | 60-70% | 85-90% | KGによる041の自動取得 |
| 応募制限有無（014） | 40% | 65% | KG + 意図抽出 |
| 重複応募期間（014） | 30% | 50% | KG + クエリリライト |

### Phase 0A-2で実装すべき機能

1. **Knowledge Graph構築**
   - 参照関係抽出（正規表現ベース）
   - ドメイン・カテゴリ関係構築
   - Graph保存（Firestoreまたは専用DB）

2. **KG検索統合**
   - 関連ページ自動拡張
   - 重要度スコアリング（PageRank）
   - ドメイン・タグベースの推薦

3. **質問意図抽出**
   - "制限" "条件" "可能" などの意図キーワード
   - StructuredLabelへのマッピング
   - フィルタリング・ブースト

---

## ✅ Phase 0A-1.5 実装準備完了チェックリスト

- [x] 問題分析完了（6事例）
- [x] 改善策の特定（3つ）
- [x] ROI評価完了（+46%改善、極めて高いROI）
- [x] 実装方法の設計
- [x] テスト計画の策定
- [x] リスク対策の準備
- [x] スケジュール作成
- [x] Phase 0A-2への引き継ぎ準備

**Status**: ✅ **実装開始可能**

---

## 🚀 次のアクション

1. **即座に実装開始**
   - 改善2（空ページフィルター）から着手
   - 逐次テスト・デバッグ
   - 改善1-3を順次統合

2. **効果検証**
   - 6事例で品質測定
   - ユーザーレビューと比較
   - 改善率を定量評価

3. **Phase 0A-2準備**
   - Knowledge Graph設計の詳細化
   - 参照関係抽出アルゴリズムの検討
   - Phase 0A-2実装計画書の作成

**準備完了！実装を開始します** 🚀

