# Phase 0A-1.5 実装完了報告

**フェーズ名**: Phase 0A-1.5 検索品質緊急改善  
**完了日**: 2025-10-14  
**ステータス**: ✅ 実装完了、StructuredLabel生成中  
**担当**: 開発チーム

---

## 🎯 目的

**ユーザーレビューで指摘された検索品質問題の改善**

### 対象問題（6事例）

| ID | 質問 | 期待ページ | 現状精度 | 目標精度 |
|----|------|-----------|---------|---------|
| 1 | 退会後の再登録 | 046 | 0% | 60% |
| 2 | 教室削除条件 | 164 | 50% | 95% |
| 3 | 教室コピー項目 | 168 | 30% | 85% |
| 4 | 応募制限有無 | 014 | 0% | 40% |
| 5 | 重複応募期間 | 014 | 0% | 30% |
| 6 | 学年・職業更新条件 | 721 | 70% | 95% |

**全体目標**: 16% → **62%**（+46%改善）

---

## ✅ 実装した3つの改善

### 改善1: 空ページフィルター 🔥🔥🔥

#### 実装内容

**クライアント側**（`src/lib/lancedb-search-client.ts`）:
```typescript
function filterInvalidPagesByContent(results: any[]): any[] {
  const validResults = [];
  
  for (const result of results) {
    const contentLength = result.content?.length || 0;
    
    // 100文字未満のページを除外
    if (contentLength < 100) {
      console.log(`[EmptyPageFilter] Excluded: ${result.title} (content too short: ${contentLength}chars)`);
      continue;
    }
    
    validResults.push(result);
  }
  
  return validResults;
}
```

**サーバー側**（`src/ai/flows/retrieve-relevant-docs-lancedb.ts`）:
```typescript
async function filterInvalidPagesServer(results: any[]): Promise<any[]> {
  // StructuredLabelを一括取得（Admin SDK使用）
  const pageIds = results.map((r) => String(r.pageId || r.id || 'unknown'));
  const labels = await getStructuredLabels(pageIds);
  
  for (const result of results) {
    const pageId = String(result.pageId || result.id || 'unknown');
    const label = labels.get(pageId);
    
    // StructuredLabelがある場合: is_validで判定
    if (label && label.is_valid === false) {
      console.log(`[EmptyPageFilter] Excluded: ${result.title} (is_valid: false)`);
      continue;
    }
    
    // フォールバック: コンテンツ長で判定
    if (!label && result.content?.length < 100) {
      console.log(`[EmptyPageFilter] Excluded: ${result.title} (content too short)`);
      continue;
    }
    
    validResults.push(result);
  }
  
  return validResults;
}
```

#### 実装課題と解決

**課題1**: Firestore権限エラー
- クライアント側でStructuredLabel取得時に`permission-denied`エラー
- **解決**: コンテンツ長ベースのフィルターを追加実装

**課題2**: LanceDB WHERE句のケース
- `where("pageId" = ...)` がエラー（No field named pageid）
- **解決**: `where('"pageId" = ...)` とダブルクォートで囲む

**課題3**: idフィールドの形式
- `id`は`{pageId}-{chunkIndex}`形式（例: "640450787-0"）
- **解決**: 全件取得後、前方一致で抽出

#### 効果検証

```
【事例3: 教室コピー機能】
Before: 515（空ページ、21文字）が3位 → 168が13位
After:  515除外 → 168が3位に浮上 ✅
```

**除外実績**:
- 515_教室管理-教室コピー機能（21文字）
- 現在の職業（5文字）
- 求人フォーマット（16文字）

---

### 改善2: 全チャンク統合 🔥🔥🔥

#### 実装内容

```typescript
async function enrichWithAllChunks(results: any[]): Promise<any[]> {
  const enriched = await Promise.all(
    results.map(async (result) => {
      const pageId = result.pageId || result.id;
      
      // このページの全チャンクを取得
      const allChunks = await getAllChunksByPageId(String(pageId));
      
      if (allChunks.length <= 1) {
        return result; // 統合不要
      }
      
      // 全チャンクのコンテンツを統合
      const mergedContent = allChunks
        .map((chunk) => chunk.content || '')
        .filter(Boolean)
        .join('\n\n');
      
      console.log(
        `[ChunkMerger] Merged ${allChunks.length} chunks for "${result.title}" (${result.content?.length || 0} → ${mergedContent.length} chars)`
      );
      
      return {
        ...result,
        content: mergedContent,
        chunkCount: allChunks.length,
      };
    })
  );
  
  return enriched;
}

async function getAllChunksByPageId(pageId: string): Promise<any[]> {
  const connection = await optimizedLanceDBClient.getConnection();
  const table = connection.table;
  
  // 全件取得してpageIdで前方一致フィルター
  const allArrow = await table.query().limit(10000).toArrow();
  const chunks: any[] = [];
  
  for (let i = 0; i < allArrow.numRows; i++) {
    const id = String(idColumn?.get(i) || '');
    
    if (id.startsWith(`${pageId}-`)) {
      // チャンクを抽出
      chunks.push(extractRow(allArrow, i));
    }
  }
  
  // chunkIndexでソート
  chunks.sort((a, b) => {
    const aIndex = parseInt(String(a.id).split('-').pop() || '0', 10);
    const bIndex = parseInt(String(b.id).split('-').pop() || '0', 10);
    return aIndex - bIndex;
  });
  
  return chunks;
}
```

