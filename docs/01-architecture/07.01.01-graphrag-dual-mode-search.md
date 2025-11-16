# GraphRAG デュアルモード検索提案

## 概要

「高速モード」と「詳細分析モード」の2つの検索モードを提供することで、パフォーマンスと品質の両立を実現する。

---

## 1. 検索モードの定義

### モード1: 高速検索（Fast Mode）

**対象ユーザー:**
- 通常の質問をしたいユーザー
- 素早く回答が欲しいユーザー

**技術仕様:**
```typescript
interface FastSearchConfig {
  vectorSearch: true;
  bm25Search: true;
  kgExpansion: false;  // KG拡張は無効
  maxResults: 50;
  timeout: 2000;  // 2秒タイムアウト
}
```

**パフォーマンス:**
- 検索時間: 0.8-1.5秒
- 発見率: 95-100%
- 適合率: 高い

**UI表示:**
```
⚡ 高速検索
約1秒で結果を表示
```

---

### モード2: 詳細分析モード（Deep Analysis Mode）

**対象ユーザー:**
- 複雑な関係性を知りたいユーザー
- 網羅的な情報が必要なユーザー
- 時間をかけてでも詳しく知りたいユーザー

**技術仕様:**
```typescript
interface DeepAnalysisConfig {
  vectorSearch: true;
  bm25Search: true;
  kgExpansion: true;  // KG拡張を有効化
  multiHopSearch: true;  // 将来的にGraphRAG機能を追加
  maxHops: 2-3;
  communityDetection: true;  // コミュニティ検出
  pathAnalysis: true;  // パス解析
  maxResults: 100;
  timeout: 30000;  // 30秒タイムアウト
}
```

**パフォーマンス:**
- 検索時間: 10-30秒
- 発見率: 98-100%
- 網羅性: 非常に高い
- 関係性の発見: 可能

**UI表示:**
```
🔬 詳細分析モード
10-30秒かけて詳細に分析
- 複数ステップの手順を自動構築
- 関連機能を網羅的に発見
- 依存関係を可視化
```

---

## 2. 実装アーキテクチャ

### ファイル構成

```
src/lib/
├── search-orchestrator.ts          # 検索モード振り分け
├── fast-search-service.ts          # 高速検索（現在の実装）
└── deep-analysis-service.ts        # 詳細分析（GraphRAG）
    ├── multi-hop-explorer.ts       # Multi-hop検索
    ├── community-detector.ts       # Community Detection
    └── path-analyzer.ts            # パス解析
```

### 検索オーケストレーター

```typescript
// src/lib/search-orchestrator.ts

export type SearchMode = 'fast' | 'deep';

export interface SearchRequest {
  query: string;
  mode: SearchMode;
  options?: {
    maxResults?: number;
    timeout?: number;
  };
}

export class SearchOrchestrator {
  async search(request: SearchRequest): Promise<SearchResult> {
    const startTime = Date.now();
    
    // モードに応じた検索サービスを選択
    const searchService = request.mode === 'fast'
      ? new FastSearchService()
      : new DeepAnalysisService();
    
    // タイムアウト設定
    const timeout = request.mode === 'fast' ? 2000 : 30000;
    
    // 検索実行
    const results = await Promise.race([
      searchService.search(request.query, request.options),
      this.createTimeout(timeout)
    ]);
    
    const searchTime = Date.now() - startTime;
    
    console.log(`[${request.mode.toUpperCase()}] 検索完了: ${searchTime}ms`);
    
    return results;
  }
  
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Search timeout')), ms);
    });
  }
}
```

### 高速検索サービス（現在の実装）

```typescript
// src/lib/fast-search-service.ts

export class FastSearchService {
  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    // 現在の実装をそのまま使用
    return await searchLanceDB({
      query,
      topK: options?.maxResults || 50,
      useLunrIndex: true,
      labelFilters: { includeMeetingNotes: false }
    });
  }
}
```

### 詳細分析サービス（GraphRAG）

