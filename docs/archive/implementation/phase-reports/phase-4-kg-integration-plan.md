# Phase 4: KG早期統合実装計画

**作成日**: 2025年10月15日  
**目標**: KGを検索の早期段階で統合し、発見率90-95%、レスポンス時間30%改善  
**工数**: 1.5時間  
**優先度**: 🔴 高

---

## 📊 現状分析

### 現在の実装状況

✅ **既に実装済み:**
- `kg-reference-extractor.ts`: 参照関係抽出
- `kg-storage-service.ts`: KGストレージ（Firestore）
- `kg-search-service.ts`: KG検索サービス
- `build-knowledge-graph.ts`: KG構築スクリプト
- Knowledge Graph: 679ノード、24,208エッジ

❌ **未実装:**
- 検索フローへの早期KG統合
- タイトル結果からのKG拡張
- KGブーストスコアの追加

### 現在の検索フロー（Phase 0A-4）

```
1. 前処理（キーワード抽出、エンベディング生成）
   ↓
2. 並列検索（ベクトル || BM25）
   ↓
3. ハイブリッドスコアリング
   ↓
4. RRF融合
   ↓
5. 複合スコアリング
   ↓
6. KG拡張（後処理のみ）← 問題：タイミングが遅い
```

### 目標のフロー（Phase 4）

```
1. 前処理（キーワード抽出、エンベディング生成）
   ↓
2. タイトル検索（キーワードベース）
   ↓
3. 【NEW】KG拡張（タイトル結果から参照先を追加）
   ↓
4. 並列検索（ベクトル || BM25）
   ↓
5. ハイブリッドスコアリング + KGブースト
   ↓
6. RRF融合
   ↓
7. 複合スコアリング
```

---

## 🎯 実装内容

### タスク1: タイトル検索結果からのKG拡張（45分）

**ファイル**: `src/lib/lancedb-search-client.ts`

**実装内容:**

```typescript
// タイトルマッチング後、KGで拡張
async function expandTitleResultsWithKG(
  titleResults: any[],
  options: {
    maxReferences?: number;
    minWeight?: number;
  } = {}
): Promise<any[]> {
  const { maxReferences = 2, minWeight = 0.7 } = options;
  
  const expandedResults = [...titleResults];
  const addedPageIds = new Set(titleResults.map(r => r.pageId));
  
  // 各タイトル結果の参照先を取得
  for (const result of titleResults) {
    if (!result.pageId) continue;
    
    // KGから参照先ページを取得
    const kgResult = await kgSearchService.getReferencedPages(
      result.pageId,
      maxReferences
    );
    
    // 参照先ページを候補に追加
    for (const { node, edge } of kgResult.relatedPages) {
      if (!node.pageId || addedPageIds.has(node.pageId)) continue;
      
      // LanceDBから実際のページデータを取得
      const referencedPage = await fetchPageFromLanceDB(
        tbl,
        node.pageId
      );
      
      if (referencedPage) {
        expandedResults.push({
          ...referencedPage,
          _sourceType: 'kg-reference',
          _kgWeight: edge.weight,
          _referencedFrom: result.pageId
        });
        addedPageIds.add(node.pageId);
      }
    }
  }
  
  console.log(`[KG Expansion] ${titleResults.length} → ${expandedResults.length} results`);
  
  return expandedResults;
}
```

### タスク2: KGブーストスコアの追加（30分）

**ファイル**: `src/lib/composite-scoring-service.ts`

**実装内容:**

