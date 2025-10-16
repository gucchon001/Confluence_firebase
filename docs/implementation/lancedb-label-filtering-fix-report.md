# LanceDB ラベルフィルタリング修正完了報告

**バージョン**: 1.0  
**作成日**: 2025年10月15日  
**Phase**: Phase 0A-2  
**ステータス**: ✅ 修正完了

---

## 📋 問題の発覚

ユーザーからの指摘により、**オリジナル設計では除外ラベルを持つページを最初からダウンロードしない仕様**であったことが判明しました。

### 現状の問題
`scripts/rebuild-lancedb-smart-chunking.ts` がアーカイブ等の除外ラベルを持つページもダウンロードしてしまっていました。

---

## ✅ オリジナル設計仕様の確認

### 除外ルール (`src/lib/confluence-sync-service.ts` Line 56-57)

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

### フィルタリングロジック (`src/lib/confluence-sync-service.ts` Line 264-290)

```typescript
private shouldExcludePage(page: ConfluencePage): boolean {
  // 1. ラベルによる除外
  // 2. タイトルパターンによる除外
  // 3. コンテンツ長による除外（100文字未満）
}
```

---

## 🔧 実施した修正

### 1. フィルタリングロジックの追加

**ファイル**: `scripts/rebuild-lancedb-smart-chunking.ts`

#### 除外定義の追加 (Line 30-43)
```typescript
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
```

#### shouldExcludePage 関数の追加 (Line 75-109)
```typescript
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
  const content = stripHtml(page.body?.storage?.value || '');
  if (content.length < MIN_CONTENT_LENGTH) {
    console.log(`   [除外] 短いコンテンツ: ${page.title} (${content.length}文字)`);
    return true;
  }
  
  return false;
}
```

#### メイン処理でのフィルタリング適用 (Line 297-308)
```typescript
// Phase 0A-2: 除外ページのフィルタリング
console.log('🚫 Step 1.5: 除外ページのフィルタリング中...\n');
const beforeFiltering = allPages.length;
const pages = allPages.filter(page => !shouldExcludePage(page));
const excludedCount = beforeFiltering - pages.length;

console.log(`\n📊 フィルタリング結果:`);
console.log(`   取得前: ${beforeFiltering}ページ`);
console.log(`   除外: ${excludedCount}ページ (${(excludedCount / beforeFiltering * 100).toFixed(1)}%)`);
console.log(`   処理対象: ${pages.length}ページ\n`);
```

---

### 2. スキーマを EXTENDED_LANCEDB_SCHEMA に統一

**ファイル**: `scripts/rebuild-lancedb-smart-chunking.ts`

#### インポート追加 (Line 9)
```typescript
import { EXTENDED_LANCEDB_SCHEMA } from '../src/lib/lancedb-schema-extended';
```

#### スキーマ統一 (Line 397-403)
```typescript
// Phase 0A-2: 拡張スキーマを使用（StructuredLabel統合版）
// - 基本フィールド + StructuredLabelフィールド
// - Firestore統合による高度なフィルタリング・スコアリング対応

// 最初のバッチでテーブルを作成（拡張スキーマ指定）
const firstBatch = validRecords.slice(0, Math.min(100, validRecords.length));
const table = await db.createTable('confluence', firstBatch, { schema: EXTENDED_LANCEDB_SCHEMA });
```

#### StructuredLabelフィールドの追加 (Line 227-237, 267-277)
```typescript
// Phase 0A-2: StructuredLabelフィールド（Firestore同期前はundefined）
structured_category: undefined,
structured_domain: undefined,
structured_feature: undefined,
structured_priority: undefined,
structured_status: undefined,
structured_version: undefined,
structured_tags: undefined,
structured_confidence: undefined,
structured_content_length: undefined,
structured_is_valid: undefined,
```

---

### 3. ラベル取得の確認

**ファイル**: `scripts/rebuild-lancedb-smart-chunking.ts` (Line 108)

```typescript
expand: 'body.storage,space,version,metadata.labels',
```

✅ **確認済み**: Confluenceページ取得時に `metadata.labels` が正しく含まれています。

---

### 4. フィルタリング検証スクリプトの作成

**ファイル**: `scripts/verify-label-filtering.ts`

#### 機能
1. ✅ 除外ラベルのチェック
2. ✅ 除外タイトルパターンのチェック
3. ✅ 短いコンテンツのチェック
4. ✅ ラベル統計の表示
5. ✅ 総合評価レポート

#### 実行コマンド
```bash
npm run lancedb:verify
```

---

## 📊 期待される結果

### Before (修正前)
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
    ├─ アーカイブページ: なし ✅
    ├─ スコープ外ページ: なし ✅
    └─ 短いページ: なし ✅
```

---

## 🧪 検証手順

### Step 1: LanceDB再構築
```bash
npm run lancedb:rebuild
```

### Step 2: フィルタリング検証
```bash
npm run lancedb:verify
```

### Step 3: 結果確認
期待される出力:
```
╔════════════════════════════════════════════════════════════════════════╗
║       総合評価                                                          ║
╚════════════════════════════════════════════════════════════════════════╝

✅ すべてのフィルタリングが正しく機能しています！
   除外ラベル: 0件
   除外タイトル: 0件
   短いコンテンツ: 0件
```

---

## 📝 修正ファイル一覧

### 修正されたファイル
1. ✅ `scripts/rebuild-lancedb-smart-chunking.ts`
   - 除外ラベル・タイトルパターン定義追加
   - `shouldExcludePage()` 関数追加
   - メイン処理でのフィルタリング適用
   - `EXTENDED_LANCEDB_SCHEMA` への統一
   - StructuredLabelフィールドの追加

2. ✅ `package.json`
   - `lancedb:verify` コマンド追加

### 新規作成されたファイル
3. ✅ `scripts/verify-label-filtering.ts`
   - フィルタリング検証スクリプト

4. ✅ `docs/implementation/lancedb-label-filtering-specification.md`
   - 仕様書

5. ✅ `docs/implementation/lancedb-label-filtering-fix-report.md`
   - 修正完了報告書（本ファイル）

---

## 🎯 次のステップ

### 即座に実行可能
```bash
# LanceDB再構築（フィルタリング適用）
npm run lancedb:rebuild

# フィルタリング検証
npm run lancedb:verify
```

### 後続作業
1. ✅ Firestore StructuredLabels 同期
   ```bash
   npm run sync:firestore-labels
   ```

2. ✅ 検索品質テスト
   ```bash
   npm run perf:test
   ```

---

## 🔗 関連ドキュメント

- `docs/implementation/lancedb-label-filtering-specification.md`: 詳細仕様
- `docs/architecture/lancedb-firestore-integration-design.md`: Firestore統合設計
- `src/lib/lancedb-schema-extended.ts`: 拡張スキーマ定義
- `src/lib/confluence-sync-service.ts`: オリジナル実装

---

## 📅 履歴

- **2025-10-15**: デグレード確認、修正実装、検証スクリプト作成

