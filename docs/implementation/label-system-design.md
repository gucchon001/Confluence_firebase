# ラベルシステム設計書

## 概要

Confluence検索システムにおけるラベル機能は、ドキュメントの分類とフィルタリングを提供する統一管理システムです。ラベルスコア機能は削除され、純粋なフィルタリング機能のみを提供します。

## アーキテクチャ

### システム構成

```
LabelManager (メインクラス)
├── LabelManagerConfig (設定インターフェース)
├── LabelFilterOptions (フィルタオプション)
└── labelManager (シングルトンインスタンス)

LabelUtils (ユーティリティ関数)
├── getLabelsAsArray()
├── filterLabels()
└── hasIncludedLabel()
```

## クラス定義

### 1. LabelManager

**ファイル**: `src/lib/label-manager.ts`

**役割**: ラベルフィルタリングの統一管理

```typescript
export class LabelManager {
  private config: LabelManagerConfig;

  constructor(config?: Partial<LabelManagerConfig>);

  // 主要メソッド
  buildExcludeLabels(filterOptions: LabelFilterOptions): string[];
  isExcluded(labels: any, excludeLabels: string[]): boolean;
  filterResults<T extends { labels?: any }>(results: T[], filterOptions: LabelFilterOptions): T[];
  getDefaultFilterOptions(): LabelFilterOptions;
  updateConfig(config: Partial<LabelManagerConfig>): void;
}
```

#### メソッド詳細

##### `buildExcludeLabels(filterOptions: LabelFilterOptions): string[]`
- **目的**: フィルタオプションに基づいて除外ラベルリストを生成
- **戻り値**: 除外対象のラベル文字列配列
- **処理内容**:
  1. 常に除外するラベルを追加
  2. 条件付き除外ラベルをチェック
  3. 除外ラベルリストを返す

##### `isExcluded(labels: any, excludeLabels: string[]): boolean`
- **目的**: ラベルが除外対象かどうかを判定
- **引数**: 
  - `labels`: チェック対象のラベル（任意の形式）
  - `excludeLabels`: 除外対象ラベル配列
- **戻り値**: 除外対象の場合true
- **処理内容**:
  1. ラベルを文字列配列に正規化
  2. 大文字小文字を区別せずに比較
  3. 除外対象ラベルとの一致をチェック

##### `filterResults<T>(results: T[], filterOptions: LabelFilterOptions): T[]`
- **目的**: 結果リストにラベルフィルタリングを適用
- **引数**:
  - `results`: フィルタリング対象の結果配列
  - `filterOptions`: フィルタオプション
- **戻り値**: フィルタリング後の結果配列
- **処理内容**:
  1. 除外ラベルリストを生成
  2. 各結果のラベルをチェック
  3. 除外対象でない結果のみを返す

##### `getDefaultFilterOptions(): LabelFilterOptions`
- **目的**: デフォルトのラベルフィルタオプションを取得
- **戻り値**: デフォルト設定
- **デフォルト値**:
  - `includeMeetingNotes: false`
  - `includeArchived: false`

##### `updateConfig(config: Partial<LabelManagerConfig>): void`
- **目的**: 設定を更新
- **引数**: 更新する設定の一部

### 2. LabelManagerConfig

**ファイル**: `src/lib/label-manager.ts`

**役割**: LabelManagerの設定を定義

```typescript
export interface LabelManagerConfig {
  /** 常に除外するラベル */
  excludeAlways: string[];
  /** 条件付き除外ラベルのマッピング */
  excludeConditional: Record<string, keyof LabelFilterOptions>;
}
```

#### デフォルト設定

```typescript
{
  excludeAlways: ['スコープ外', 'メールテンプレート'],
  excludeConditional: {
    '議事録': 'includeMeetingNotes',
    'meeting-notes': 'includeMeetingNotes',
    'アーカイブ': 'includeArchived',
    'archive': 'includeArchived'
  }
}
```

### 3. LabelFilterOptions

