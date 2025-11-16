# Phase 0A 最終ロードマップ

**作成日**: 2025-10-14  
**ステータス**: Phase 0A-1完了、Phase 0A-1.5実装準備完了

---

## 🎯 Phase 0A全体の目標

**検索品質を現状16%から90%以上に改善**

---

## 📊 フェーズ別の改善効果

### Phase 0A-1（完了） ✅

**実装内容**:
- StructuredLabel基盤構築
- Domain Knowledge統合（203ドメイン）
- 自動ラベル生成（Gemini 2.0 Flash）
- Firestore永続化

**成果**:
- 20/20ページでラベル生成成功
- 平均信頼度: 79.4%
- ルールベース: 30% / LLMベース: 70%

**検索品質への直接的効果**: 0%（基盤のみ）

---

### Phase 0A-1.5（次）🔥

**実装内容**:
1. 全チャンク統合
2. 空ページフィルター
3. ページ単位の重複排除

**期待効果**:

| 問題タイプ | 事例数 | 改善前 | 改善後 | 改善幅 |
|-----------|--------|--------|--------|--------|
| **Tier 1（技術的）** | 3問 | 27% | **92%** | **+65%** |
| **Tier 2（セマンティック）** | 2問 | 0% | **50%** | **+50%** |
| **Tier 3（概念的）** | 1問 | 0% | **30%** | **+30%** |
| **全体平均** | **6問** | **16%** | **62%** | **+46%** |

**実装コスト**: 2ファイル、約160行  
**実装期間**: 1-2日  
**ROI**: 極めて高い ✅

---

### Phase 0A-2（Knowledge Graph統合）⭐

**実装内容**:

#### Phase 0A-2.1: Knowledge Graph構築

```typescript
// 1. 参照関係抽出（コンテンツベース）
const references = extractReferences(pageContent);
// 例: "177_【FIX】求人削除機能を実施" → Edge(164→177)

// 2. ドメイン関係構築（StructuredLabelベース）
const domainEdges = buildDomainGraph(structuredLabels);
// 例: domain="会員管理" → 046, 041, 044が関連

// 3. タグ関係構築
const tagEdges = buildTagGraph(structuredLabels);
// 例: tags=["退会", "会員登録"] → 046と041が強関連
```

**データ構造**:
```typescript
// Firestoreコレクション: knowledge_graph_edges
{
  from: "164_教室削除機能",
  to: "177_求人削除機能",
  edgeType: "reference",
  weight: 0.9,
  extractedFrom: "content"
}
```

#### Phase 0A-2.2: KG検索統合

```typescript
async function retrieveRelevantDocsWithKG(query: string) {
  // Step 1: 通常の検索（Phase 0A-1.5）
  const primaryResults = await searchLanceDB({ query, topK: 5 });
  
  // Step 2: Knowledge Graphで関連ページを拡張
  const expandedResults = [];
  
  for (const result of primaryResults) {
    expandedResults.push(result);
    
    // 参照先を取得
    const references = await getKGReferences(result.pageId);
    
    // 重要度の高い参照を追加（最大2件）
    references
      .filter(ref => ref.weight > 0.7)
      .slice(0, 2)
      .forEach(ref => {
        expandedResults.push({
          ...ref,
          source: 'knowledge-graph',
          originalQuery: false
        });
      });
  }
  
  return deduplicateByPageId(expandedResults);
}
```

**期待効果**:

| 事例 | Phase 0A-1.5 | KG効果 | Phase 0A-2 |
|------|-------------|--------|-----------|
| 教室削除条件（164→177） | 95% | +3% | **98%** |
| 教室コピー項目（168→データ定義） | 85% | +12% | **97%** |
| 学年・職業更新（721→プロフィール） | 95% | +15% | **97%** |
| 退会後の再登録（046→041） | 60% | +20% | **80%** |
| 応募制限有無（014→応募情報） | 40% | +25% | **65%** |
| 重複応募期間（014） | 30% | +20% | **50%** |

