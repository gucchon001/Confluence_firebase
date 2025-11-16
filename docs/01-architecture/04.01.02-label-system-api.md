# ラベルシステム API仕様書

## 概要

ラベルシステムのAPI仕様書です。開発者がラベル機能を利用する際の詳細な仕様を記載しています。

## インポート

```typescript
// メインクラス
import { LabelManager, labelManager } from './src/lib/label-manager';

// 型定義
import { LabelManagerConfig, LabelFilterOptions } from './src/lib/label-manager';

// ユーティリティ関数
import { 
  getLabelsAsArray, 
  filterLabels, 
  hasIncludedLabel 
} from './src/lib/label-utils';
```

## 型定義

### LabelFilterOptions

```typescript
export interface LabelFilterOptions {
  /** 議事録を含めるかどうか */
  includeMeetingNotes: boolean;
  /** アーカイブを含めるかどうか */
  includeArchived: boolean;
}
```

### LabelManagerConfig

```typescript
export interface LabelManagerConfig {
  /** 常に除外するラベル配列 */
  excludeAlways: string[];
  /** 条件付き除外ラベルのマッピング */
  excludeConditional: Record<string, keyof LabelFilterOptions>;
}
```

## LabelManager API

### コンストラクタ

```typescript
constructor(config?: Partial<LabelManagerConfig>)
```

**パラメータ**:
- `config` (optional): カスタム設定の一部

**例**:
```typescript
const customManager = new LabelManager({
  excludeAlways: ['テスト', 'ドラフト'],
  excludeConditional: {
    '一時的': 'includeTemporary'
  }
});
```

### buildExcludeLabels

```typescript
buildExcludeLabels(filterOptions: LabelFilterOptions): string[]
```

**目的**: フィルタオプションに基づいて除外ラベルリストを生成

**パラメータ**:
- `filterOptions`: フィルタオプション

**戻り値**: 除外対象のラベル文字列配列

**例**:
```typescript
const filterOptions = { includeMeetingNotes: false, includeArchived: false };
const excludeLabels = labelManager.buildExcludeLabels(filterOptions);
// 結果: ['スコープ外', 'メールテンプレート', '議事録', 'meeting-notes', 'アーカイブ', 'archive']
```

### isExcluded

```typescript
isExcluded(labels: any, excludeLabels: string[]): boolean
```

**目的**: ラベルが除外対象かどうかを判定

**パラメータ**:
- `labels`: チェック対象のラベル（任意の形式）
- `excludeLabels`: 除外対象ラベル配列

**戻り値**: 除外対象の場合true

**例**:
```typescript
const labels = ['機能要件', '議事録', 'テスト'];
const excludeLabels = ['議事録', 'テスト'];
const result = labelManager.isExcluded(labels, excludeLabels);
// 結果: true (議事録が含まれているため)
```

### filterResults

```typescript
filterResults<T extends { labels?: any }>(
  results: T[], 
  filterOptions: LabelFilterOptions
): T[]
```

**目的**: 結果リストにラベルフィルタリングを適用

**パラメータ**:
- `results`: フィルタリング対象の結果配列
- `filterOptions`: フィルタオプション

**戻り値**: フィルタリング後の結果配列

**例**:
```typescript
const results = [
  { title: 'ドキュメント1', labels: ['機能要件'] },
  { title: 'ドキュメント2', labels: ['議事録'] },
  { title: 'ドキュメント3', labels: ['アーカイブ'] }
];

const filterOptions = { includeMeetingNotes: false, includeArchived: false };
const filtered = labelManager.filterResults(results, filterOptions);
// 結果: [{ title: 'ドキュメント1', labels: ['機能要件'] }]
```

### getDefaultFilterOptions

```typescript
getDefaultFilterOptions(): LabelFilterOptions
```

**目的**: デフォルトのラベルフィルタオプションを取得

**戻り値**: デフォルト設定

**例**:
```typescript
const defaultOptions = labelManager.getDefaultFilterOptions();
// 結果: { includeMeetingNotes: false, includeArchived: false }
```

### updateConfig

```typescript
updateConfig(config: Partial<LabelManagerConfig>): void
```

**目的**: 設定を更新

**パラメータ**:
- `config`: 更新する設定の一部

**例**:
```typescript
labelManager.updateConfig({
  excludeAlways: ['スコープ外', 'メールテンプレート', 'テスト']
});
```

## LabelUtils API

### getLabelsAsArray

```typescript
getLabelsAsArray(labels: any): string[]
```

**目的**: ラベルを文字列配列に正規化

**パラメータ**:
- `labels`: 正規化対象のラベル（任意の形式）

**戻り値**: 正規化された文字列配列

**対応形式**:
- `string[]`: 配列
- `List`: LanceDBのList型
- `Utf8Vector`: Utf8Vector<Utf8>オブジェクト
- `string`: JSON配列文字列またはカンマ区切り文字列