**ファイル**: `src/lib/search-weights.ts`

**役割**: フィルタオプションを定義

```typescript
export interface LabelFilterOptions {
  includeMeetingNotes: boolean;
  includeArchived: boolean;
}
```

### 4. LabelUtils

**ファイル**: `src/lib/label-utils.ts`

**役割**: ラベル処理の共通ユーティリティ関数

#### `getLabelsAsArray(labels: any): string[]`
- **目的**: ラベルを文字列配列に正規化
- **対応形式**:
  - 配列
  - LanceDBのList型
  - Utf8Vector<Utf8>オブジェクト
  - JSON配列文字列
  - カンマ区切り文字列
- **戻り値**: 正規化された文字列配列

#### `filterLabels(labels: string[], excludeLabels: string[]): string[]`
- **目的**: ラベル配列をフィルタリング
- **戻り値**: 除外ラベルを除いた配列

#### `hasIncludedLabel(labels: string[], includeLabels: string[]): boolean`
- **目的**: ラベル配列が包含ラベルを含むかチェック
- **戻り値**: 包含ラベルを含む場合true

## 使用パターン

### 1. 基本使用

```typescript
import { labelManager } from './label-manager';

// デフォルトフィルタオプションを取得
const filterOptions = labelManager.getDefaultFilterOptions();

// 除外ラベルリストを生成
const excludeLabels = labelManager.buildExcludeLabels(filterOptions);

// ラベルが除外対象かチェック
const isExcluded = labelManager.isExcluded(doc.labels, excludeLabels);

// 結果リストをフィルタリング
const filteredResults = labelManager.filterResults(results, filterOptions);
```

### 2. カスタム設定

```typescript
import { LabelManager } from './label-manager';

const customLabelManager = new LabelManager({
  excludeAlways: ['カスタム除外', 'テスト'],
  excludeConditional: {
    'ドラフト': 'includeDrafts'
  }
});
```

### 3. 設定更新

```typescript
labelManager.updateConfig({
  excludeAlways: ['新しい除外ラベル']
});
```

## 統合箇所

### 検索システムとの統合

1. **LanceDB検索**: `src/lib/lancedb-search-client.ts`
   - ベクトル検索結果のフィルタリング
   - BM25検索結果のフィルタリング

2. **Lunr検索**: `src/lib/lunr-search-client.ts`
   - BM25検索結果のフィルタリング

3. **検索ヘルパー**: `src/lib/search-helpers.ts`
   - キーワード検索結果のフィルタリング
   - タイトル完全一致検索結果のフィルタリング

### テスト

**ファイル**: `src/scripts/test-label-filters.ts`

- ラベルフィルタリングの動作確認
- デバッグ情報の出力

## 設計思想

### 1. 統一管理
- ラベル機能を単一のクラスで管理
- 重複コードの排除
- 一貫したインターフェース

### 2. 柔軟性
- カスタム設定のサポート
- 条件付きフィルタリング
- 拡張可能な設計

### 3. パフォーマンス
- ラベルスコア計算の削除
- 純粋なフィルタリング機能
- 効率的な文字列比較

### 4. 保守性
- 明確な責任分離
- 型安全性の確保
- 詳細なドキュメント

## 変更履歴

### v2.0 (現在)
- ラベルスコア機能を削除
- LabelManagerクラスによる統一管理
- 重複コードの排除

### v1.0 (以前)
- 複数ファイルに分散したラベル機能
- ラベルスコア計算機能
- 重複する実装

## 今後の拡張可能性

1. **新しいフィルタタイプの追加**
2. **ラベル階層のサポート**
3. **動的フィルタルール**
4. **ラベル統計機能**

## 注意事項

1. **ラベルスコア機能は削除済み** - 検索スコアには影響しません
2. **大文字小文字を区別しない比較** - 一貫性を保つため
3. **空文字列のラベルは除外** - データ品質の向上
4. **シングルトンパターン** - グローバルな一貫性を保つため
