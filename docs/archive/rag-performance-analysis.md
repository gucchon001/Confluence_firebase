# RAGシステムのパフォーマンス分析と改善提案

## 作成日
2025年10月9日

## 現在のパフォーマンス状況

### 計測結果（平均値）
- **検索時間**: 7-12秒
- **AI生成時間**: 15-17秒
- **総処理時間**: 29-43秒

### ユーザー体験への影響
- ⚠️ 30秒以上の待機時間は、ユーザーにとって非常に長い
- ⚠️ リアルタイム性が損なわれている
- ⚠️ 複数回の質問が困難

---

## 現在のアーキテクチャの分析

### ✅ 良い点

1. **ハイブリッド検索の実装**
   - ベクトル検索（意味的類似性）
   - BM25検索（キーワードマッチング）
   - タイトル完全一致検索
   - 並列実行による効率化

2. **高度なスコアリング**
   - RRF（Reciprocal Rank Fusion）による統合
   - ドメイン知識ベースによるキーワード拡張
   - ラベルベースのフィルタリング

3. **品質管理**
   - 距離閾値によるフィルタリング
   - ラベルによる除外（議事録、メール通知など）
   - 重複除去

### ❌ 問題点と改善の余地

#### 1. **検索の問題点**

**問題1-1: 過剰な検索範囲**
- 現状: ベクトル検索で30-100件、BM25で100件取得
- 影響: データ転送量が多く、処理時間が長い
- **改善案**: 
  - 早期終了（Early Termination）: 十分な品質の結果が見つかり次第、検索を停止
  - 適応的topK: クエリの複雑さに応じてtopKを動的に調整（簡単な質問は10件、複雑な質問は50件）

**問題1-2: 重複処理**
- 現状: 各検索手法が独立して実行され、後で重複除去
- 影響: 無駄な処理が多い
- **改善案**:
  - インクリメンタル統合: 各検索結果を逐次的に統合し、重複チェックを早期に実行
  - Bloom Filter: 既に見つかったドキュメントIDを高速にチェック

**問題1-3: 並列処理の限界**
- 現状: ベクトル検索、BM25検索、キーワード検索を並列実行
- 影響: 最も遅い検索が全体のボトルネックになる
- **改善案**:
  - カスケード検索: 高速な検索（タイトル一致、キャッシュ）を先に実行し、結果が不十分な場合のみ重い検索を実行
  - タイムアウト: 一定時間内に得られた結果のみを使用

**問題1-4: キャッシュの不足**
- 現状: 検索結果のキャッシュは実装されているが、限定的
- 影響: 同じクエリでも毎回フル検索が実行される
- **改善案**:
  - 階層的キャッシュ: クエリキャッシュ、エンベディングキャッシュ、結果キャッシュ
  - LRU（Least Recently Used）キャッシュ: メモリ効率的なキャッシュ管理
  - プリフェッチ: よくある質問を事前にキャッシュ

#### 2. **AI生成の問題点**

**問題2-1: プロンプトサイズが大きい**
- 現状: 5文書 × 800文字 = 4,000文字以上のコンテキスト
- 影響: LLMの処理時間が長い（15-17秒）
- **改善案**:
  - 動的コンテキスト削減: 質問の複雑さに応じてコンテキストサイズを調整
  - 要約の活用: 長い文書は事前に要約し、必要に応じて詳細を取得
  - チャンク選択の精緻化: 文書全体ではなく、最も関連性の高いチャンクのみを使用

**問題2-2: LLMの選択**
- 現状: Gemini 2.5 Flash（高品質だが中速）
- 影響: 10-17秒の生成時間
- **改善案**:
  - モデルの段階的使用: 
    - 簡単な質問 → Gemini 1.5 Flash-8B（超高速、3-5秒）
    - 複雑な質問 → Gemini 2.5 Flash（現在のまま）
  - ストリーミングの最適化: チャンクサイズを動的に調整

**問題2-3: 冗長な出力**
- 現状: maxOutputTokens=4096で、LLMが長い回答を生成
- 影響: 生成時間が長く、ユーザーが読むのも大変
- **改善案**:
  - 質問タイプの分類: 「概要」「詳細」「一覧」を自動判定し、適切な長さで回答
  - 段階的開示: 最初は概要のみ、ユーザーが「詳しく」と言ったら詳細を生成

