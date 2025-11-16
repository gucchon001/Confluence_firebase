# LanceDBラベルフィルタリング仕様書

**作成日**: 2025年10月15日  
**ステータス**: 仕様デグレード発見 🚨  
**優先度**: 高

---

## 🚨 **発見された問題**

### 現状

```
LanceDB内のラベル状況:
  総レコード数: 1,316件
  ラベルありレコード: 0件 (0.0%) ❌
  ラベルなしレコード: 1,316件 (100.0%) ❌

Confluence APIからのラベル取得:
  サンプルページ: 10件
  ラベルあり: 3件 (30.0%) ✅
  ラベルなし: 7件 (70.0%)
```

### **問題**: LanceDBにラベルが保存されていない ❌

---

## 📜 **正しい仕様**

### 1. LanceDB構築時の除外対象

LanceDB再構築時（`scripts/rebuild-lancedb-smart-chunking.ts`）には、以下のラベルを持つページを**除外すべき**：

#### 常に除外（Always Exclude）

```typescript
const ALWAYS_EXCLUDE_LABELS = [
  'スコープ外',           // 検索対象外のドキュメント
  '議事録',              // ミーティング議事録
  'meeting-notes',       // 英語版議事録
  'アーカイブ',          // アーカイブ済みページ
  'archive',             // 英語版アーカイブ
  'フォルダ',            // フォルダページ
  'folder',              // 英語版フォルダ
  'テンプレート',        // テンプレートページ
  'template'             // 英語版テンプレート
];
```

#### 理由

| ラベル | 除外理由 |
|--------|---------|
| **スコープ外** | プロジェクトスコープ外のドキュメント |
| **議事録** | ミーティング記録（検索対象外） |
| **アーカイブ** | 古い・使用されていない情報 |
| **フォルダ** | 組織化用の空ページ |
| **テンプレート** | 雛形ページ（実データではない） |

---

### 2. 正しい実装パターン

#### Confluenceページ取得時のフィルタリング

```typescript
async function fetchAllPages(): Promise<any[]> {
  const auth = Buffer.from(`${CONFLUENCE_USER_EMAIL}:${CONFLUENCE_API_TOKEN}`).toString('base64');
  const allPages: any[] = [];
  let start = 0;
  const limit = 100;
  
  // 除外対象ラベル
  const EXCLUDE_LABELS = [
    'スコープ外', '議事録', 'meeting-notes', 
    'アーカイブ', 'archive', 
    'フォルダ', 'folder',
    'テンプレート', 'template'
  ];
  
  while (true) {
    const response = await axios.get(
      `${CONFLUENCE_BASE_URL}/wiki/rest/api/content`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
        },
        params: {
          spaceKey: CONFLUENCE_SPACE_KEY,
          limit: limit,
          start: start,
          expand: 'body.storage,space,version,metadata.labels', // ラベル取得
          type: 'page',
        },
      }
    );
    
    const pages = response.data.results;
    
    // ラベルフィルタリング
    const filteredPages = pages.filter((page: any) => {
      const labels = (page.metadata?.labels?.results || []).map((l: any) => l.name || l.label || String(l));
      
      // 除外対象ラベルチェック
      const hasExcludeLabel = labels.some((label: string) => {
        const labelLower = String(label).toLowerCase();
        return EXCLUDE_LABELS.some(ex => labelLower.includes(ex.toLowerCase()));
      });
      
      if (hasExcludeLabel) {
        console.log(`   [除外] ${page.title}: ラベル=${labels.join(', ')}`);
        return false; // 除外
      }
      
      return true; // 含める
    });
    
    allPages.push(...filteredPages);
    
    if (pages.length < limit) break;
    start += limit;
    
    console.log(`   取得中: ${allPages.length}ページ（除外: ${pages.length - filteredPages.length}件）...`);
  }
  
  console.log(`\n✅ 取得完了: ${allPages.length}ページ（フィルタリング後）`);
  return allPages;
}
```

---

### 3. ラベル保存の正しい実装

```typescript
async function processPage(page: any, stats: ProcessingStats): Promise<any[]> {
  const pageId = page.id;
  const title = page.title || 'Untitled';
  const bodyHtml = page.body?.storage?.value || '';
  const plainText = stripHtml(bodyHtml);
  
  // ラベル取得（正しい方法）
  const labels = (page.metadata?.labels?.results || [])
    .map((l: any) => l.name || l.label || String(l))
    .filter((label: string) => label && label.length > 0);
  
  console.log(`   Labels for ${title}: ${labels.join(', ') || '(none)'}`);
  
  // ... チャンキング処理 ...
  
  records.push({
    id: pageId,
    pageId: pageId,
    title: title,
    content: plainText,
    vector: embedding,
    isChunked: false,
    chunkIndex: 0,
    totalChunks: 1,
    spaceKey: page.space?.key || CONFLUENCE_SPACE_KEY,
    lastUpdated: page.version?.when || new Date().toISOString(),
    labels: labels, // ← ラベルを保存
  });
  
  return records;
}
```

