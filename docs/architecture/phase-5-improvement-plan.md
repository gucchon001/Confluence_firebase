# Phase 5: パフォーマンス最適化・品質向上計画

**作成日**: 2025-10-17  
**前提**: Phase 4（KG統合）完了  
**目標**: レスポンス速度の劇的改善とユーザー体験の向上  
**優先度**: 🔥 高（ユーザー体験に直接影響）

---

## 📋 エグゼクティブサマリー

### 現状評価（Phase 4完了時点）

| 項目 | 現状 | 評価 |
|------|------|------|
| **検索品質** | 100% (6/6) | 🌟 優秀 |
| **Gemini品質** | 4.67/5.00 | 🌟 優秀 |
| **ドキュメント発見** | 100% | ✅ 完璧 |
| **KG拡張** | 83% | ✅ 良好 |
| **レスポンス速度** | 19.8秒 | ❌ 遅い |

### Phase 5の目標

**メインゴール**: レスポンス速度を **19.8秒 → 3秒以内** に短縮（**85%削減**）

| 指標 | 現状 | Phase 5目標 | 改善 |
|------|------|-----------|------|
| **平均レスポンス時間** | 19.8秒 | **< 3秒** | **-85%** |
| **検索時間** | 7.7秒 | **< 0.5秒** | **-94%** |
| **Gemini時間** | 12.1秒 | **< 2.5秒** | **-79%** |
| **キャッシュヒット率** | 20% | **> 80%** | **+300%** |

---

## 🎯 Phase 5の3つの柱

### 1. 検索パフォーマンス最適化 ⚡

**現状の問題**:
```
平均検索時間: 7.7秒
├─ Case 1: 24.8秒（異常に遅い）
├─ Case 2-6: 3.5-6.2秒（許容範囲）
└─ キャッシュヒット: ~5ms（高速）
```

#### 1.1 LanceDB接続プーリング
**実装**: `src/lib/optimized-lancedb-client.ts`

```typescript
// 現状: 毎回接続を確立
const conn = await connect(dbPath);

// 改善: コネクションプール
class LanceDBConnectionPool {
  private connections: Connection[] = [];
  private maxConnections = 5;
  
  async getConnection(): Promise<Connection> {
    // プールから再利用
  }
}
```

**期待効果**: 検索時間 -30%

#### 1.2 ベクトル検索の並列化
**実装**: `src/lib/lancedb-search-client.ts`

```typescript
// 現状: 逐次実行
const vectorResults = await vectorSearch(query);
const keywordResults = await keywordSearch(query);
const titleResults = await titleSearch(query);

// 改善: 並列実行
const [vectorResults, keywordResults, titleResults] = await Promise.all([
  vectorSearch(query),
  keywordSearch(query),
  titleSearch(query)
]);
```

**期待効果**: 検索時間 -40%

#### 1.3 KG拡張の最適化
**実装**: `src/lib/lancedb-search-client.ts`

```typescript
// 現状: Firestoreへの逐次クエリ
for (const result of results) {
  const refs = await kgSearchService.getReferencedPages(result.pageId, 3);
}

// 改善: バッチクエリ
const pageIds = results.map(r => r.pageId);
const allRefs = await kgSearchService.getBatchReferencedPages(pageIds, 3);
```

**期待効果**: KG拡張時間 -60%

#### 1.4 検索結果キャッシュの拡大
**実装**: `src/lib/lancedb-search-client.ts`

```typescript
// 現状
const cache = new GenericCache({
  ttl: 5 * 60 * 1000,    // 5分
  maxSize: 1000
});

// 改善
const cache = new GenericCache({
  ttl: 15 * 60 * 1000,   // 15分に延長
  maxSize: 5000,         // 5倍に拡大
  preload: true          // 頻出クエリをプリロード
});
```

**期待効果**: キャッシュヒット率 20% → 80%

---

### 2. Geminiパフォーマンス最適化 🤖