```typescript
// src/lib/deep-analysis-service.ts

export class DeepAnalysisService {
  private multiHopExplorer = new MultiHopExplorer();
  private communityDetector = new CommunityDetector();
  private pathAnalyzer = new PathAnalyzer();
  
  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    console.log('[DEEP] 詳細分析モード開始');
    
    // Step 1: 基本検索（高速検索と同じ）
    console.log('[DEEP] Step 1: 基本検索');
    const basicResults = await searchLanceDB({
      query,
      topK: 100,
      useLunrIndex: true,
      labelFilters: { includeMeetingNotes: false }
    });
    
    // Step 2: KG拡張（1-hop参照）
    console.log('[DEEP] Step 2: KG拡張（1-hop）');
    const kgExpandedResults = await this.expandWithKG(basicResults);
    
    // Step 3: Multi-hop探索（2-3 hop）
    console.log('[DEEP] Step 3: Multi-hop探索');
    const multiHopResults = await this.multiHopExplorer.explore(
      kgExpandedResults,
      { maxHops: 2 }
    );
    
    // Step 4: Community Detection（関連機能のグルーピング）
    console.log('[DEEP] Step 4: Community Detection');
    const communities = await this.communityDetector.detect(multiHopResults);
    
    // Step 5: パス解析（手順の自動構築）
    console.log('[DEEP] Step 5: パス解析');
    const paths = await this.pathAnalyzer.analyzePaths(
      multiHopResults,
      query
    );
    
    // Step 6: 結果統合
    console.log('[DEEP] Step 6: 結果統合');
    return this.mergeResults({
      basicResults,
      kgExpandedResults,
      multiHopResults,
      communities,
      paths
    });
  }
  
  private async expandWithKG(results: SearchResult[]): Promise<SearchResult[]> {
    // 1-hop KG拡張（既存のロジック）
    // ただし、詳細分析モードでのみ実行
    return results; // 実装省略
  }
}
```

---

## 3. UI/UXデザイン

### 検索フォーム

```tsx
// src/components/search-mode-selector.tsx

export function SearchModeSelector() {
  const [mode, setMode] = useState<SearchMode>('fast');
  
  return (
    <div className="search-mode-selector">
      <div className="mode-options">
        <label className={mode === 'fast' ? 'selected' : ''}>
          <input
            type="radio"
            value="fast"
            checked={mode === 'fast'}
            onChange={() => setMode('fast')}
          />
          <div className="mode-card">
            <div className="mode-icon">⚡</div>
            <div className="mode-title">高速検索</div>
            <div className="mode-time">約1秒</div>
            <div className="mode-description">
              通常の質問に最適
            </div>
          </div>
        </label>
        
        <label className={mode === 'deep' ? 'selected' : ''}>
          <input
            type="radio"
            value="deep"
            checked={mode === 'deep'}
            onChange={() => setMode('deep')}
          />
          <div className="mode-card">
            <div className="mode-icon">🔬</div>
            <div className="mode-title">詳細分析</div>
            <div className="mode-time">10-30秒</div>
            <div className="mode-description">
              複雑な関係性を分析
              <ul>
                <li>手順の全ステップを自動構築</li>
                <li>関連機能を網羅的に発見</li>
                <li>依存関係を可視化</li>
              </ul>
            </div>
          </div>
        </label>
      </div>
      
      {mode === 'deep' && (
        <div className="deep-mode-notice">
          ⏱️ 詳細分析には時間がかかりますが、より詳しい情報を提供します
        </div>
      )}
    </div>
  );
}
```

### プログレス表示（詳細分析モード）

```tsx
// 詳細分析モード実行中の表示
<div className="deep-analysis-progress">
  <div className="step completed">
    ✅ Step 1: 基本検索完了 (1.2秒)
  </div>
  <div className="step completed">
    ✅ Step 2: KG拡張完了 (3.5秒)
  </div>
  <div className="step in-progress">
    🔄 Step 3: Multi-hop探索中... (7.8秒)
  </div>
  <div className="step pending">
    ⏳ Step 4: Community Detection待機中
  </div>
  <div className="step pending">
    ⏳ Step 5: パス解析待機中
  </div>
</div>
```

---

## 4. 段階的な実装計画