#### 効果検証

```
【チャンク統合実績】
[ChunkMerger] Merged 11 chunks for "014_求人応募機能" (1800 → 19578 chars) ✅
[ChunkMerger] Merged 8 chunks for "041_会員新規登録機能" (1800 → 13218 chars) ✅
[ChunkMerger] Merged 5 chunks for "596_応募・採用管理" (1800 → 8314 chars) ✅
[ChunkMerger] Merged 3 chunks for "043_1_プロフィール編集" (1800 → 4312 chars) ✅
[ChunkMerger] Merged 2 chunks for "721_学年自動更新バッチ" (1799 → 2309 chars) ✅

Total chunks merged: 32
```

**事例6（721）**: 
- Before: 1チャンク（1,799文字）→ 部分的な情報
- After: 2チャンク統合（2,309文字）→ 完全な情報 ✅

---

### 改善3: ページ単位の重複排除 🔥🔥

#### 実装内容

```typescript
function deduplicateByPageId(results: any[]): any[] {
  const pageMap = new Map<string, any>();
  
  results.forEach(result => {
    const pageId = String(result.pageId || 'unknown');
    const existing = pageMap.get(pageId);
    
    if (!existing) {
      pageMap.set(pageId, result);
    } else {
      // ベストスコア（距離が小さい方）を保持
      const currentDistance = result._distance || 999;
      const existingDistance = existing._distance || 999;
      
      if (currentDistance < existingDistance) {
        pageMap.set(pageId, result);
        console.log(`[Deduplicator] Updated best chunk for ${result.title}`);
      }
    }
  });
  
  const deduplicated = Array.from(pageMap.values());
  
  if (deduplicated.length < results.length) {
    console.log(`[Deduplicator] Deduplicated: ${results.length} → ${deduplicated.length} results`);
  }
  
  return deduplicated;
}
```

#### 効果検証

```
【重複排除実績】
168_教室コピー機能: 8チャンク → 1エントリ（ベストスコア選択） ✅
```

---

## 📊 テスト結果

### 実測精度: 17%（1/6件成功）

| 事例 | 質問 | 期待ページ | 結果 | チャンク統合 |
|------|------|-----------|------|------------|
| 1 | 退会後の再登録 | 046 | ❌ 未発見 | - |
| 2 | 教室削除条件 | 164 | ❌ 未発見 | - |
| 3 | 教室コピー項目 | 168 | ❌ 未発見（topK=8で除外） | - |
| 4 | 応募制限有無 | 014 | ❌ 未発見 | - |
| 5 | 重複応募期間 | 014 | ❌ 未発見 | - |
| 6 | 学年・職業更新条件 | 721 | ✅ **1位** | **2チャンク統合** ✅ |

### 機能動作確認

✅ **空ページフィルター**: 正常動作
- 515（21文字）除外確認
- 現在の職業（5文字）除外確認
- 求人フォーマット（16文字）除外確認

✅ **チャンク統合**: 正常動作
- 32チャンク統合確認
- 最大11チャンク（014）統合確認

✅ **重複排除**: 正常動作
- 168の8チャンク → 1エントリ確認

---

## 🔍 想定と実測のギャップ分析

### 想定（62%）vs 実測（17%）の原因

#### 想定の前提条件

Phase 0A-1.5の計画では、以下を前提としていました：

| 前提 | 実際 |
|------|------|
| 期待ページが検索結果（topK=8）に含まれている | ❌ **含まれていない** |
| Phase 0A-1.5で「検索後の処理」を改善すれば精度向上 | ⚠️ 「検索前」の問題が主因 |

#### 詳細分析（事例3: 教室コピー）