**現状の問題**:
```
平均Gemini時間: 12.1秒
├─ Case 1: 16.1秒（1706文字）
├─ Case 6: 15.0秒（2058文字）
└─ Case 4: 3.3秒（105文字）← 回答長に比例
```

#### 2.1 プロンプトの最適化
**実装**: `src/ai/flows/summarize-confluence-docs.ts`

```typescript
// 現状: 全ドキュメントを送信
const contextText = documents.map(doc => 
  `${doc.title}\n${doc.content}`  // 全文送信
).join('\n\n');

// 改善: 関連部分のみ抽出
const contextText = documents.map(doc => {
  const relevantChunks = extractRelevantChunks(doc.content, query, maxLength: 500);
  return `${doc.title}\n${relevantChunks}`;
}).join('\n\n');
```

**期待効果**: 
- トークン数 -50%
- 生成時間 -30%
- コスト -50%

#### 2.2 ストリーミングレスポンスの活用
**実装**: `src/app/api/streaming-process/route.ts`

```typescript
// 現状: 完全な回答を待ってから返却
const answer = await generateAnswer(query, docs);
return answer;

// 改善: ストリーミング開始を早める
const stream = generateAnswerStream(query, docs);
// 最初のトークンを即座に返却
return stream;
```

**期待効果**: 体感速度 -70%（TTFB改善）

#### 2.3 回答キャッシュの実装
**実装**: 新規 `src/lib/answer-cache.ts`

```typescript
class AnswerCache {
  private cache = new Map<string, CachedAnswer>();
  
  async getOrGenerate(query: string, docs: any[]): Promise<string> {
    const key = this.generateKey(query, docs);
    
    if (this.cache.has(key)) {
      return this.cache.get(key).answer;  // 即座に返却
    }
    
    const answer = await generateAnswer(query, docs);
    this.cache.set(key, { answer, timestamp: Date.now() });
    return answer;
  }
}
```

**期待効果**: 同一質問の2回目以降 < 100ms

---

### 3. ユーザー体験の向上 ✨

#### 3.1 プログレッシブレスポンス
**実装**: フロントエンド改善

```typescript
// 段階的な情報表示
1. 検索開始: "検索中..." (0ms)
2. 検索完了: "5件のドキュメント発見" (500ms)
3. 生成開始: "回答生成中..." (600ms)
4. ストリーミング: 回答を逐次表示 (1000ms~)
```

**効果**: ユーザーの待機感 -80%

#### 3.2 最適化されたtopKの動的調整
**実装**: `src/lib/lancedb-search-client.ts`

```typescript
// 現状: 固定topK=30（過剰）
const results = await searchLanceDB({ query, topK: 30 });

// 改善: クエリタイプに応じて調整
const topK = determineOptimalTopK(query);
// シンプルなクエリ: topK=5
// 複雑なクエリ: topK=10
// KG拡張が期待されるクエリ: topK=15
```

**期待効果**: 検索時間 -20%, Gemini時間 -15%

#### 3.3 バックグラウンドKG拡張
**実装**: `src/lib/lancedb-search-client.ts`

```typescript
// 現状: KG拡張完了を待つ
const kgExpanded = await expandWithKG(results);
return kgExpanded;

// 改善: 初期結果を即返却、KG拡張は非同期
const initialResults = results.slice(0, 5);
Promise.resolve(expandWithKG(results)).then(expanded => {
  updateCache(query, expanded);  // キャッシュ更新
});
return initialResults;  // 即座に返却
```

**期待効果**: 初回レスポンス時間 -50%

---

## 📊 実装計画

### Week 1: 検索パフォーマンス最適化

| タスク | 工数 | 優先度 |
|-------|------|--------|
| LanceDB接続プーリング | 1日 | 🔥 高 |
| 並列検索実装 | 1日 | 🔥 高 |
| KG拡張バッチクエリ | 1日 | 🔥 高 |
| キャッシュ拡大 | 0.5日 | 中 |
| テスト・検証 | 0.5日 | 必須 |

### Week 2: Geminiパフォーマンス最適化

