# Knowledge Graph仕様（Phase 0A-2）

**作成日**: 2025-10-15  
**ステータス**: 実装完了  
**ブランチ**: `phase-0a-2`

---

## 📊 概要

### 目的

Confluenceページ間の関係性を明示的にモデル化し、検索結果の拡張に活用する。

### 期待効果

- **検索精度向上**: 直接マッチしないが関連するページを発見
- **回答品質向上**: より多くのコンテキストをLLMに提供
- **Phase 0A-1.5**: 83% → **Phase 0A-2**: 85-90%（目標）

---

## 🏗️ Knowledge Graph構造

### ノード（679件）

#### ページノード（639件）
```typescript
{
  id: "page-718373062",
  type: "page",
  name: "164_【FIX】教室削除機能",
  pageId: "718373062",
  structuredLabel: { ... },
  importance: 1.0
}
```

#### 概念ノード（40件）
- **ドメインノード（34件）**: 会員管理、求人管理、教室管理など
- **カテゴリノード（6件）**: spec, data, template, workflow, meeting, other

---

## 🔗 エッジタイプと抽出ロジック

### 1. URLリンク（weight: 1.0）✅ **最高信頼度**

**パターン**:
```typescript
/\/pages\/(\d+)/g
```

**例**:
```
https://giginc.atlassian.net/wiki/spaces/CLIENTTOMO/pages/772014210
→ 164 → 772014210
```

**特徴**:
- Confluence内部リンクのみ（Figmaリンクは除外）
- 最も信頼性が高い参照関係
- 自己参照は除外

---

### 2. ページ番号参照（weight: 0.7）✅ **中信頼度**

**パターン**:
```typescript
/(\d{3})_/g
```

**例**:
```
"177_【FIX】求人削除機能"
→ 164 → 177
```

**特徴**:
- すべての「NNN_」パターンを抽出
- シンプルで誤検出が少ない
- 重複は自動除外

---

### 3. ドメイン関係（weight: 0.5-0.7）

**構築方法**:
```typescript
// 同一ドメイン内のページを相互リンク
if (label1.domain === label2.domain) {
  weight = 0.5 (基本)
  weight = 0.7 (category一致時)
}
```

**例**:
```
164_教室削除機能 [domain: 求人管理]
⟷ 155_教室グループ削除機能 [domain: 求人管理]
```

---

### 4. タグ関係（weight: 0.3-1.0）

**構築方法**:
```typescript
// Jaccard類似度 >= 0.3
similarity = |tags1 ∩ tags2| / |tags1 ∪ tags2|
```

**例**:
```
164_教室削除機能 [tags: ["削除", "教室管理"]]
⟷ 124_企業削除機能 [tags: ["削除", "企業管理"]]
similarity: 0.5 → weight: 0.5
```

---

## 🔍 検索統合ロジック

### 検索フロー

```
1. ハイブリッド検索（Vector + BM25）
   ↓ 初期結果: 6-8件
   
2. Knowledge Graph拡張
   ├─ URLリンク・ページ番号参照: 最大2件
   │   └─ weight >= 0.7
   │
   └─ ドメイン関係: 最大1件
       └─ weight >= 0.5、合計12件未満の場合のみ
   
3. 最終結果: 8-12件
```

### 実装（`retrieve-relevant-docs-lancedb.ts`）

```typescript
// 各検索結果について関連ページを取得
for (const result of results) {
  const pageId = result.pageId;
  
  // 参照関係（高重み）を優先
  const referenced = await kgSearchService.getReferencedPages(pageId, 2);
  
  for (const { node, edge } of referenced.relatedPages) {
    if (addedPageIds.has(node.pageId)) continue;
    
    const relatedContent = await getPageContent(node.pageId);
    
    expanded.push({
      ...node,
      content: relatedContent,
      source: 'knowledge-graph',
      kgWeight: edge.weight
    });
    
    addedPageIds.add(node.pageId);
  }
  
  // ドメイン関連（中重み）も追加（最大1件、12件未満の場合のみ）
  if (expanded.length < 12) {
    const domainRelated = await kgSearchService.getRelatedPagesInDomain(pageId, 1);
    // ...
  }
}
```

---

## 📈 統計情報

### 構築規模

```
ノード総数: 679件
  - ページノード: 639件
  - 概念ノード: 40件

エッジ総数: ~4,000-5,000件（予想）
  - URLリンク: ~500-1,000件
  - ページ番号参照: ~500-1,000件
  - ドメイン関係: 20,720件
  - タグ関係: 2,140件
```

### エッジ密度

- **平均出次数**: ~6-8エッジ/ページ
- **参照関係**: ~1-2エッジ/ページ（URLリンク+ページ番号）

---

## 🛠️ 管理コマンド

```bash
# Knowledge Graph構築
npm run kg:build

# ノード一覧表示
npm run kg:list

# 特定ページの可視化
npm run kg:visualize <pageId>
npm run kg:visualize 718373062  # 164_教室削除機能

# Graphviz DOT形式
npm run kg:visualize:dot <pageId>
```

---

## 🎯 設計思想

### シンプル性重視

- **URLリンク**: 最も信頼性が高い（weight: 1.0）
- **ページ番号参照**: シンプルで誤検出が少ない（weight: 0.7）
- **複雑なテキストパターン**: 除外（誤検出が多いため）

### スケーラビリティ

- Firestore batch処理で500件ずつ保存
- エッジはインデックス付き（`from`, `to`フィールド）
- 検索時の取得は10件ずつのバッチ処理

### パフォーマンス

- 検索結果拡張: 1クエリあたり1-3回のFirestore読み取り
- キャッシング: LanceDBのチャンク取得結果をキャッシュ
- 拡張は最大12件まで（コンテキスト長の制約）

---

## 📝 実装ファイル

| ファイル | 役割 |
|---------|------|
| `src/types/knowledge-graph.ts` | 型定義 |
| `src/lib/kg-reference-extractor.ts` | 参照関係抽出 |
| `src/lib/kg-label-builder.ts` | StructuredLabel関係構築 |
| `src/lib/kg-storage-service.ts` | Firestore保存・取得 |
| `src/lib/kg-search-service.ts` | KG検索 |
| `src/ai/flows/retrieve-relevant-docs-lancedb.ts` | 検索統合 |
| `scripts/build-knowledge-graph.ts` | KG構築スクリプト |
| `scripts/visualize-kg.ts` | 可視化ツール |

---

## ✅ Phase 0A-2 完了

- [x] KG型定義
- [x] 参照関係抽出（URLリンク + ページ番号）
- [x] StructuredLabel関係構築
- [x] Firestore保存
- [x] KG検索サービス
- [x] 検索結果拡張
- [x] KG構築スクリプト
- [x] 可視化ツール