**全体平均**: 62% → **81%**（+19%） ✅

**実装コスト**: 高（新規機能、5-7ファイル、500-700行）  
**実装期間**: 5-7日  
**ROI**: 高 ✅

---

### Phase 0A-2.5（FAQパターン統合）

**実装内容**:
1. クエリリライト（"何日間" → "再応募" "重複応募"）
2. 前提チェック（期間制限の有無を確認）
3. FAQパターンマッチング

**期待効果**: 81% → **90%**（+9%）

**実装コスト**: 非常に高（複雑なNLP、10-15ファイル）  
**実装期間**: 10-14日  
**ROI**: 中程度（コスト高、効果は限定的）

---

## 🔄 Knowledge Graph構築の詳細

### 自動抽出アルゴリズム

#### 1. 参照関係抽出

```typescript
function extractReferences(pageId: string, content: string, title: string): Edge[] {
  const edges: Edge[] = [];
  
  // パターン1: ページ番号の言及
  const pattern1 = /(\d{3})_【[^\]]+】([^を\s]+)を(実施|参照|使用)/g;
  let match;
  
  while ((match = pattern1.exec(content)) !== null) {
    const targetPageNumber = match[1];
    const targetFeature = match[2];
    const relationType = match[3];
    
    edges.push({
      from: pageId,
      to: findPageByNumber(targetPageNumber),
      edgeType: relationType === '実施' ? 'implements' : 'reference',
      weight: 0.9,
      extractedFrom: 'content'
    });
  }
  
  // パターン2: 【FIX】ページ名 の言及
  const pattern2 = /【[^\]]+】([^を\s。、]+)/g;
  
  while ((match = pattern2.exec(content)) !== null) {
    const targetTitle = match[1];
    
    edges.push({
      from: pageId,
      to: findPageByTitle(targetTitle),
      edgeType: 'reference',
      weight: 0.7,
      extractedFrom: 'content'
    });
  }
  
  return edges;
}
```

#### 2. ドメイン関係構築

```typescript
function buildDomainGraph(labels: Map<string, StructuredLabel>): Edge[] {
  const edges: Edge[] = [];
  const domainGroups = new Map<string, string[]>();
  
  // ドメインでグループ化
  labels.forEach((label, pageId) => {
    if (!domainGroups.has(label.domain)) {
      domainGroups.set(label.domain, []);
    }
    domainGroups.get(label.domain)!.push(pageId);
  });
  
  // 同一ドメイン内のページを相互リンク
  domainGroups.forEach((pageIds, domain) => {
    for (let i = 0; i < pageIds.length; i++) {
      for (let j = i + 1; j < pageIds.length; j++) {
        edges.push({
          from: pageIds[i],
          to: pageIds[j],
          edgeType: 'related',
          weight: 0.5,  // 同一ドメインの基本スコア
          extractedFrom: 'structured-label'
        });
      }
    }
  });
  
  return edges;
}
```

#### 3. タグ関係構築

```typescript
function buildTagGraph(labels: Map<string, StructuredLabel>): Edge[] {
  const edges: Edge[] = [];
  
  labels.forEach((label1, pageId1) => {
    labels.forEach((label2, pageId2) => {
      if (pageId1 >= pageId2) return;  // 重複回避
      
      // タグの重複度を計算
      const tags1 = new Set(label1.tags || []);
      const tags2 = new Set(label2.tags || []);
      
      const intersection = new Set(
        [...tags1].filter(tag => tags2.has(tag))
      );
      
      const jaccardSimilarity = intersection.size / 
        (tags1.size + tags2.size - intersection.size);
      
      // 類似度が高い場合のみエッジを作成
      if (jaccardSimilarity > 0.3) {
        edges.push({
          from: pageId1,
          to: pageId2,
          edgeType: 'related',
          weight: jaccardSimilarity,
          extractedFrom: 'structured-label'
        });
      }
    });
  });
  
  return edges;
}
```