| タスク | 工数 | 優先度 |
|-------|------|--------|
| プロンプト最適化 | 1日 | 🔥 高 |
| 回答キャッシュ実装 | 1日 | 🔥 高 |
| 関連チャンク抽出 | 1日 | 中 |
| ストリーミング改善 | 1日 | 中 |
| テスト・検証 | 1日 | 必須 |

### Week 3: UX改善・統合テスト

| タスク | 工数 | 優先度 |
|-------|------|--------|
| プログレッシブレスポンス | 1日 | 高 |
| 動的topK調整 | 0.5日 | 中 |
| バックグラウンドKG拡張 | 1日 | 中 |
| 統合テスト | 1日 | 必須 |
| ドキュメント更新 | 0.5日 | 必須 |

**合計工数**: 約3週間（15営業日）

---

## 🎯 成功基準

### 必須基準（最小成功）

| 指標 | 現状 | 目標 |
|------|------|------|
| **平均レスポンス時間** | 19.8秒 | **< 5秒** |
| **検索時間** | 7.7秒 | **< 1秒** |
| **検索品質** | 100% | **100%維持** |
| **Gemini品質** | 4.67/5.00 | **4.5/5.00維持** |

### 目標基準（完全成功）

| 指標 | 現状 | 目標 |
|------|------|------|
| **平均レスポンス時間** | 19.8秒 | **< 3秒** |
| **検索時間** | 7.7秒 | **< 0.5秒** |
| **キャッシュヒット率** | ~20% | **> 80%** |
| **TTFB（体感速度）** | 19.8秒 | **< 1秒** |

---

## 📈 期待効果

### パフォーマンス改善

```
現状（Phase 4）:
  検索: 7.7秒 + Gemini: 12.1秒 = 合計 19.8秒

Phase 5目標:
  検索: 0.5秒 + Gemini: 2.5秒 = 合計 3.0秒
  
改善率: 85%削減 ⚡
```

### ユーザー体験への影響

| ユーザー行動 | 現状 | Phase 5後 |
|------------|------|----------|
| **質問送信** | 0秒 | 0秒 |
| **検索完了表示** | 7.7秒 | **0.5秒** ⚡ |
| **回答開始** | 19.8秒 | **1.0秒** ⚡ |
| **回答完了** | 19.8秒 | **3.0秒** ⚡ |

**体感速度**: "遅い" → "高速" ✨

---

## 🔧 技術的詳細

### 最適化1: LanceDB接続プーリング

#### 現状の問題
```typescript
// 毎回新しい接続を確立
async function searchLanceDB(query: string) {
  const conn = await optimizedLanceDBClient.getConnection();  // 遅延発生
  const results = await conn.table.search(query);
  return results;
}
```

**問題点**:
- 接続確立に200-300ms
- Case 1で異常に遅い（24.8秒）

#### 改善策
```typescript
class LanceDBConnectionPool {
  private pool: Connection[] = [];
  private readonly maxConnections = 3;
  private readonly minConnections = 1;
  
  async getConnection(): Promise<Connection> {
    // アイドル接続を再利用
    const idle = this.pool.find(c => !c.inUse);
    if (idle) {
      idle.inUse = true;
      return idle;
    }
    
    // プールに空きがあれば新規作成
    if (this.pool.length < this.maxConnections) {
      const conn = await this.createConnection();
      this.pool.push(conn);
      return conn;
    }
    
    // 空きを待機
    return this.waitForAvailableConnection();
  }
}
```

**期待効果**: 
- 接続時間: 200-300ms → < 10ms
- Case 1異常遅延の解消

---

### 最適化2: 並列検索実装

#### 現状の問題
```typescript
// 逐次実行（合計時間 = 各処理の合計）
const vectorResults = await vectorSearch(query);      // 150ms
const keywordResults = await keywordSearch(query);    // 30ms
const titleResults = await titleSearch(query);        // 80ms
// 合計: 260ms
```

