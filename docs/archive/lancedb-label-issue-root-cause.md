# LanceDBラベル問題の根本原因分析

**作成日**: 2025年10月15日  
**優先度**: 🔴 緊急  
**ステータス**: 根本原因特定完了

---

## 🚨 **問題の概要**

```
LanceDB内のラベル状況: 0件 (0.0%) ❌
→ アーカイブ、議事録、スコープ外などの除外すべきページを
   フィルタリングできない
```

---

## 🔍 **根本原因の特定**

### 調査結果

| データソース | ラベル状況 | 評価 |
|-------------|-----------|------|
| **Confluence API** | 30%のページにラベルあり | ✅ 正常 |
| **LanceDB** | 0%（全1,316レコード） | ❌ 異常 |
| **Firestore** | 639件のStructuredLabel | ✅ 正常 |

### 問題発生のタイムライン

```
1. scripts/rebuild-lancedb-smart-chunking.ts 実行
   └─ Confluenceからページ取得
   └─ ラベル抽出: labels: (page.metadata?.labels?.results || []).map((l: any) => l.name)
   └─ LanceDBに保存
   └─ ❓ この時点でlabelsが保存されたか不明

2. scripts/sync-firestore-labels-to-lancedb.ts 実行（最近）
   └─ 既存LanceDBからレコード読み込み
   └─ labels: cleanLabels（既存labelsをクリーンアップ）
   └─ ❌ 既存labelsが空なので、cleanLabelsも空
   └─ LanceDB再作成
   └─ 結果: labelsは空のまま
```

### **結論**: 初回構築時にラベルが保存されなかった ❌

---

## 🕵️ **なぜラベルが保存されなかったか**

### 仮説1: Apache Arrow Schemaの問題

**コード** (`scripts/rebuild-lancedb-smart-chunking.ts:357`):
```typescript
new arrow.Field('labels', new arrow.List(new arrow.Field('item', new arrow.Utf8())), true),
```

**問題の可能性**:
- ✅ スキーマ定義は正しい
- ❓ 実際のデータが空配列`[]`で保存された可能性

### 仮説2: Confluenceラベル取得の問題

**コード** (`scripts/rebuild-lancedb-smart-chunking.ts:174`):
```typescript
labels: (page.metadata?.labels?.results || []).map((l: any) => l.name),
```

**検証結果**:
- ✅ Confluence APIからはラベル取得できている（30%）
- ✅ 構造は正しい：`{ name: "ワード・ディフィニション" }`
- ❓ しかし、`rebuild-lancedb-smart-chunking.ts`実行時には取得できなかった可能性

### 仮説3: expand パラメータの問題

**コード** (`scripts/rebuild-lancedb-smart-chunking.ts:108`):
```typescript
expand: 'body.storage,space,version,metadata.labels',
```

**検証**:
- ✅ `check-confluence-labels.ts`でも同じexpandで取得成功
- ❓ しかし、実行タイミングや環境で異なる可能性

### **最有力仮説**: 実行時にConfluenceからラベルが取得できなかった

**理由**:
1. Confluence APIの仕様変更
2. 権限の問題
3. expand パラメータのタイミング問題

---

## 📋 **仕様デグレードの詳細**

### 正しい仕様（docs/implementation/label-system-overview.md）

#### LanceDB構築時の除外対象

```typescript
const EXCLUDE_LABELS = [
  // 常に除外
  'スコープ外',
  '議事録',
  'meeting-notes',
  'アーカイブ',
  'archive',
  'フォルダ',
  'folder',
  'テンプレート',
  'template'
];
```

#### フィルタリングロジック

```typescript
async function fetchAllPages(): Promise<any[]> {
  //...
  const filteredPages = pages.filter((page: any) => {
    const labels = (page.metadata?.labels?.results || [])
      .map((l: any) => l.name || l.label || String(l));
    
    const hasExcludeLabel = labels.some((label: string) => {
      const labelLower = String(label).toLowerCase();
      return EXCLUDE_LABELS.some(ex => labelLower.includes(ex.toLowerCase()));
    });
    
    if (hasExcludeLabel) {
      console.log(`   [除外] ${page.title}: ${labels.join(', ')}`);
      return false; // 除外
    }
    
    return true; // 含める
  });
  
  allPages.push(...filteredPages);
  //...
}
```

### 現在の実装（デグレード）

```typescript
// ❌ フィルタリングなし
const pages = response.data.results;
allPages.push(...pages);

// ❌ labelsは取得しようとしているが、実際には保存されていない
labels: (page.metadata?.labels?.results || []).map((l: any) => l.name),
```

---

## 🎯 **修正計画**

### Step 1: ラベル取得の確認（デバッグ）

**スクリプト作成**: `scripts/test-label-extraction.ts`

```typescript
async function testLabelExtraction() {
  const page = await fetchSinglePage('666927116'); // "ワード・ディフィニション"
  
  console.log('Raw metadata:', JSON.stringify(page.metadata, null, 2));
  
  const labels = (page.metadata?.labels?.results || [])
    .map((l: any) => l.name || l.label || String(l));
  
  console.log('Extracted labels:', labels);
  console.log('Labels count:', labels.length);
}
```