#### 3. **アーキテクチャ全体の問題点**

**問題3-1: シーケンシャル処理**
- 現状: 検索 → AI生成 → 保存 の順次処理
- 影響: 各ステップの待機時間が累積
- **改善案**:
  - パイプライン処理: 検索結果の一部が得られたらすぐにAI生成を開始
  - バックグラウンド保存: ログ保存を非同期化

**問題3-2: 単一検索戦略**
- 現状: 全ての質問に同じ検索アルゴリズムを適用
- 影響: 簡単な質問にも重い処理、複雑な質問には不十分
- **改善案**:
  - 質問分類: 
    - ファクト質問（「ログイン方法は？」）→ キャッシュ + タイトル一致
    - 手順質問（「どのように行いますか」）→ フルハイブリッド検索
    - 一覧質問（「項目は？」）→ 構造化データ抽出
  - 適応的検索: 初回検索で結果が不十分なら、段階的に検索範囲を拡大

**問題3-3: コールドスタート問題**
- 現状: サーバー起動時の初期化に時間がかかる（Kuromoji、Lunrなど）
- 影響: 最初の質問が特に遅い
- **改善案** （既に一部実装済み）:
  - ✅ 遅延初期化
  - ✅ 永続キャッシュ
  - さらに: ウォームアップエンドポイント（サーバー起動直後に自動実行）

---

## 改善提案の優先順位

### 🔴 優先度：高（即座に実装可能、大きな効果）

#### A1. **検索結果のインテリジェントキャッシュ**
- **実装難易度**: 低
- **期待効果**: 同じ質問で5-10秒削減
- **実装方法**:
  ```typescript
  // クエリの正規化 + セマンティックハッシュでキャッシュキー生成
  const cacheKey = await generateSemanticCacheKey(query);
  const cached = await redis.get(cacheKey); // or メモリキャッシュ
  if (cached) return JSON.parse(cached);
  ```

#### A2. **質問タイプの自動分類**
- **実装難易度**: 中
- **期待効果**: 簡単な質問で10-20秒削減
- **実装方法**:
  ```typescript
  function classifyQuestion(query: string): 'simple' | 'complex' | 'list' {
    if (/^(何|いつ|どこ|誰)/.test(query)) return 'simple'; // ファクト質問
    if (/(一覧|リスト|項目)/.test(query)) return 'list'; // 一覧質問
    return 'complex'; // 手順・詳細質問
  }
  
  // 質問タイプに応じた処理
  switch (classifyQuestion(query)) {
    case 'simple':
      topK = 3; // 最小限の検索
      maxTokens = 1024; // 簡潔な回答
      break;
    case 'list':
      topK = 10; // 多めに検索
      maxTokens = 2048; // 表形式
      break;
    case 'complex':
      topK = 30; // フル検索
      maxTokens = 4096; // 詳細な回答
      break;
  }
  ```

#### A3. **段階的検索（Cascade Search）**
- **実装難易度**: 中
- **期待効果**: 平均5-10秒削減
- **実装方法**:
  ```typescript
  // 1. 高速検索（タイトル一致、キャッシュ）
  let results = await fastSearch(query);
  
  // 2. 結果が十分か判定
  if (results.length >= 3 && results[0].score > 0.8) {
    return results; // 早期終了
  }
  
  // 3. 必要に応じて重い検索
  const additionalResults = await fullHybridSearch(query);
  return mergeResults(results, additionalResults);
  ```

### 🟡 優先度：中（効果的だが実装に時間がかかる）

#### B1. **LLMのストリーミング最適化**
- **実装難易度**: 中
- **期待効果**: 体感速度が大幅に向上（実際の時間は変わらないが、最初のチャンクが早く表示される）
- **実装方法**:
  - チャンクサイズの削減: 100文字 → 50文字
  - バッファリングの削除: `setTimeout(resolve, 50)` → 即座に送信