---

## 🎯 Knowledge Graph活用の具体例

### 例1: 164_教室削除条件の完全回答

```
質問: "教室削除ができないのは何が原因ですか"

【Phase 0A-1.5】
検索結果: 164_教室削除機能（2チャンク統合、3,600文字）
AI回答: 「非掲載、応募情報なし、など...」（95%）

【Phase 0A-2】
検索結果: 
  1. 164_教室削除機能（メイン）
  2. 177_求人削除機能（KGから自動取得）← NEW!
  
AI回答:
「教室削除ができない原因:
  
  1. 教室レベルの条件（164より）
     • 求人が全て非掲載状態でない
     • 応募情報の条件を満たしていない
  
  2. 求人削除の詳細条件（177より）← KGで補完
     • 応募情報が存在する
     • かつ「採用ステータス」が「未登録」「保留」
     • または「採用」で採用決定日から1年以内
  
  詳細は164_【FIX】教室削除機能、177_【FIX】求人削除機能を参照」
```

**改善**: 95% → **98%** ✅

---

### 例2: 046_退会後の再登録の完全回答

```
質問: "退会した会員が再登録時に同じメールアドレス使ったらどうなりますか"

【Phase 0A-1.5】
検索結果: 046_会員退会機能（全チャンク統合）
AI回答: 「同じメールアドレスで新アカウント登録可能」（60%）

【Phase 0A-2】
検索結果:
  1. 046_会員退会機能（メイン）
  2. 041_会員新規登録機能（KGから自動取得、domain: 会員管理）← NEW!
  
AI回答:
「退会後の再登録について:
  
  ✅ 可能です（046より）
     退会時に登録されていたメールアドレスを用いて
     新たに会員登録を行うことが可能で、
     新アカウントとして登録されます。
  
  🔄 新規登録の仕組み（041より）← KGで補完
     • 退会時にアカウント情報は論理削除されます
     • 新規登録時はメールアドレスの重複チェックが行われますが、
       退会済みアカウントは除外されます
     • 完全に新しいアカウントIDが発行されます
  
  参照: 046_会員退会機能, 041_会員新規登録機能」
```

**改善**: 60% → **80%** ✅

---

### 例3: 721_学年・職業更新の完全回答

```
質問: "会員情報の学年や現在の職業は自動で更新されますか"

【Phase 0A-1.5】
検索結果: 721_学年自動更新バッチ（2チャンク統合）
AI回答: 「学年は自動更新、職業は一部自動更新」（80%）

【Phase 0A-2】
検索結果:
  1. 721_学年自動更新バッチ（メイン）
  2. プロフィール編集機能（KGから自動取得、domain: 会員管理）← NEW!
  
AI回答:
「学年と職業の更新について:
  
  1. 学年の自動更新（721より）
     ✅ 自動更新あり
     • 条件: 入学年月が当月、学年更新日が1ヶ月以上前...
     • 実行: 毎月2日0:00（バッチ処理）
  
  2. 現在の職業の自動更新（721より）
     ⚠️ 限定的な自動更新
     • 高校生（卒業見込み）→大学生への自動更新のみ
     • その他のケースは自動更新されません
  
  3. 現在の職業の手動更新（プロフィール編集より）← KGで補完
     ❌ 自動更新されないケース
     • 会員自身がプロフィール編集機能で更新する必要があります
     • 基本情報タブから「現在の職業」を編集できます
  
  参照: 721_学年自動更新バッチ, プロフィール編集機能」
```

**改善**: 80% → **97%** ✅

---

## 📈 Phase 0A全体の改善推移

### 改善率の推移

```
現状（Phase 0A-1完了時）: 16%
  ↓ +46%
Phase 0A-1.5（チャンク統合等）: 62%
  ↓ +19%
Phase 0A-2（Knowledge Graph）: 81%
  ↓ +9%
Phase 0A-2.5（FAQ・クエリリライト）: 90%
```