### Phase 1: デュアルモード基盤（1週間）

- [ ] SearchOrchestrator実装
- [ ] FastSearchService実装（既存コード活用）
- [ ] UI: モード選択コンポーネント
- [ ] モード切り替え機能

### Phase 2: 詳細分析モード基礎（2週間）

- [ ] DeepAnalysisService実装
- [ ] 1-hop KG拡張の再有効化
- [ ] プログレス表示UI
- [ ] タイムアウト処理

### Phase 3: GraphRAG機能追加（3-4週間）

- [ ] Multi-hop探索実装
- [ ] Community Detection実装
- [ ] パス解析実装
- [ ] 結果統合ロジック

### Phase 4: 最適化・改善（2週間）

- [ ] キャッシュ戦略実装
- [ ] パフォーマンスチューニング
- [ ] エラーハンドリング強化
- [ ] A/Bテスト実施

---

## 5. 期待される効果

### ユーザー体験

| 項目 | 高速モード | 詳細分析モード |
|------|----------|---------------|
| **検索時間** | 1秒 | 10-30秒 |
| **適用場面** | 日常的な質問 | 複雑な調査 |
| **満足度** | 高い（速い） | 高い（詳しい） |
| **使用頻度** | 90%+ | 10%程度 |

### ビジネス価値

1. **差別化**
   - 「Thinking Mode」のような高付加価値機能
   - 競合との差別化ポイント

2. **柔軟性**
   - ユーザーが状況に応じて選択可能
   - パフォーマンスと品質のトレードオフを解決

3. **段階的な進化**
   - 高速モードで基本品質を確保
   - 詳細分析モードで先進機能を提供

---

## 6. リスクと対策

### リスク1: 詳細分析モードの利用率が低い

**対策:**
- 適切な場面でモード推奨
- 「この質問は詳細分析モードがおすすめです」
- 実績データの収集と分析

### リスク2: 詳細分析モードでもパフォーマンス不足

**対策:**
- GraphDBの導入検討
- 事前計算・キャッシュの活用
- バックグラウンド処理の導入

### リスク3: 実装コストが高い

**対策:**
- Phase 1から段階的に実装
- 各Phaseで効果測定
- ROIを確認しながら進める

---

## 7. 成功指標（KPI）

### Phase 1（デュアルモード基盤）

- [ ] 高速モード: 検索時間 < 2秒
- [ ] モード切り替え機能の動作確認
- [ ] ユーザーテスト実施

### Phase 2（詳細分析モード基礎）

- [ ] 詳細分析モード: 検索時間 < 15秒
- [ ] KG拡張による発見率向上: +5%
- [ ] ユーザー満足度調査

### Phase 3（GraphRAG機能）

- [ ] Multi-hop探索の精度: 90%+
- [ ] 複雑な質問への回答率: 80%+
- [ ] 詳細分析モード利用率: 5-15%

---

## 8. まとめ

### ✅ この提案の強み

1. **パフォーマンスと品質の両立**
   - 日常的な質問: 高速モード（1秒）
   - 複雑な質問: 詳細分析モード（10-30秒）

2. **段階的な実装**
   - Phase 1で基盤を構築
   - Phase 2-3で機能拡張
   - リスクを最小化

3. **ユーザー選択権**
   - 状況に応じてモードを選択
   - 強制的な遅延を回避

4. **将来性**
   - GraphRAG技術の実験場
   - AI機能の差別化ポイント

### 🎯 推奨アクション

**即座に実施:**
- Phase 1の実装開始（1週間）
- モード選択UIのプロトタイプ作成

**段階的に実施:**
- Phase 2: 1-hop KG拡張の再有効化
- Phase 3: GraphRAG機能の追加

**継続的に実施:**
- ユーザーフィードバック収集
- パフォーマンス監視
- 機能改善

---

## 参考資料

- [ナレッジグラフを活用するGraphRAGを俯瞰する](https://zenn.dev/zenkigen_tech/articles/0a25b2eaefb304)
- OpenAI o1 "Thinking Mode" の成功事例
- Google Search "Deep Research" モードの事例