#### B2. **エンベディングの事前計算**
- **実装難易度**: 低
- **期待効果**: 検索時間1-2秒削減
- **実装方法**:
  - よくある質問のエンベディングを事前計算
  - 類似質問の検出 → 既存のエンベディングを再利用

#### B3. **検索結果の事前フィルタリング**
- **実装難易度**: 低
- **期待効果**: 検索時間2-3秒削減
- **実装方法**:
  - ラベルフィルタをLanceDBのWHERE句で実行（現在はアプリ側）
  - 不要な文書をDBレベルで除外

### 🟢 優先度：低（長期的な改善、大規模な再設計が必要）

#### C1. **GraphRAGの導入**
- **実装難易度**: 高
- **期待効果**: 検索精度が大幅に向上、複雑な質問への対応力向上
- **実装方法**: `docs/architecture/graphrag-tuned-architecture.md`参照

#### C2. **分散検索の実装**
- **実装難易度**: 高
- **期待効果**: スケーラビリティの向上
- **実装方法**: 複数のLanceDBインスタンスに分散

#### C3. **専用ハードウェアの活用**
- **実装難易度**: 中
- **期待効果**: ベクトル検索が2-5倍高速化
- **実装方法**: GPU対応のベクトル検索エンジン（Milvus、Weaviateなど）

---

## 推奨される実装順序

### フェーズ1（即座に実装可能）
1. **検索結果のセマンティックキャッシュ** （A1）
2. **質問タイプの自動分類** （A2）
3. **検索結果の事前フィルタリング** （B3）

**期待効果**: 総処理時間 29s → **15-20s**（30-50%削減）

### フェーズ2（1-2週間で実装）
4. **段階的検索（Cascade Search）** （A3）
5. **LLMのストリーミング最適化** （B1）
6. **エンベディングの事前計算** （B2）

**期待効果**: 総処理時間 15-20s → **10-15s**（さらに30%削減）

### フェーズ3（長期的な改善）
7. **GraphRAGの導入** （C1）
8. **専用ハードウェアの活用** （C3）

**期待効果**: 総処理時間 10-15s → **5-8s**（さらに40%削減）

---

## 具体的な実装コード例

### 1. セマンティックキャッシュ（A1）

```typescript
// src/lib/semantic-cache.ts
import crypto from 'crypto';

interface CacheEntry {
  results: any[];
  timestamp: number;
  hits: number;
}

class SemanticCache {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL = 3600000; // 1時間
  private readonly MAX_SIZE = 1000; // 最大1000エントリ

  async get(query: string): Promise<any[] | null> {
    // クエリの正規化
    const normalizedQuery = this.normalizeQuery(query);
    const key = this.generateKey(normalizedQuery);
    
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // TTLチェック
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    
    // ヒット数を増やす
    entry.hits++;
    console.log(`🚀 セマンティックキャッシュヒット: "${query}" (${entry.hits}回目)`);
    
    return entry.results;
  }

  async set(query: string, results: any[]): Promise<void> {
    const normalizedQuery = this.normalizeQuery(query);
    const key = this.generateKey(normalizedQuery);
    
    // キャッシュサイズ制限
    if (this.cache.size >= this.MAX_SIZE) {
      this.evictLRU();
    }
    
    this.cache.set(key, {
      results,
      timestamp: Date.now(),
      hits: 0
    });
  }

  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .trim()
      .replace(/[？！。、\s]+/g, ' ')
      .replace(/です|ます|ください/g, '');
  }

  private generateKey(query: string): string {
    return crypto.createHash('md5').update(query).digest('hex');
  }

  private evictLRU(): void {
    // 最もヒット数が少ないエントリを削除
    let minHits = Infinity;
    let minKey = '';
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.hits < minHits) {
        minHits = entry.hits;
        minKey = key;
      }
    }
    
    if (minKey) {
      this.cache.delete(minKey);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  stats(): { size: number; hitRate: number } {
    let totalHits = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
    }
    return {
      size: this.cache.size,
      hitRate: totalHits / Math.max(this.cache.size, 1)
    };
  }
}

export const semanticCache = new SemanticCache();
```

### 2. 質問タイプの自動分類（A2）