---

### Step 2: rebuild-lancedb-smart-chunking.ts の修正

#### 修正1: ラベル抽出の改善

```typescript
// Line 174付近
// Before:
labels: (page.metadata?.labels?.results || []).map((l: any) => l.name),

// After（デバッグ付き）:
labels: (() => {
  const rawLabels = page.metadata?.labels?.results || [];
  const extractedLabels = rawLabels
    .map((l: any) => l.name || l.label || String(l))
    .filter((label: string) => label && label.length > 0);
  
  if (extractedLabels.length > 0) {
    console.log(`      [Labels] ${title}: ${extractedLabels.join(', ')}`);
  }
  
  return extractedLabels;
})(),
```

#### 修正2: 除外ラベルフィルタリングの追加

```typescript
// Line 90: fetchAllPages()の最初に定義
const EXCLUDE_LABELS = [
  'スコープ外',
  '議事録',
  'meeting-notes',
  'アーカイブ',
  'archive',
  'フォルダ',
  'folder',
  'テンプレート',
  'template'
];

// Line 114付近
const pages = response.data.results;

// 除外ラベルフィルタリング
const filteredPages = pages.filter((page: any) => {
  const labels = (page.metadata?.labels?.results || [])
    .map((l: any) => l.name || l.label || String(l));
  
  const hasExcludeLabel = labels.some((label: string) => {
    const labelLower = String(label).toLowerCase();
    return EXCLUDE_LABELS.some(ex => labelLower.includes(ex.toLowerCase()));
  });
  
  if (hasExcludeLabel) {
    console.log(`   [除外] ${page.title}: ${labels.join(', ')}`);
    return false;
  }
  
  return true;
});

allPages.push(...filteredPages); // ← filteredPagesを使用

console.log(`   取得中: ${allPages.length}ページ（除外: ${pages.length - filteredPages.length}件）...`);
```

---

### Step 3: LanceDB再構築

```bash
# 修正後
npm run lancedb:rebuild

# 期待結果:
# - 総ページ数: 950-1,000件（150-200件削減）
# - ラベルありレコード: 約300件 (30%)
# - 除外ログ: "議事録"、"アーカイブ"、"スコープ外" を含むページ
```

---

## 📊 **期待される効果**

### Before（現状）

```
Confluence: 1,145ページ
   ↓ フィルタリングなし
LanceDB: 1,316レコード（ラベル: 0件）
   ↓ 検索時に除外
検索結果: ノイズを含む可能性

問題:
  ❌ ラベルが保存されていない
  ❌ アーカイブ等が含まれている可能性
  ❌ 検索時の除外処理が効果を発揮しない
```

### After（修正後）

```
Confluence: 1,145ページ
   ↓ 除外ラベルフィルタリング（約150-200件除外）
LanceDB: 約950-1,000レコード（ラベル: 約30%保持）
   ↓ 検索時にもさらに除外
検索結果: クリーンな結果のみ

効果:
  ✅ ラベルが正しく保存される
  ✅ アーカイブ等が除外される
  ✅ 検索精度向上（ノイズ削減）
  ✅ 検索速度向上（候補数削減）
  ✅ LanceDBサイズ削減（約-15%）
```

---

## 🔧 **即座に実施すべきアクション**

### 優先度1: ラベル抽出のデバッグ 🔍

**工数**: 30分

**内容**:
1. `scripts/test-label-extraction.ts`を作成
2. 実際にConfluenceから1ページ取得してラベル構造を確認
3. ラベル抽出ロジックが正しいか検証

---

### 優先度2: rebuild-lancedb-smart-chunking.tsの修正 🔧

**工数**: 1時間

**修正内容**:
1. ラベル抽出にデバッグ出力を追加
2. 除外ラベルフィルタリングを追加
3. 保存後の検証を追加

---

### 優先度3: LanceDB再構築 ⚡

**工数**: 15-20分

**実行**:
```bash
npm run lancedb:rebuild
```

**期待結果**:
- ラベル保存率: 0% → 30%
- 総レコード数: 1,316 → 950-1,000件
- 除外ページ: 150-200件

---

## 💡 **まとめ**

### 仕様デグレードの詳細

| 項目 | 仕様 | 現状 | デグレード |
|------|------|------|----------|
| **ラベル保存** | すべてのページのラベルを保存 | 0件保存 | ❌ 致命的 |
| **除外フィルタリング** | アーカイブ、議事録等を除外 | 未実装 | ❌ 重大 |

### 影響

1. **検索精度**: アーカイブや議事録がノイズとして含まれる可能性
2. **検索速度**: 余分なページが候補に含まれ、処理遅延
3. **ラベルフィルタリング**: 機能していない（labelsが空）

### 推奨アクション

**即座に実施**:
1. ラベル抽出のデバッグ（30分）
2. rebuild-lancedb-smart-chunking.tsの修正（1時間）
3. LanceDB再構築（15-20分）

**合計工数**: 約2時間

---

**次のステップ**: `scripts/test-label-extraction.ts`でデバッグを実施