### 問題タイプ別の到達点

| 問題タイプ | Phase 0A-1.5 | Phase 0A-2 | Phase 0A-2.5 | 最終目標 |
|-----------|-------------|-----------|-------------|---------|
| **Tier 1（技術的）** | 92% | 97% | 98% | **95%** ✅ |
| **Tier 2（セマンティック）** | 50% | 80% | 88% | **80%** ✅ |
| **Tier 3（概念的）** | 30% | 50% | 65% | **60%** ⚠️ |

---

## 🚀 実装順序と期間

### 実装スケジュール

| フェーズ | 期間 | 累積改善 | 主な成果 |
|---------|------|----------|----------|
| **Phase 0A-1** | 完了 | 0% → 16% | StructuredLabel基盤 |
| **Phase 0A-1.5** | 1-2日 | 16% → 62% | チャンク統合、空ページ除外 |
| **Phase 0A-2.1** | 3-4日 | 62% → 70% | KG構築 |
| **Phase 0A-2.2** | 2-3日 | 70% → 81% | KG検索統合 |
| **Phase 0A-2.5** | 7-10日 | 81% → 90% | FAQ・クエリリライト |

**Phase 0A全体**: 約20-25日

---

## ✅ Knowledge Graphによる解決可能性：最終結論

### 結論

**Knowledge Graphは極めて有効です！** ✅

### 解決できること

1. ✅ **参照先の自動取得**（効果: 最大）
   - 164→177の関連を自動取得
   - 完全な情報をAIに提供

2. ✅ **ドメイン内の補完情報**（効果: 大）
   - 721→プロフィール編集の関連
   - "自動更新されない"というネガティブ情報も取得可能

3. ✅ **関連データの詳細化**（効果: 中-大）
   - 168→教室データ定義ページの自動取得
   - コピー可能項目の完全なリスト提供

4. ⚠️ **セマンティックギャップの緩和**（効果: 中）
   - 014を確実に取得できるように
   - ただし、表現のミスマッチは完全には解決できない

### 解決できないこと

❌ **Tier 3問題の完全解決**
- XY問題（質問の前提が間違っている）
- 表現の大きなギャップ（"何日間" vs "永久に不可"）
- → Phase 0A-2.5（FAQパターン）またはPhase 0B以降が必要

---

## 🎯 推奨アプローチ

### 優先順位

1. **Phase 0A-1.5**（今すぐ） - ROI: 極めて高い
2. **Phase 0A-2（KG）**（次） - ROI: 高い
3. **Phase 0A-2.5（FAQ）**（状況次第） - ROI: 中程度

### 判断基準

```
Phase 0A-1.5後に効果測定:
  ↓
62%達成 → Phase 0A-2へ進む ✅
50%未満 → 原因分析、Phase 0A-1.5の見直し

Phase 0A-2後に効果測定:
  ↓
80%達成 → 目標達成、Phase 0Aは完了 ✅
70%台 → Phase 0A-2.5の実装を検討
60%台以下 → Phase 0A-2の見直し
```

---

## 🎊 まとめ

**Phase 0A全体のロードマップが確定しました！**

- ✅ Phase 0A-1: 基盤構築（完了）
- 🔥 Phase 0A-1.5: 緊急改善（次、1-2日）
- ⭐ Phase 0A-2: Knowledge Graph（その次、5-7日）
- ⚪ Phase 0A-2.5: FAQ（将来、必要に応じて）

**Knowledge Graphによる解決可能性**: **極めて高い** ✅
- Tier 1: 92% → **97%**
- Tier 2: 50% → **80%**
- Tier 3: 30% → **50%**
- **全体: 62% → 81%（+19%）**

**次のアクション**: Phase 0A-1.5の実装を開始 🚀