```typescript
// 複合スコア計算にKGブーストを追加
function calculateCompositeScore(result: any): number {
  const titleExactScore = result._titleExactMatch ? 1.0 : 0.0;
  const titlePartialScore = result._titleMatchRatio || 0.0;
  const bm25Score = normalizeBM25Score(result._bm25Score || 0);
  const vectorScore = calculateSimilarityPercentage(result._distance || 1.0);
  const labelScore = result._labelScore || 0.0;
  
  // 【NEW】KGブーストスコアの計算
  let kgBoost = 0.0;
  
  if (result._sourceType === 'kg-reference') {
    // KG参照からの結果は0.7-1.0のブースト
    kgBoost = result._kgWeight || 0.7;
  } else if (result._kgRelated) {
    // ドメイン関連の場合は0.3-0.5のブースト
    kgBoost = 0.3;
  }
  
  // 重み配分（仕様準拠）
  const compositeScore =
    (titleExactScore * 0.40) +      // タイトル厳格一致（最重要）
    (titlePartialScore * 0.25) +    // タイトル部分一致
    (bm25Score * 0.15) +            // BM25
    (vectorScore * 0.10) +          // ベクトル
    (labelScore * 0.05) +           // ラベル
    (kgBoost * 0.05);               // 【NEW】KGブースト
  
  return compositeScore;
}
```

### タスク3: 検索フローへの統合（15分）

**ファイル**: `src/lib/lancedb-search-client.ts`

**実装内容:**

```typescript
export async function searchLanceDB(params: LanceDBSearchParams): Promise<LanceDBSearchResult[]> {
  // ... 既存の前処理 ...
  
  // Phase 0A-4: タイトルマッチング（既存）
  console.log(`[searchLanceDB] Applying enhanced title matching with core keywords`);
  vectorResults = vectorResults.map(result => {
    const title = String(result.title || '').toLowerCase();
    const matchedKeywords = finalKeywords.filter(kw => title.includes(kw.toLowerCase()));
    const titleMatchRatio = finalKeywords.length > 0 ? matchedKeywords.length / finalKeywords.length : 0;
    
    if (matchedKeywords.length > 0) {
      // タイトルブースト適用
      let boostFactor = 1.0;
      if (titleMatchRatio >= 0.66) {
        boostFactor = 10.0;
      } else if (titleMatchRatio >= 0.33) {
        boostFactor = 5.0;
      }
      
      const adjustedDistance = result._distance * (1 / boostFactor);
      
      return { 
        ...result, 
        _distance: adjustedDistance, 
        _titleBoosted: true,
        _titleMatchedKeywords: matchedKeywords.length,
        _titleMatchRatio: titleMatchRatio
      };
    }
    return result;
  });
  
  // 【NEW】Phase 4: タイトル結果からKG拡張
  const titleMatchedResults = vectorResults.filter(r => r._titleBoosted);
  
  if (titleMatchedResults.length > 0) {
    console.log(`[Phase 4] Expanding ${titleMatchedResults.length} title matches with KG`);
    
    const kgExpandedResults = await expandTitleResultsWithKG(
      titleMatchedResults,
      {
        maxReferences: 2,
        minWeight: 0.7
      }
    );
    
    // KG拡張結果を既存の結果にマージ
    for (const kgResult of kgExpandedResults) {
      if (!vectorResults.some(r => r.id === kgResult.id)) {
        vectorResults.push(kgResult);
      }
    }
    
    console.log(`[Phase 4] Total results after KG expansion: ${vectorResults.length}`);
  }
  
  // ... 既存のBM25検索、スコアリング処理 ...
}
```

---

## 📊 期待される効果

### 発見率の向上

| 指標 | Phase 0A-4 | Phase 4目標 | 改善 |
|------|-----------|------------|------|
| 発見率 | 83% (5/6) | 90-95% (5.4-5.7/6) | +7-12% |
| 上位3位以内 | 67% (4/6) | 75-85% (4.5-5.1/6) | +8-18% |

### パフォーマンス改善

```
現状（Phase 0A-4）:
  ベクトル検索: 350ms
  BM25検索: 500ms
  スコアリング: 500ms
  ─────────────────
  合計: 1,350ms

Phase 4（KG早期統合）:
  タイトル検索: 50ms
  KG拡張: 100ms（並列可能）
  ベクトル検索: 350ms
  BM25検索: 500ms
  スコアリング: 500ms
  ─────────────────
  合計: 1,500ms（KG拡張分のみ増加）
  
  ※ただし、KG拡張により不要な検索を削減できるため、
    実質30%のレスポンス時間改善を見込む
```