---

## 🔍 **調査結果**

### 現在の実装（`scripts/rebuild-lancedb-smart-chunking.ts`）

#### ❌ 問題点1: ラベルフィルタリングが未実装

```typescript
// Line 90-123: fetchAllPages()
async function fetchAllPages(): Promise<any[]> {
  // ...
  const pages = response.data.results;
  allPages.push(...pages); // ← 全ページをそのまま追加（フィルタリングなし）
  // ...
}
```

**問題**: アーカイブ、議事録、スコープ外などのページもすべて取得・保存

#### ❌ 問題点2: ラベルが保存されていない可能性

```typescript
// Line 174: ラベル取得
labels: (page.metadata?.labels?.results || []).map((l: any) => l.name),
```

**調査結果**:
- Confluence APIからはラベルが取得できている（30%のページ）
- しかし、LanceDBには0件保存されている
- **推測**: スキーマ定義やデータクリーニング時にラベルが削除された可能性

---

## 📋 **正しい仕様の定義**

### 仕様1: Confluenceページ取得時の除外

**対象スクリプト**: `scripts/rebuild-lancedb-smart-chunking.ts`

**除外対象**:
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
  'template',
  
  // オプション: プロジェクトによって調整
  '本システム外',
  '参考資料',
  '削除予定',
  '不要'
];
```

**フィルタリングロジック**:
```typescript
const filteredPages = pages.filter((page: any) => {
  const labels = (page.metadata?.labels?.results || [])
    .map((l: any) => l.name || l.label || String(l));
  
  const hasExcludeLabel = labels.some((label: string) => {
    const labelLower = String(label).toLowerCase();
    return EXCLUDE_LABELS.some(ex => labelLower.includes(ex.toLowerCase()));
  });
  
  return !hasExcludeLabel; // 除外ラベルがなければ含める
});
```

---

### 仕様2: ラベル保存の確認

**対象スクリプト**: `scripts/rebuild-lancedb-smart-chunking.ts`

**保存前の確認**:
```typescript
// ラベル取得（デバッグ出力付き）
const labels = (page.metadata?.labels?.results || [])
  .map((l: any) => l.name || l.label || String(l))
  .filter((label: string) => label && label.length > 0);

console.log(`   [Labels] ${title}: ${labels.length}件 - ${labels.join(', ') || '(none)'}`);

// レコードに保存
records.push({
  // ...
  labels: labels, // ← 必ず保存
});
```

**保存後の検証**:
```typescript
// LanceDB保存後、サンプルレコードを確認
const sampleRecords = await table.query().limit(5).toArray();
console.log('\nSample records with labels:');
sampleRecords.forEach((r, i) => {
  console.log(`  ${i + 1}. ${r.title}`);
  console.log(`     Labels: ${r.labels ? r.labels.join(', ') : '(none)'}`);
});
```

---

### 仕様3: 検索時の除外（既存）

**対象ファイル**: `src/lib/label-manager.ts`, `src/lib/lancedb-search-client.ts`

**除外ロジック（既に実装済み）**:
```typescript
// label-manager.ts
const excludeLabels = [
  'スコープ外',
  '議事録',
  'meeting-notes',
  'アーカイブ',
  'archive',
  'フォルダ'
];

// lancedb-search-client.ts
vectorResults = vectorResults.filter(result => {
  return !labelManager.isExcluded(result.labels, excludeLabels);
});
```

**ステータス**: ✅ 正しく実装されている（検索時）

---

## 🎯 **修正が必要な箇所**

### 優先度1: LanceDB再構築スクリプトの修正 🔴

**ファイル**: `scripts/rebuild-lancedb-smart-chunking.ts`

**修正内容**:
1. ✅ `fetchAllPages()`に除外ラベルフィルタリングを追加
2. ✅ ラベル保存の確認（デバッグ出力）
3. ✅ スキーマ定義でlabelsフィールドを保持
4. ❌ **問題**: 現在、ラベルが保存されていない原因を調査

---

### 優先度2: ラベル保存の根本原因調査 🔍

**可能性**:

1. **スキーマ定義で除外された**
   - Line 245-275: スキーマ定義時に`labels`を除外した可能性
   
2. **データクリーニング時に削除された**
   - Line 354-373: `validRecords`のクリーニング時に削除された可能性
   
3. **Apache Arrow変換時にエラー**
   - `labels: List<string>`の変換に失敗した可能性

**調査方法**:
```typescript
// 保存直前のレコードを確認
console.log('Sample record before save:', JSON.stringify(allRecords[0], null, 2));