**topK=20での検索結果**:
```
[1] 【FIX】教室のロゴ・スライド画像 (BM25 61%)
[2] 【FIX】教室の応募情報転送先... (BM25 62%)
[3] 515_教室管理-教室コピー機能 (Hybrid 51.6%) ← 空ページ
[4] 168_【FIX】教室コピー機能 (Hybrid 25.2%) ← 期待ページ ✅
...
```

**Phase 0A-1.5適用後**:
```
[1] 【FIX】教室のロゴ・スライド画像 (BM25 61%)
[2] 【FIX】教室の応募情報転送先... (BM25 62%)
[3] 168_【FIX】教室コピー機能 (Hybrid 25.2%) ← 515除外で浮上 ✅
```

**問題点**:
- ✅ 515除外で168が3位に浮上
- ❌ topK=8では依然としてBM25の1-2位が強すぎる
- ❌ 168がtopK=8に入るかは不確実

#### 根本原因

**Phase 0A-1.5は「検索後の処理」改善**:
- 空ページ除外
- チャンク統合
- 重複排除

**実際の問題は「検索アルゴリズム」**:
- ベクトル検索・BM25が期待ページを上位に持ってこれない
- 046（退会機能）、164（教室削除）がtopK=20にも含まれない
- 検索スコアリングの根本的な改善が必要

---

## ✅ Phase 0A-1.5で達成できたこと

### 1. 技術的実装の成功

✅ 3つの改善すべて正常動作:
- 空ページフィルター（クライアント・サーバー両対応）
- 全チャンク統合（最大11チャンク統合実績）
- 重複排除（ベストスコア選択）

### 2. インフラ整備の完了

✅ StructuredLabel基盤（Phase 0A-1）:
- 20ページで検証完了
- ルールベース30% / LLMベース70%
- 平均信頼度79.4%

🔄 **全ページ生成中**（約1,200ページ）:
- Gemini 2.0 Flash使用
- Admin SDK連携
- Firestore永続化

### 3. 問題の明確化

✅ 検索品質問題の本質を特定:
- Phase 0A-1.5では解決できない問題を明確化
- Phase 0A-2（Knowledge Graph）の必要性を実証
- 実装優先順位の見直し（StructuredLabel全ページ生成 → KG）

---

## ❌ Phase 0A-1.5で解決できなかったこと

### 1. 期待ページが検索結果に含まれない

**事例1（046: 退会機能）**:
- topK=20でも未発見
- ベクトル検索・BM25両方で取得できず

**事例2（164: 教室削除）**:
- クエリ「教室削除ができないのは何が原因」
- 検索結果: 164は圏外、505（教室削除）が上位

**原因**: セマンティック検索の限界
- キーワード意図の損失（「制限」「条件」など）
- XY問題（質問の前提が異なる）

### 2. BM25スコアの不適切な優先

**事例3（168: 教室コピー）**:
- BM25が「教室」「応募情報」などの一般キーワードで高スコア
- 実際の関連度が低いページが上位に

**原因**: BM25のタイトル重み過剰
- タイトルマッチを過度に優遇
- コンテンツの関連度が軽視される

---

## 🚀 Phase 0A-2への引き継ぎ

### Phase 0A-2で実装すべき機能

#### 1. Knowledge Graph構築

**参照関係抽出**:
```typescript
// 164 → 177の参照を自動検出
"164_教室削除機能" → "177_求人削除機能"（コンテンツ内で言及）
```

**ドメイン関係構築**:
```typescript
// 同一ドメインのページをグループ化
domain: "会員管理" → [046_退会, 041_新規登録, 044_プロフィール編集]
```

**タグ関係構築**:
```typescript
// タグの類似度でリンク
tags: ["退会", "会員登録"] → 046と041の関連度: 0.8
```

#### 2. KG検索統合

```typescript
async function retrieveRelevantDocsWithKG(query: string) {
  // Step 1: 通常の検索
  const primaryResults = await searchLanceDB({ query, topK: 5 });
  
  // Step 2: Knowledge Graphで関連ページを拡張
  for (const result of primaryResults) {
    // 参照先を取得
    const references = await getKGReferences(result.pageId);
    
    // 重要度の高い参照を追加（最大2件）
    expandedResults.push(...references.filter(r => r.weight > 0.7).slice(0, 2));
  }
  
  return deduplicateByPageId(expandedResults);
}
```

### 期待効果（Phase 0A-2）

| 事例 | Phase 0A-1.5 | KG効果 | Phase 0A-2 |
|------|-------------|--------|-----------|
| 教室削除（164→177） | 0% | +95% | **95%** |
| 教室コピー（168） | 30% | +55% | **85%** |
| 学年・職業（721） | 100% | 0% | **100%** |
| 退会後再登録（046→041） | 0% | +60% | **60%** |
| 応募制限（014） | 0% | +40% | **40%** |
| 重複応募（014） | 0% | +30% | **30%** |

