# 汎用語の一元化完了

**作成日**: 2025年11月4日  
**変更内容**: ペナルティを課す汎用語の一元化

## 📋 問題

### 一元化されていない状態

`src/lib/lancedb-search-client.ts` の `calculateTitleMatch` 関数で、汎用語のリストがハードコードされていました：

```typescript
// 1225行目
const genericTerms = ['機能', 'function', '管理', '管理機能', '【fix】', '【fix】', '_', '【', '】'];

// 1267行目
const genericTerms = ['機能', 'function', '管理', '管理機能', '【fix】', '【fix】', '_', '【', '】', 'fix', 'fix'];
```

一方で、`src/lib/common-terms-config.ts` には `GENERIC_FUNCTION_TERMS` が定義されていますが、使用されていませんでした。

## ✅ 修正内容

### 1. インポートの追加

```typescript
// 修正前
import { GENERIC_DOCUMENT_TERMS, CommonTermsHelper } from './common-terms-config';

// 修正後
import { GENERIC_DOCUMENT_TERMS, GENERIC_FUNCTION_TERMS, CommonTermsHelper } from './common-terms-config';
```

### 2. 汎用語リストの一元化

```typescript
// 修正前（1225行目）
const genericTerms = ['機能', 'function', '管理', '管理機能', '【fix】', '【fix】', '_', '【', '】'];

// 修正後
// 一元化: common-terms-config.ts の GENERIC_FUNCTION_TERMS を使用
const genericTerms = [...GENERIC_FUNCTION_TERMS, '【fix】', '【FIX】', '_', '【', '】'];
```

```typescript
// 修正前（1267行目）
const genericTerms = ['機能', 'function', '管理', '管理機能', '【fix】', '【fix】', '_', '【', '】', 'fix', 'fix'];

// 修正後
// 一元化: common-terms-config.ts の GENERIC_FUNCTION_TERMS を使用
const genericTerms = [...GENERIC_FUNCTION_TERMS, '【fix】', '【FIX】', '_', '【', '】', 'fix'];
```

## 📊 一元化された汎用語リスト

`src/lib/common-terms-config.ts` の `GENERIC_FUNCTION_TERMS` には以下が含まれています：

- 機能関連: '機能', '仕様', '画面', 'ページ'
- 操作関連: '管理', '一覧', '登録', '編集', '削除', '閲覧', '詳細', '情報', '新規', '作成', '更新'
- データ・帳票関連: '帳票', 'データ'
- フロー・プロセス関連: 'フロー'

## ✅ 効果

### 1. 保守性の向上

- 汎用語の追加・削除は `common-terms-config.ts` のみで行える
- 重複コードが解消され、一貫性が保たれる

### 2. 一貫性の確保

- すべての箇所で同じ汎用語リストが使用される
- タイトルマッチングのペナルティ計算が統一される

### 3. 拡張性の向上

- 新しい汎用語を追加する際は、`common-terms-config.ts` に追加するだけで全箇所に反映される

## 📝 注意事項

### タイトル固有の汎用語

以下の用語は、`GENERIC_FUNCTION_TERMS` には含まれていないため、追加で指定しています：

- `'【fix】'`, `'【FIX】'`: タイトルプレフィックス
- `'_'`: タイトル区切り文字
- `'【'`, `'】'`: タイトルマーカー
- `'fix'`: プレフィックスの一部

これらはタイトル固有の用語のため、`GENERIC_FUNCTION_TERMS` とは別に管理しています。

## ✅ まとめ

- ✅ **一元化完了**: 汎用語リストが `common-terms-config.ts` に統一されました
- ✅ **保守性向上**: 汎用語の追加・削除が容易になりました
- ✅ **一貫性確保**: すべての箇所で同じ汎用語リストが使用されます