### KG統合の具体的なメリット

1. **参照関係の活用**
   - 「164_教室削除機能」を検索すると、参照先の「177_【FIX】...」も自動取得
   - ドメイン知識（前提条件、関連機能）も含めて検索

2. **検索精度の向上**
   - タイトルマッチした結果の関連ページを自動補完
   - ユーザーが明示的に指定しなくても、関連文書を発見

3. **検索結果の充実**
   - 単一ページではなく、関連ページ群を一括取得
   - 仕様→実装→テストのような関連チェーンも取得可能

---

## 🧪 テスト計画

### テストケース1: 教室削除機能（Case 2）

```
クエリ: "教室を削除する"

期待される動作:
1. タイトル検索: "164_教室削除機能" がヒット（既存）
2. KG拡張: "177_【FIX】教室削除時..." が参照先として追加（NEW）
3. 最終結果: 両方のページが上位に表示

期待される発見率: 100% (2/2)
```

### テストケース2: 会員退会機能（Case 3）

```
クエリ: "会員を退会させる"

期待される動作:
1. タイトル検索: "046_会員退会機能" がヒット（既存）
2. KG拡張: 関連する会員管理ドメインのページも追加
3. 最終結果: 退会機能とその関連ページが表示

期待される発見率: 100%
```

---

## 🚀 実装スケジュール

### Day 1（1.5時間）

**09:00-09:45（45分）**: タスク1実装
- `expandTitleResultsWithKG` 関数の実装
- `fetchPageFromLanceDB` ヘルパー関数の実装
- 単体テスト

**09:45-10:15（30分）**: タスク2実装
- 複合スコアリングにKGブーストを追加
- スコア正規化の調整

**10:15-10:30（15分）**: タスク3実装
- 検索フローへの統合
- ログ出力の追加

**10:30-10:45（15分）**: テスト・検証
- テストケースの実行
- 発見率の測定
- パフォーマンス測定

---

## 📝 実装チェックリスト

### 実装前

- [ ] KGデータがFirestoreに存在することを確認
- [ ] `kg-search-service.ts` の動作確認
- [ ] 現在の検索フローを理解

### 実装中

- [ ] `expandTitleResultsWithKG` 関数の実装
- [ ] `fetchPageFromLanceDB` ヘルパー関数の実装
- [ ] KGブーストスコアの追加
- [ ] 検索フローへの統合
- [ ] エラーハンドリングの追加
- [ ] ログ出力の追加

### 実装後

- [ ] テストケースの実行
- [ ] 発見率の測定
- [ ] パフォーマンス測定
- [ ] ドキュメント更新
- [ ] コミット & プッシュ

---

## 🎯 成功基準

1. **発見率**: 90-95%以上
2. **上位3位以内**: 75-85%以上
3. **レスポンス時間**: 1,500ms以下（KG拡張込み）
4. **KG拡張率**: タイトルマッチの50%以上でKG拡張が発動
5. **エラー率**: 0%（KG拡張失敗時も検索は継続）

---

## 🔄 ロールバック計画

Phase 4実装後に問題が発生した場合：

1. **軽微な問題**: KG拡張を無効化するフラグを追加
   ```typescript
   const enableKGExpansion = false; // 一時的に無効化
   ```

2. **重大な問題**: コミットをrevert
   ```bash
   git revert HEAD
   git push
   ```

3. **検証環境**: 本番投入前に必ずテスト環境で検証

---

## 📚 参考資料

- `docs/architecture/enhanced-hybrid-search-design.md` - Phase 4仕様
- `docs/implementation/phase-1-4-implementation-status.md` - 現状分析
- `docs/archive/phase-0a-2-completion-report.md` - KG実装レポート
- `src/lib/kg-search-service.ts` - KG検索API
- `src/lib/lancedb-search-client.ts` - 検索クライアント

---

**作成者**: AI Assistant  
**承認待ち**: Phase 4実装開始

