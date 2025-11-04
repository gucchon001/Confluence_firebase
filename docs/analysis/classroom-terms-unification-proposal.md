# 教室管理関連キーワードの一元化提案

**作成日**: 2025年11月4日  
**問題**: `keyword-lists-loader.ts` のハードコードされたリスト

## 📋 問題の詳細

### 現在の状態

`src/lib/keyword-lists-loader.ts` の `isClassroomRelated` 関数で、教室管理に関連するキーワードがハードコードされています：

```typescript
private isClassroomRelated(keyword: string): boolean {
  const classroomTerms = [
    '教室', '管理', '一覧', '登録', '編集', '削除', 'コピー', '詳細',
    'スクール', '校舎', '事業所', 'マネジメント', '運用', 'オペレーション',
    '設定', '機能', '仕様', '要件', '画面', 'データ', '情報'
  ];
  
  return classroomTerms.some(term => keyword.includes(term));
}
```

### 重複の分析

このリストの多くが、既に `common-terms-config.ts` に定義されています：

#### 1. `GENERIC_FUNCTION_TERMS` に含まれる用語
- '管理' ✅
- '一覧' ✅
- '登録' ✅
- '編集' ✅
- '削除' ✅
- '詳細' ✅
- '設定' ❌ (含まれていない)
- '機能' ✅
- '仕様' ✅
- '要件' ❌ (含まれていない)
- '画面' ✅
- 'データ' ✅
- '情報' ✅

#### 2. `DOMAIN_SPECIFIC_KEYWORDS` に含まれる用語
- '教室' ✅
- 'コピー' ✅
- '削除' ✅

#### 3. 新しい用語（一元化すべき）
- 'スクール'
- '校舎'
- '事業所'
- 'マネジメント'
- '運用'
- 'オペレーション'
- '設定' (GENERIC_FUNCTION_TERMSに追加すべき)
- '要件' (GENERIC_FUNCTION_TERMSに追加すべき)

## 💡 解決策

### 1. `common-terms-config.ts` に新しい定数を追加

教室管理に関連するドメイン固有の用語を定義：

```typescript
/**
 * 教室管理関連のドメイン固有キーワード
 * 教室管理に関連するキーワードを判定する際に使用
 */
export const CLASSROOM_MANAGEMENT_KEYWORDS = [
  // 教室関連の用語
  'スクール',
  '校舎',
  '事業所',
  
  // 管理・運用関連の用語
  'マネジメント',
  '運用',
  'オペレーション',
] as const;

export const CLASSROOM_MANAGEMENT_KEYWORDS_SET = new Set(CLASSROOM_MANAGEMENT_KEYWORDS);
```

### 2. `GENERIC_FUNCTION_TERMS` に不足している用語を追加

```typescript
export const GENERIC_FUNCTION_TERMS = [
  // ... 既存の用語 ...
  '設定',  // 追加
  '要件',  // 追加
] as const;
```

### 3. `keyword-lists-loader.ts` を修正

```typescript
import { GENERIC_FUNCTION_TERMS, DOMAIN_SPECIFIC_KEYWORDS, CLASSROOM_MANAGEMENT_KEYWORDS } from './common-terms-config';

private isClassroomRelated(keyword: string): boolean {
  // 一元化: common-terms-config.ts の定義を使用
  const classroomTerms = [
    ...GENERIC_FUNCTION_TERMS,
    ...DOMAIN_SPECIFIC_KEYWORDS.filter(kw => kw === '教室' || kw === 'コピー'), // 教室関連のみ
    ...CLASSROOM_MANAGEMENT_KEYWORDS,
  ];
  
  return classroomTerms.some(term => keyword.includes(term));
}
```

または、より簡潔に：

```typescript
import { GENERIC_FUNCTION_TERMS_SET, DOMAIN_SPECIFIC_KEYWORDS_SET, CLASSROOM_MANAGEMENT_KEYWORDS_SET } from './common-terms-config';

private isClassroomRelated(keyword: string): boolean {
  const keywordLower = keyword.toLowerCase();
  
  // 汎用機能用語をチェック
  if (Array.from(GENERIC_FUNCTION_TERMS_SET).some(term => keywordLower.includes(term.toLowerCase()))) {
    return true;
  }
  
  // ドメイン固有キーワード（教室関連）をチェック
  if (keywordLower.includes('教室') || keywordLower.includes('コピー')) {
    return true;
  }
  
  // 教室管理関連キーワードをチェック
  if (Array.from(CLASSROOM_MANAGEMENT_KEYWORDS_SET).some(term => keywordLower.includes(term.toLowerCase()))) {
    return true;
  }
  
  return false;
}
```

## ✅ 効果

### 1. 一元化の完了
- すべての用語が `common-terms-config.ts` で管理される
- 重複が解消される

### 2. 保守性の向上
- 用語の追加・削除が容易になる
- 一貫性が保たれる

### 3. 拡張性の向上
- 他のドメイン（求人管理、会員管理など）にも同様のパターンを適用できる

## 📝 実装計画

1. **`common-terms-config.ts` に新しい定数を追加**
   - `CLASSROOM_MANAGEMENT_KEYWORDS` を追加
   - `GENERIC_FUNCTION_TERMS` に '設定', '要件' を追加

2. **`keyword-lists-loader.ts` を修正**
   - インポートを追加
   - `isClassroomRelated` 関数を修正

3. **テスト**
   - 教室管理関連のキーワード抽出が正しく動作するか確認

## ⚠️ 注意事項

### パフォーマンスへの影響

`Set` を使用することで、パフォーマンスが向上します：

```typescript
// 現在（配列の some メソッド）
classroomTerms.some(term => keyword.includes(term))

// 提案（Set を使用）
Array.from(CLASSROOM_MANAGEMENT_KEYWORDS_SET).some(term => keywordLower.includes(term.toLowerCase()))
```

ただし、`includes` による部分マッチングが必要なため、完全な `Set.has()` は使用できません。

### 将来的な拡張

他のドメイン（求人管理、会員管理など）にも同様のパターンを適用する場合：

```typescript
export const JOB_MANAGEMENT_KEYWORDS = [
  '求人', '応募', '採用', 'オファー',
] as const;

export const MEMBER_MANAGEMENT_KEYWORDS = [
  '会員', 'ユーザー', 'アカウント',
] as const;
```

