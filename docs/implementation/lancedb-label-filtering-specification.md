# LanceDB ラベルフィルタリング仕様

**バージョン**: 1.0  
**作成日**: 2025年10月15日  
**Phase**: Phase 0A-2  
**ステータス**: デグレード修正

---

## 📋 問題

現在、`scripts/rebuild-lancedb-smart-chunking.ts` がアーカイブ等の除外ラベルを持つページもダウンロードしてしまっている。

**デグレード確認**:
```bash
# 現状: scripts/rebuild-lancedb-smart-chunking.ts
# ❌ ラベルフィルタリングなし → 全ページダウンロード
```

---

## ✅ オリジナル設計仕様

### 除外ルール

`src/lib/confluence-sync-service.ts` (Line 56-57) で定義：

```typescript
private readonly EXCLUDED_LABELS = [
  'アーカイブ', 
  'archive', 
  'フォルダ', 
  'スコープ外'
];

private readonly EXCLUDED_TITLE_PATTERNS = [
  '■要件定義', 
  'xxx_', 
  '【削除】', 
  '【不要】', 
  '【統合により削除】', 
  '【機能廃止のため作成停止】', 
  '【他ツールへ機能切り出しのため作成停止】'
];
```

### フィルタリングロジック

`src/lib/confluence-sync-service.ts` (Line 264-290) で実装：

```typescript
private shouldExcludePage(page: ConfluencePage): boolean {
  // 1. ラベルによる除外
  const labels = this.extractLabelsFromPage(page);
  const hasExcludedLabel = shouldExcludeByLabels(labels, this.EXCLUDED_LABELS);
  
  if (hasExcludedLabel) {
    console.log(`🚫 除外対象: ${page.title} (${page.id}) - ラベル: [${labels.join(', ')}]`);
    return true;
  }
  
  // 2. タイトルパターンによる除外
  const hasExcludedTitlePattern = this.EXCLUDED_TITLE_PATTERNS.some(pattern => 
    page.title.includes(pattern)
  );
  
  if (hasExcludedTitlePattern) {
    console.log(`🚫 除外対象: ${page.title} (${page.id}) - タイトルパターン: ${pattern}`);
    return true;
  }
  
  // 3. コンテンツ長による除外（100文字未満）
  const content = page.content || '';
  if (content.length < 100) {
    console.log(`🚫 除外対象: ${page.title} (${page.id}) - コンテンツ長: ${content.length}文字`);
    return true;
  }
  
  return false;
}
```

---

## 🔧 修正方針

### Step 1: `scripts/rebuild-lancedb-smart-chunking.ts` にフィルタリング追加

```typescript
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 除外ラベル・タイトルパターン定義
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const EXCLUDED_LABELS = ['アーカイブ', 'archive', 'フォルダ', 'スコープ外'];
const EXCLUDED_TITLE_PATTERNS = [
  '■要件定義', 
  'xxx_', 
  '【削除】', 
  '【不要】', 
  '【統合により削除】', 
  '【機能廃止のため作成停止】', 
  '【他ツールへ機能切り出しのため作成停止】'
];
const MIN_CONTENT_LENGTH = 100;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// フィルタリング関数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function shouldExcludePage(page: any): boolean {
  // 1. ラベルによる除外
  const labels = page.metadata?.labels?.results?.map((l: any) => l.name) || [];
  const hasExcludedLabel = labels.some((label: string) => 
    EXCLUDED_LABELS.includes(label)
  );
  
  if (hasExcludedLabel) {
    console.log(`   [除外] ラベル: ${page.title} - ${labels.join(', ')}`);
    return true;
  }
  
  // 2. タイトルパターンによる除外
  const hasExcludedTitlePattern = EXCLUDED_TITLE_PATTERNS.some(pattern => 
    page.title.includes(pattern)
  );
  
  if (hasExcludedTitlePattern) {
    console.log(`   [除外] タイトル: ${page.title}`);
    return true;
  }
  
  // 3. コンテンツ長による除外
  const contentLength = page.content?.length || 0;
  if (contentLength < MIN_CONTENT_LENGTH) {
    console.log(`   [除外] 短いコンテンツ: ${page.title} (${contentLength}文字)`);
    return true;
  }
  
  return false;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ページフィルタリング適用
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log(`\n📋 全ページ取得: ${allPages.length}件\n`);

const beforeFiltering = allPages.length;
const filteredPages = allPages.filter(page => !shouldExcludePage(page));
const excludedCount = beforeFiltering - filteredPages.length;

console.log(`\n📊 フィルタリング結果:`);
console.log(`   取得前: ${beforeFiltering}件`);
console.log(`   除外: ${excludedCount}件 (${(excludedCount / beforeFiltering * 100).toFixed(1)}%)`);
console.log(`   処理対象: ${filteredPages.length}件\n`);

// filteredPages を使用してLanceDB構築
const pages = filteredPages;
```