**例**:
```typescript
// 配列
getLabelsAsArray(['ラベル1', 'ラベル2']);
// 結果: ['ラベル1', 'ラベル2']

// JSON文字列
getLabelsAsArray('["ラベル1", "ラベル2"]');
// 結果: ['ラベル1', 'ラベル2']

// カンマ区切り文字列
getLabelsAsArray('ラベル1,ラベル2');
// 結果: ['ラベル1', 'ラベル2']
```

### filterLabels

```typescript
filterLabels(labels: string[], excludeLabels: string[]): string[]
```

**目的**: ラベル配列をフィルタリング

**パラメータ**:
- `labels`: フィルタリング対象のラベル配列
- `excludeLabels`: 除外対象ラベル配列

**戻り値**: 除外ラベルを除いた配列

**例**:
```typescript
const labels = ['ラベル1', 'ラベル2', 'ラベル3'];
const excludeLabels = ['ラベル2'];
const result = filterLabels(labels, excludeLabels);
// 結果: ['ラベル1', 'ラベル3']
```

### hasIncludedLabel

```typescript
hasIncludedLabel(labels: string[], includeLabels: string[]): boolean
```

**目的**: ラベル配列が包含ラベルを含むかチェック

**パラメータ**:
- `labels`: チェック対象のラベル配列
- `includeLabels`: 包含対象ラベル配列

**戻り値**: 包含ラベルを含む場合true

**例**:
```typescript
const labels = ['ラベル1', 'ラベル2'];
const includeLabels = ['ラベル2', 'ラベル3'];
const result = hasIncludedLabel(labels, includeLabels);
// 結果: true (ラベル2が含まれているため)
```

## 使用例

### 基本的な使用パターン

```typescript
import { labelManager } from './src/lib/label-manager';

// 1. デフォルトフィルタオプションを取得
const filterOptions = labelManager.getDefaultFilterOptions();

// 2. 除外ラベルリストを生成
const excludeLabels = labelManager.buildExcludeLabels(filterOptions);

// 3. 個別のラベルをチェック
const doc = { title: 'テストドキュメント', labels: ['機能要件', '議事録'] };
const isExcluded = labelManager.isExcluded(doc.labels, excludeLabels);
console.log(isExcluded); // true (議事録が含まれているため)

// 4. 結果リストをフィルタリング
const results = [
  { title: 'ドキュメント1', labels: ['機能要件'] },
  { title: 'ドキュメント2', labels: ['議事録'] },
  { title: 'ドキュメント3', labels: ['アーカイブ'] }
];

const filteredResults = labelManager.filterResults(results, filterOptions);
console.log(filteredResults.length); // 1 (機能要件のみ)
```

### カスタム設定での使用

```typescript
import { LabelManager } from './src/lib/label-manager';

// カスタム設定でLabelManagerを作成
const customManager = new LabelManager({
  excludeAlways: ['テスト', 'ドラフト', '一時的'],
  excludeConditional: {
    'レビュー中': 'includeInReview',
    '承認待ち': 'includePending'
  }
});

// カスタムフィルタオプション
const customFilterOptions = {
  includeMeetingNotes: false,
  includeArchived: false,
  includeInReview: true,
  includePending: false
};

const excludeLabels = customManager.buildExcludeLabels(customFilterOptions);
// 結果: ['テスト', 'ドラフト', '一時的', '承認待ち']
```

### 検索システムとの統合

```typescript
import { labelManager } from './src/lib/label-manager';

async function searchWithLabelFilter(query: string) {
  // デフォルトフィルタオプションを取得
  const filterOptions = labelManager.getDefaultFilterOptions();
  
  // 検索を実行（仮想的な検索関数）
  const searchResults = await performSearch(query);
  
  // ラベルフィルタリングを適用
  const filteredResults = labelManager.filterResults(searchResults, filterOptions);
  
  return filteredResults;
}
```

## エラーハンドリング

### 一般的なエラー

1. **不正なラベル形式**
   ```typescript
   // getLabelsAsArrayは空配列を返す
   const result = getLabelsAsArray(null);
   console.log(result); // []
   ```

2. **設定エラー**
   ```typescript
   try {
     labelManager.updateConfig({ invalidProperty: 'value' });
   } catch (error) {
     console.error('設定更新エラー:', error);
   }
   ```

### デバッグ情報

```typescript
// フィルタリング時に除外された結果のログ出力
const filteredResults = labelManager.filterResults(results, filterOptions);
// コンソールに除外された結果のタイトルが出力される
```

## パフォーマンス考慮事項

1. **大文字小文字の比較**: 効率的な文字列比較を実装
2. **メモリ使用量**: 大きな結果セットでのメモリ効率を考慮
3. **計算量**: O(n*m) の比較処理（n: ラベル数, m: 除外ラベル数）

## テスト

```typescript
import { labelManager } from './src/lib/label-manager';

// テスト実行
npx tsx src/scripts/test-label-filters.ts
```

## バージョン情報

- **現在のバージョン**: 2.0
- **最終更新**: 2025-09-22
- **主要変更**: ラベルスコア機能の削除、統一管理システムの導入