#### 改善策
```typescript
// 並列実行（合計時間 = 最長処理）
const [vectorResults, keywordResults, titleResults] = await Promise.all([
  vectorSearch(query),      // 150ms
  keywordSearch(query),     // 30ms
  titleSearch(query)        // 80ms
]);
// 合計: 150ms（最長処理のみ）
```

**期待効果**: 検索時間 -42%（260ms → 150ms）

---

### 最適化3: KGバッチクエリ

#### 現状の問題
```typescript
// 各ページごとにFirestoreクエリ（N回）
for (const result of top10Results) {
  const refs = await kgSearchService.getReferencedPages(result.pageId, 3);
  // Firestoreクエリ × 10回 = 250ms × 10 = 2500ms
}
```

#### 改善策
```typescript
// バッチクエリで一括取得（1回）
const pageIds = top10Results.map(r => r.pageId);
const allRefs = await kgSearchService.getBatchReferencedPages(pageIds, {
  maxReferencesPerPage: 3,
  minWeight: 0.7
});
// Firestoreクエリ × 1回 = 500ms

// ページごとに分配
for (const result of top10Results) {
  result.kgRefs = allRefs[result.pageId] || [];
}
```

**実装**: 新規メソッド追加

```typescript
// src/lib/kg-search-service.ts
class KGSearchService {
  async getBatchReferencedPages(
    pageIds: string[],
    options: { maxReferencesPerPage: number; minWeight: number }
  ): Promise<Map<string, KGNode[]>> {
    // Firestore IN クエリで一括取得
    const nodeIds = pageIds.map(id => `page-${id}`);
    
    // バッチクエリ（最大30件まで、それ以上は分割）
    const batches = chunkArray(nodeIds, 30);
    const allEdges = await Promise.all(
      batches.map(batch => 
        this.db.collection('knowledge_graph_edges')
          .where('fromNodeId', 'in', batch)
          .where('weight', '>=', options.minWeight)
          .get()
      )
    );
    
    // ページごとにグループ化
    return this.groupByPage(allEdges, options.maxReferencesPerPage);
  }
}
```

**期待効果**: KG拡張時間 2.5秒 → 0.5秒（-80%）

---

### 最適化4: プロンプト最適化

#### 現状の問題
```typescript
// 全ドキュメントの全文を送信
documents.forEach(doc => {
  contextText += `${doc.title}\n${doc.content}\n\n`;
  // doc.content = 3000-5000文字 × 5件 = 15,000-25,000文字
});

// Geminiへ送信
// → トークン数: 約10,000-15,000トークン
// → 生成時間: 12秒
```

#### 改善策A: 関連チャンク抽出
```typescript
function extractRelevantChunks(content: string, query: string, maxLength: 500): string {
  // クエリキーワードを含む段落を優先抽出
  const keywords = extractKeywords(query);
  const paragraphs = content.split('\n\n');
  
  const scored = paragraphs.map(p => ({
    text: p,
    score: keywords.filter(k => p.includes(k)).length
  }));
  
  // スコア順にソート、maxLengthまで抽出
  return scored
    .sort((a, b) => b.score - a.score)
    .reduce((acc, p) => {
      if (acc.length + p.text.length <= maxLength) {
        return acc + p.text + '\n\n';
      }
      return acc;
    }, '');
}
```

#### 改善策B: 要約済みコンテンツの活用
```typescript
// LanceDBに要約フィールドを追加
interface ConfluenceSchema {
  // ... 既存フィールド
  summary: string;  // 500文字の要約（事前生成）
}

// プロンプト生成時
const contextText = documents.map(doc => 
  `${doc.title}\n${doc.summary}`  // 要約のみ使用
).join('\n\n');
```

**期待効果**: 
- トークン数: 15,000 → 3,000（-80%）
- Gemini時間: 12秒 → 3秒（-75%）
- コスト: -80%

---

## 🧪 テスト計画

### パフォーマンステスト

