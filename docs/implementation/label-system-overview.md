# ラベルシステム概要

## システム概要

Confluence検索システムのラベル機能は、ドキュメントの分類と検索結果のフィルタリングを提供する統一管理システムです。2025年9月に大幅なリファクタリングが実施され、ラベルスコア機能を削除し、純粋なフィルタリング機能に特化した設計に変更されました。

## 主要な特徴

### 1. 統一管理システム
- **LabelManagerクラス**: すべてのラベル機能を一元管理
- **シングルトンパターン**: グローバルな一貫性を保証
- **型安全性**: TypeScriptによる厳密な型チェック

### 2. 純粋なフィルタリング機能
- **ラベルスコア削除**: 検索スコア計算からラベル重み付けを除外
- **高速フィルタリング**: 効率的な文字列比較アルゴリズム
- **柔軟な設定**: カスタムフィルタルールのサポート

### 3. 多様なラベル形式対応
- **LanceDB形式**: Utf8Vector<Utf8>、List型
- **JSON形式**: 配列文字列、オブジェクト配列
- **テキスト形式**: カンマ区切り文字列

## システム構成

```
ラベルシステム
├── コア機能
│   ├── LabelManager (メインクラス)
│   ├── LabelManagerConfig (設定)
│   └── LabelFilterOptions (フィルタオプション)
├── ユーティリティ
│   ├── getLabelsAsArray() (正規化)
│   ├── filterLabels() (フィルタリング)
│   └── hasIncludedLabel() (包含チェック)
└── 統合箇所
    ├── LanceDB検索
    ├── Lunr検索
    └── 検索ヘルパー
```

## フィルタリング仕様

### 常に除外されるラベル
- `スコープ外`: 検索対象外のドキュメント
- `メールテンプレート`: メール関連のテンプレート

### 条件付き除外ラベル
- `議事録`, `meeting-notes`: `includeMeetingNotes`がfalseの場合
- `アーカイブ`, `archive`: `includeArchived`がfalseの場合

### デフォルト設定
```typescript
{
  includeMeetingNotes: false,
  includeArchived: false
}
```

## 使用例

### 基本的な使用
```typescript
import { labelManager } from './src/lib/label-manager';

// デフォルトフィルタオプション
const filterOptions = labelManager.getDefaultFilterOptions();

// 除外ラベルリスト生成
const excludeLabels = labelManager.buildExcludeLabels(filterOptions);

// ラベル除外チェック
const isExcluded = labelManager.isExcluded(doc.labels, excludeLabels);

// 結果フィルタリング
const filteredResults = labelManager.filterResults(results, filterOptions);
```

### カスタム設定
```typescript
const customManager = new LabelManager({
  excludeAlways: ['テスト', 'ドラフト'],
  excludeConditional: {
    'レビュー中': 'includeInReview'
  }
});
```

## 統合箇所

### 1. LanceDB検索 (`src/lib/lancedb-search-client.ts`)
- ベクトル検索結果のフィルタリング
- BM25検索結果のフィルタリング
- ハイブリッド検索結果のフィルタリング

### 2. Lunr検索 (`src/lib/lunr-search-client.ts`)
- BM25検索結果のフィルタリング
- 検索クエリフィルタリング

### 3. 検索ヘルパー (`src/lib/search-helpers.ts`)
- キーワード検索結果のフィルタリング
- タイトル完全一致検索結果のフィルタリング
- ベクトル検索結果のフィルタリング

## パフォーマンス特性

### 計算量
- **フィルタリング**: O(n*m) (n: ラベル数, m: 除外ラベル数)
- **正規化**: O(k) (k: ラベル配列の長さ)
- **比較**: 大文字小文字を区別しない効率的な比較

### メモリ効率
- シングルトンパターンによるメモリ使用量の最適化
- 大きな結果セットでの効率的なフィルタリング
- ガベージコレクションを考慮した設計

## 設計思想

### 1. 単一責任の原則
- ラベルフィルタリングに特化
- 検索スコア計算から分離
- 明確な責任範囲

### 2. 開放閉鎖の原則
- 新しいフィルタタイプの追加が容易
- 既存コードへの影響を最小化
- 拡張可能な設計

### 3. 依存性逆転の原則
- 抽象化されたインターフェース
- 具体的な実装からの独立性
- テスト容易性の向上

## 変更履歴

### v2.0 (2025-09-22) - 現在
**主要変更**:
- ラベルスコア機能を完全削除
- LabelManagerクラスによる統一管理
- 重複コードの排除
- 型安全性の向上

**削除された機能**:
- `calculateLabelScore`関数
- `LABEL_WEIGHTS`定数
- `hasExcludedLabel`関数
- 複数ファイルに分散した実装

### v1.0 (以前)
**特徴**:
- 複数ファイルに分散したラベル機能
- ラベルスコア計算機能
- 重複する実装
- 保守性の課題

## テスト

### テストファイル
- `src/scripts/test-label-filters.ts`: ラベルフィルタリングの動作確認

### テスト実行
```bash
npx tsx src/scripts/test-label-filters.ts
```

### テスト内容
- デフォルトフィルタオプションの動作確認
- 除外ラベルリスト生成のテスト
- ラベル除外判定のテスト
- 結果フィルタリングのテスト

## 今後の拡張計画

### 短期計画
1. **パフォーマンス最適化**: 大きなデータセットでの効率化
2. **エラーハンドリング強化**: より詳細なエラー情報の提供
3. **ログ機能の改善**: デバッグ情報の充実

### 中期計画
1. **新しいフィルタタイプ**: 日付範囲、数値範囲フィルタ
2. **ラベル階層サポート**: 親子関係のあるラベルの処理
3. **動的フィルタルール**: 実行時でのフィルタルール変更

### 長期計画
1. **ラベル統計機能**: ラベル使用状況の分析
2. **機械学習統合**: 自動ラベル分類
3. **外部システム連携**: 他のラベルシステムとの連携

## 関連ドキュメント

- [ラベルシステム設計書](./label-system-design.md): 詳細な設計仕様
- [ラベルシステムAPI仕様書](./label-system-api.md): API仕様と使用例
- [検索システム設計書](./lancedb-search-design.md): 検索システム全体の設計
- [ハイブリッド検索仕様書](./lancedb-hybrid-search.md): ハイブリッド検索の詳細

## サポート

### 問題報告
- GitHub Issuesで問題を報告
- 詳細な再現手順とエラーメッセージを含める

### 機能要求
- 新機能の要求はGitHub Issuesで提案
- 使用例と期待される動作を明記

### ドキュメント改善
- ドキュメントの改善提案を歓迎
- プルリクエストで直接貢献可能