```typescript
// src/lib/question-classifier.ts
export type QuestionType = 'simple' | 'complex' | 'list' | 'procedural';

export interface QuestionConfig {
  topK: number;
  maxOutputTokens: number;
  contextDocs: number;
  charsPerDoc: number;
}

export class QuestionClassifier {
  classify(query: string): QuestionType {
    const q = query.toLowerCase();
    
    // 一覧質問
    if (/(一覧|リスト|項目|表|テーブル)/.test(q)) {
      return 'list';
    }
    
    // 手順質問
    if (/(どのように|方法|手順|やり方|流れ)/.test(q)) {
      return 'procedural';
    }
    
    // ファクト質問（簡単）
    if (/^(何|いつ|どこ|誰|いくつ)/.test(q) && q.length < 20) {
      return 'simple';
    }
    
    // 複雑な質問（デフォルト）
    return 'complex';
  }

  getConfig(type: QuestionType): QuestionConfig {
    const configs: Record<QuestionType, QuestionConfig> = {
      simple: {
        topK: 10,
        maxOutputTokens: 1024,
        contextDocs: 3,
        charsPerDoc: 500
      },
      list: {
        topK: 15,
        maxOutputTokens: 2048,
        contextDocs: 5,
        charsPerDoc: 600
      },
      procedural: {
        topK: 20,
        maxOutputTokens: 3072,
        contextDocs: 5,
        charsPerDoc: 700
      },
      complex: {
        topK: 30,
        maxOutputTokens: 4096,
        contextDocs: 5,
        charsPerDoc: 800
      }
    };
    
    return configs[type];
  }
}

export const questionClassifier = new QuestionClassifier();
```

### 3. 段階的検索（A3）

```typescript
// src/lib/cascade-search.ts
export async function cascadeSearch(query: string): Promise<any[]> {
  console.log('🔍 段階的検索開始:', query);
  
  // レベル1: キャッシュチェック（0.1秒）
  const cached = await semanticCache.get(query);
  if (cached && cached.length >= 3) {
    console.log('✅ レベル1: キャッシュヒット');
    return cached;
  }
  
  // レベル2: タイトル完全一致検索（0.5秒）
  const titleResults = await searchByExactTitle(query);
  if (titleResults.length >= 3 && titleResults[0].score > 0.9) {
    console.log('✅ レベル2: タイトル一致で十分な結果');
    await semanticCache.set(query, titleResults);
    return titleResults;
  }
  
  // レベル3: 軽量ベクトル検索（2-3秒）
  const lightResults = await lightweightVectorSearch(query, 15);
  if (lightResults.length >= 5 && lightResults[0].score > 0.7) {
    console.log('✅ レベル3: 軽量検索で十分な結果');
    await semanticCache.set(query, lightResults);
    return lightResults;
  }
  
  // レベル4: フルハイブリッド検索（7-12秒）
  console.log('🔍 レベル4: フルハイブリッド検索を実行');
  const fullResults = await fullHybridSearch(query);
  await semanticCache.set(query, fullResults);
  return fullResults;
}
```

---

## パフォーマンス目標

| フェーズ | 検索時間 | AI生成時間 | 総処理時間 | 実装期間 |
|---------|----------|------------|------------|----------|
| 現在 | 7-12s | 15-17s | 29-43s | - |
| フェーズ1 | 3-5s | 10-12s | 15-20s | 即座 |
| フェーズ2 | 2-3s | 7-10s | 10-15s | 1-2週間 |
| フェーズ3 | 1-2s | 5-7s | 5-8s | 1-3ヶ月 |

---

## まとめ

現在のRAGシステムは、**品質重視**の設計になっており、検索の網羅性とAI回答の完全性を重視しています。これはトレードオフとして、**パフォーマンスが犠牲**になっています。

**最も効果的な改善策**は、**質問タイプに応じた適応的処理**と**インテリジェントキャッシュ**の組み合わせです。これにより、品質を維持しつつ、パフォーマンスを大幅に向上できます。

コンテキストサイズや文書数を一律に削減すると、今回のように回答の質が大幅に低下するため、**避けるべき**です。