```typescript
// scripts/test-phase-5-performance.ts

const TEST_CASES = [
  // 既存の6ケース
  { query: "会員の退会手続きを教えて", targetTime: 3000 },
  { query: "教室削除ができないのは何が原因ですか", targetTime: 3000 },
  { query: "教室をコピーする方法を教えてください", targetTime: 3000 },
  { query: "重複応募不可期間はいつからいつまでですか", targetTime: 3000 },
  { query: "求人に応募できる期間はいつまでですか", targetTime: 3000 },
  { query: "塾講師プロフィールの学年・職業を更新", targetTime: 3000 }
];

// 成功基準
const SUCCESS_CRITERIA = {
  avgResponseTime: 3000,    // 平均3秒以内
  maxResponseTime: 5000,    // 最大5秒以内
  searchTime: 500,          // 検索0.5秒以内
  geminiTime: 2500,         // Gemini2.5秒以内
  cacheHitRate: 0.8,        // キャッシュヒット率80%以上
  qualityMaintained: 4.5    // 品質スコア4.5/5.00維持
};
```

### 品質維持テスト

```typescript
// 最適化後も検索品質とGemini品質を維持
const QUALITY_TESTS = {
  searchDiscoveryRate: 1.0,     // 100%維持
  geminiQualityScore: 4.67,     // 4.67/5.00維持
  keywordCoverage: 0.8,         // 80%以上
  answerCompleteness: 0.9       // 90%以上
};
```

---

## 📋 実装優先順位

### 🔥 最優先（Week 1）

1. **LanceDB接続プーリング** 
   - Case 1の異常遅延を解消
   - 期待効果: -30%

2. **並列検索実装**
   - 即座に効果が出る
   - 期待効果: -42%

3. **キャッシュ拡大**
   - 実装コスト最小
   - 期待効果: ヒット率 +60%

### 🟡 高優先（Week 2）

4. **KGバッチクエリ**
   - KG拡張の高速化
   - 期待効果: -60%

5. **プロンプト最適化**
   - Gemini時間の大幅短縮
   - 期待効果: -30%

6. **回答キャッシュ**
   - 2回目以降が劇的に高速化
   - 期待効果: < 100ms

### 🟢 中優先（Week 3）

7. **動的topK調整**
   - 過剰な検索を削減
   - 期待効果: -20%

8. **プログレッシブレスポンス**
   - UX改善
   - 期待効果: 体感速度 -70%

---

## 🚀 Phase 5完了後の姿

### パフォーマンス

```
╔════════════════════════════════════════════════════════════╗
║              Phase 5完了後の目標状態                       ║
╚════════════════════════════════════════════════════════════╝

⚡ 平均レスポンス時間: 3秒以内
  ├─ 検索: 0.5秒
  ├─ KG拡張: 0.5秒（バッチクエリ）
  └─ Gemini: 2.0秒（プロンプト最適化）

🎯 キャッシュヒット時: < 100ms
  └─ 検索・回答両方をキャッシュから返却

✨ 体感速度: 1秒で回答開始
  └─ ストリーミング + プログレッシブ表示
```

### 品質維持

```
✅ 検索品質: 100%維持
✅ Gemini品質: 4.67/5.00維持
✅ KG拡張: 83%維持
✅ 機能安定性: 高い
```

---

## 🔗 関連ドキュメント

- [Phase 4完了レポート](../implementation/phase-4-kg-integration-completion-report.md)
- [ハイブリッド検索仕様書](./hybrid-search-specification-latest.md)
- [Genkit移行ロードマップ](./genkit-migration-and-expansion-roadmap.md)
- [基盤強化優先戦略](./foundation-first-strategy.md)

---

## 📝 備考

### Phase 5 vs Genkit移行

**Phase 5**: 現行システムの最適化（3週間）
- 既存コードベースで実施
- リスク低、効果即座

**Genkit移行**: アーキテクチャ刷新（3-6ヶ月）
- 長期的な拡張性向上
- リスク中、効果長期的

**推奨**: Phase 5を先に実施 → Genkit移行は別途計画

---

**文責**: AI Agent  
**承認**: 開発チーム  
**実施開始**: Phase 4完了後、即座に着手可能