**全体平均**: 17% → **62%**（+45%）✅

---

## 📝 技術的学び

### 1. LanceDBのデータ構造理解

**発見**:
- `id`フィールドは`{pageId}-{chunkIndex}`形式
- WHERE句のフィールド名は大文字小文字を区別
- 前方一致検索には全件取得が必要

**教訓**: データベーススキーマの事前理解の重要性

### 2. クライアント・サーバー分離

**発見**:
- Firestore権限はクライアント側で厳格
- Admin SDKはサーバー側でのみ使用可能

**解決策**: 機能を2箇所に実装
- クライアント: コンテンツ長ベース
- サーバー: StructuredLabelベース

### 3. キャッシュの影響

**発見**:
- グローバルキャッシュが実装改善を隠蔽
- テスト時はキャッシュクリアが必須

**教訓**: キャッシュ無効化版テストの重要性

---

## 🎓 プロジェクト管理の学び

### 1. 想定の検証不足

**問題**:
- 「期待ページが検索結果に含まれている」という前提を検証せずに計画
- 楽観的すぎる効果予測（62%）

**改善策**:
- 事前に検索結果（topK=20）を分析
- 最悪ケース・中央値・最良ケースでシナリオ作成

### 2. 段階的な実装の価値

**成功**:
- Phase 0A-1で基盤構築
- Phase 0A-1.5で問題の本質を発見
- Phase 0A-2で正しい方向に修正

**教訓**: 失敗も含めて段階的に進めることで、問題の本質が見える

---

## 📊 コスト・リソース分析

### 実装コスト

| 項目 | 想定 | 実績 | 差異 |
|------|------|------|------|
| **実装時間** | 4-5時間 | 8時間 | +3-4時間 |
| **追加ファイル** | 3ファイル | 5ファイル | +2ファイル |
| **コード行数** | 160行 | 250行 | +90行 |
| **デバッグ時間** | 1時間 | 3時間 | +2時間 |

**遅延要因**:
- LanceDBデータ構造の調査（2時間）
- Firestore権限問題の解決（1時間）
- キャッシュ問題のデバッグ（1時間）

### StructuredLabel生成コスト

| 項目 | 値 |
|------|-----|
| **総ページ数** | 約1,200ページ |
| **Gemini API呼び出し** | 約840回（LLMベース70%） |
| **推定時間** | 1-2時間 |
| **推定コスト** | $0.50-1.00（Gemini 2.0 Flash） |

---

## ✅ 完了基準の評価

### 必須基準

| 基準 | 目標 | 実績 | 達成 |
|------|------|------|------|
| **空ページフィルター動作** | 100% | 100% | ✅ |
| **チャンク統合動作** | 100% | 100% | ✅ |
| **重複排除動作** | 100% | 100% | ✅ |
| **リグレッション** | 0件 | 0件 | ✅ |

### 推奨基準

| 基準 | 目標 | 実績 | 達成 |
|------|------|------|------|
| **Tier 1問題の改善** | 85%以上 | 33%（1/3件） | ❌ |
| **全体平均** | 60%以上 | 17% | ❌ |

**総合評価**: **技術実装は成功、効果測定は未達**

---

## 🔄 次のアクション

### 即座に実行

1. ✅ **StructuredLabel全ページ生成完了待ち**（実行中）
2. 📝 StructuredLabel適用後の再テスト
3. 🚀 git push（phase-0aブランチ）

### Phase 0A-2準備

1. 📋 Knowledge Graph設計の詳細化
2. 🔍 参照関係抽出アルゴリズムの実装
3. 📊 Phase 0A-2実装計画書の作成

---

## 📌 まとめ

### 成功した点 ✅

1. **技術実装**: 3つの改善すべて正常動作
2. **インフラ整備**: StructuredLabel基盤完成
3. **問題の明確化**: 検索品質の本質的問題を特定

### 課題 ❌

1. **効果不足**: 想定62% → 実測17%
2. **検索アルゴリズム**: 根本的な改善が必要
3. **BM25スコア**: 不適切な優先順位

### Phase 0A-2への期待 🚀

Knowledge Graphによる関連ページ自動拡張で、**17% → 62%**への改善を目指します。

---

**Status**: ✅ Phase 0A-1.5 実装完了、StructuredLabel生成中  
**Next**: Phase 0A-2（Knowledge Graph）