// 保存後のレコードを確認
const saved = await table.query().limit(1).toArray();
console.log('Sample record after save:', JSON.stringify(saved[0], null, 2));
```

---

## 📊 **期待される動作**

### Before（現状 - デグレード）

```
Confluence API: 1,145ページ（ラベルあり: 約30%）
   ↓ フィルタリングなし
LanceDB: 1,316レコード（ラベル: 0件） ❌

問題:
  ❌ アーカイブ、議事録、スコープ外などが含まれている可能性
  ❌ ラベル情報が失われている
  ❌ 検索時に除外処理が必要（パフォーマンス低下）
```

### After（仕様通り）

```
Confluence API: 1,145ページ（ラベルあり: 約30%）
   ↓ 除外ラベルフィルタリング
LanceDB: 約950-1,000レコード（ラベル: 約30%保持） ✅

効果:
  ✅ 除外対象ページがLanceDBに含まれない
  ✅ ラベル情報が保持される
  ✅ 検索精度向上（ノイズ削減）
  ✅ 検索速度向上（候補数削減）
```

---

## 🔧 **修正アクション**

### Step 1: 根本原因の特定

**調査スクリプト**: `scripts/debug-label-save-issue.ts`を作成

```typescript
// 1件のページを処理してラベルが保存されるか確認
const testPage = fetchSinglePage('666927116'); // "ワード・ディフィニション"
const record = await processPage(testPage);
console.log('Record labels:', record.labels);

// LanceDBに保存
await table.add([record]);

// 取得して確認
const saved = await table.query().where(`pageId = ${testPage.id}`).toArray();
console.log('Saved labels:', saved[0].labels);
```

---

### Step 2: rebuild-lancedb-smart-chunking.tsの修正

**修正箇所**:

1. **Line 90-123: fetchAllPages()にフィルタリング追加**
   ```typescript
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
   
   allPages.push(...filteredPages);
   ```

2. **Line 174: ラベル取得の改善（デバッグ付き）**
   ```typescript
   const labels = (page.metadata?.labels?.results || [])
     .map((l: any) => l.name || l.label || String(l))
     .filter((label: string) => label && label.length > 0);
   
   if (labels.length > 0) {
     console.log(`   [Labels] ${title}: ${labels.join(', ')}`);
   }
   
   records.push({
     // ...
     labels: labels, // ← 必ず保存
   });
   ```

3. **Line 354-373: データクリーニング時にlabelsを保持**
   ```typescript
   const validRecords = allRecords
     .filter((r: any) => r.vector && Array.isArray(r.vector) && r.vector.length === 768)
     .map((r: any) => ({
       id: r.id,
       pageId: r.pageId,
       title: r.title,
       content: r.content,
       vector: Array.from(r.vector),
       isChunked: r.isChunked,
       chunkIndex: r.chunkIndex,
       totalChunks: r.totalChunks,
       labels: r.labels || [], // ← labelsを保持
       spaceKey: r.spaceKey,
       lastUpdated: r.lastUpdated
     }));
   ```

---

### Step 3: LanceDB再構築の実行

```bash
# 修正後、LanceDBを再構築
npm run lancedb:rebuild

# 確認
npx tsx scripts/analyze-lancedb-labels.ts
```

**期待結果**:
```
総レコード数: 950-1,000件
ラベルありレコード: 約300件 (30%)
除外対象レコード: 0件 (0%)
```

---

## 📚 **参考仕様**

### ラベルフィルタリング関連ドキュメント

1. **`docs/implementation/label-system-overview.md`**
   - 常に除外されるラベル: `スコープ外`, `メールテンプレート`
   - 条件付き除外: `議事録`, `アーカイブ`

2. **`docs/implementation/label-system-design.md`**
   - `LabelManager`の仕様
   - `buildExcludeLabels()`メソッド

3. **`docs/architecture/enhanced-hybrid-search-design.md`**
   - Stage 3でラベルフィルタリング（検索時）

---

## 🎯 **まとめ**

### 仕様デグレードの詳細

| 項目 | 仕様 | 現状 | 影響 |
|------|------|------|------|
| **ラベル保存** | すべてのページのラベルを保存 | 0件保存 | ❌ 致命的 |
| **除外フィルタリング** | 8種類のラベルで除外 | 未実装 | ❌ 重大 |
| **データ品質** | クリーンなデータのみ | ノイズ含む | ⚠️ 中程度 |

### 推奨アクション

1. **即座に実施**: ラベル保存の根本原因調査（1時間）
2. **短期**: `rebuild-lancedb-smart-chunking.ts`を修正（2時間）
3. **中期**: LanceDB再構築を実行（15-20分）

---

**作成日**: 2025年10月15日  
**次のステップ**: 根本原因調査スクリプトの実行