### Step 2: ラベル情報の取得確認

Confluenceページ取得時に `expand=metadata.labels` が含まれているか確認：

```typescript
// ページ取得時のexpandパラメータ
const url = `${CONFLUENCE_BASE_URL}/wiki/rest/api/content?spaceKey=${spaceKey}&expand=body.storage,version,metadata.labels&limit=100&start=${start}`;
```

---

## 📊 期待される結果

### Before (現状)
```
取得ページ数: 1,145件
└─ LanceDBレコード: 1,316件
    ├─ アーカイブページ: 含む ❌
    ├─ スコープ外ページ: 含む ❌
    └─ 短いページ: 含む ❌
```

### After (修正後)
```
取得ページ数: 1,145件
除外: ~300件 (推定26%)
├─ アーカイブラベル: ~200件
├─ スコープ外ラベル: ~50件
├─ 除外タイトルパターン: ~30件
└─ 短いコンテンツ: ~20件

処理対象: ~845件
└─ LanceDBレコード: ~950件 (チャンキング含む)
```

---

## 🧪 検証方法

### 1. フィルタリング統計の確認

```bash
npm run lancedb:rebuild
```

**期待されるログ出力**:
```
📊 フィルタリング結果:
   取得前: 1,145件
   除外: 300件 (26.2%)
   処理対象: 845件
   
   [除外内訳]
   - アーカイブラベル: 200件
   - スコープ外ラベル: 50件
   - 除外タイトルパターン: 30件
   - 短いコンテンツ: 20件
```

### 2. LanceDB内容の確認

```typescript
// scripts/verify-label-filtering.ts
import * as lancedb from '@lancedb/lancedb';

async function main() {
  const db = await lancedb.connect('.lancedb');
  const table = await db.openTable('confluence');
  const allRecords = await table.query().toArray();
  
  console.log(`総レコード数: ${allRecords.length}`);
  
  // アーカイブラベルを持つレコードをチェック
  const archiveRecords = allRecords.filter((r: any) => {
    const labels = r.labels || [];
    return labels.some((label: string) => 
      ['アーカイブ', 'archive', 'フォルダ', 'スコープ外'].includes(label)
    );
  });
  
  console.log(`\n❌ 除外ラベルを持つレコード: ${archiveRecords.length}件`);
  if (archiveRecords.length > 0) {
    console.log('   [警告] フィルタリングが正しく機能していません！');
  } else {
    console.log('   ✅ フィルタリング成功');
  }
}

main();
```

---

## 📝 実装優先度

**最優先**: ✅ Step 1 (フィルタリングロジック追加)  
**次**: Step 2 (ラベル取得確認)  
**検証**: フィルタリング統計・LanceDB内容確認

---

## 🔗 関連ファイル

- `src/lib/confluence-sync-service.ts` (Line 56-57, 264-290): オリジナル仕様
- `scripts/rebuild-lancedb-smart-chunking.ts`: 修正対象スクリプト
- `scripts/archive/production-full-sync.ts` (Line 59-90): 過去の実装例

---

## 📅 履歴

- **2025-10-15**: デグレード確認、仕様書作成

