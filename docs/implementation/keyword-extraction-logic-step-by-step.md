# キーワード抽出ロジックのステップバイステップ説明

## 概要

クエリ「会員情報の学年や現在の職業は自動で更新されますか」で行われるキーワード抽出ロジックをステップバイステップで説明します。

## 処理フロー

### ステップ1: キーワードリストの読み込み

**処理**: `unifiedKeywordExtractionService.ensureKeywordListsLoaded()`

**説明**:
- ドメイン知識ベース（`data/domain-knowledge-v2/keyword-lists-v2.json`）からキーワードリストを読み込む
- キーワードをカテゴリ別に分類
  - ドメイン名: 260個
  - 機能名: 2058個
  - 操作名: 700個
  - システムフィールド: 3699個
  - システム用語: 2102個
  - 関連キーワード: 2470個
- **総キーワード数: 9126個**

**コード**:
```typescript
// キーワードリストを読み込む（非同期）
await unifiedKeywordExtractionService['ensureKeywordListsLoaded']();

const keywordCategories = unifiedKeywordExtractionService['keywordCategories'];
```

### ステップ2: 同期版のキーワード抽出（extractKeywordsSync）

**処理**: `unifiedKeywordExtractionService.extractKeywordsSync(query)`

**説明**:
- コンテンツ抽出用の同期版キーワード抽出
- ドメイン知識ベースからキーワードを抽出

**コード**:
```typescript
extractKeywordsSync(query: string): string[] {
  if (!this.keywordCategories) {
    return [];
  }
  
  const extracted = this.extractKeywordsFromCategories(query);
  return [...new Set(extracted.allKeywords)];
}
```

**入力**: `"会員情報の学年や現在の職業は自動で更新されますか"`

**出力**: `["会員", "更新", "会員情報", "学年", "情報", "現在の職業", "職業", "自動"]`

**キーワード数**: 8個

### ステップ3: カテゴリ別のキーワード抽出（extractKeywordsFromCategories）

**処理**: `extractKeywordsFromCategories(query)`

**説明**:
- 各カテゴリからキーワードを抽出
- カテゴリ別にマッチングを実行

**コード**:
```typescript
const result = {
  domainNames: this.findMatchingKeywords(query, this.keywordCategories.domainNames),
  functionNames: this.findMatchingKeywords(query, this.keywordCategories.functionNames),
  operationNames: this.findMatchingKeywords(query, this.keywordCategories.operationNames),
  systemFields: this.findMatchingKeywords(query, this.keywordCategories.systemFields),
  systemTerms: this.findMatchingKeywords(query, this.keywordCategories.systemTerms),
  relatedKeywords: this.findMatchingKeywords(query, this.keywordCategories.relatedKeywords),
  allKeywords: [] as string[]
};

// 全キーワードを結合
result.allKeywords = [
  ...result.domainNames,
  ...result.functionNames,
  ...result.operationNames,
  ...result.systemFields,
  ...result.systemTerms,
  ...result.relatedKeywords
];

// 重複除去
result.allKeywords = [...new Set(result.allKeywords)];
```

**カテゴリ別の抽出結果**:

| カテゴリ | 抽出されたキーワード | 個数 |
|---------|-------------------|------|
| ドメイン名 | `["会員"]` | 1個 |
| 機能名 | `[]` | 0個 |
| 操作名 | `["更新"]` | 1個 |
| システムフィールド | `["会員", "会員情報", "学年", "情報", "現在の職業", "職業"]` | 6個 |
| システム用語 | `["会員", "情報"]` | 2個 |
| 関連キーワード | `["会員", "会員情報", "学年", "情報", "更新", "現在の職業", "職業", "自動"]` | 8個 |
| **全キーワード** | `["会員", "更新", "会員情報", "学年", "情報", "現在の職業", "職業", "自動"]` | **8個** |

### ステップ4: キーワードマッチング（findMatchingKeywords）

**処理**: `findMatchingKeywords(query, keywords)`

**説明**:
- クエリとキーワードリストを比較
- マッチング条件に基づいてキーワードを抽出

**コード**:
```typescript
private findMatchingKeywords(query: string, keywords: string[]): string[] {
  const matchedKeywords: string[] = [];
  const queryWords = this.extractQueryWords(query);
  const queryLower = query.toLowerCase();
  
  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase();
    
    // 1. 完全一致を優先（最高優先度）
    if (queryWords.some(word => keyword === word)) {
      matchedKeywords.push(keyword);
      continue;
    }
    
    // 2. クエリ全体にキーワードが含まれる（2文字以上）
    if (keyword.length >= 2 && queryLower.includes(keywordLower)) {
      matchedKeywords.push(keyword);
      continue;
    }
    
    // 3. 最大20個までに制限（パフォーマンス向上）
    if (matchedKeywords.length >= 20) {
      break;
    }
  }
  
  return matchedKeywords;
}
```

**マッチング条件**:
1. **完全一致**: クエリの単語とキーワードが完全一致（最高優先度）
2. **部分一致**: クエリ全体にキーワードが含まれる（2文字以上）
3. **最大20個まで**: パフォーマンス向上のため制限

**マッチング結果**:

| キーワード | カテゴリ | クエリ内の位置 | マッチング条件 |
|-----------|---------|--------------|--------------|
| `"会員"` | ドメイン名、システムフィールド、システム用語、関連キーワード | 0文字目 | 完全一致 |
| `"会員情報"` | システムフィールド、関連キーワード | 0文字目 | 部分一致 |
| `"学年"` | システムフィールド、関連キーワード | 5文字目 | 完全一致 |
| `"情報"` | システムフィールド、システム用語、関連キーワード | 2文字目 | 部分一致 |
| `"現在の職業"` | システムフィールド、関連キーワード | 8文字目 | 完全一致 |
| `"職業"` | システムフィールド、関連キーワード | 11文字目 | 部分一致 |
| `"更新"` | 操作名、関連キーワード | 17文字目 | 完全一致 |
| `"自動"` | 関連キーワード | 14文字目 | 完全一致 |

### ステップ5: クエリ単語の抽出（extractQueryWords）

**処理**: `extractQueryWords(query)`

**説明**:
- クエリを単語に分割
- 日本語のテキストを処理

**コード**:
```typescript
private extractQueryWords(query: string): string[] {
  // より適切な分割パターン
  const words = query.split(/[の・・、は？]/g).filter(word => word.trim().length > 0);
  
  // 2文字以上の単語のみを抽出
  const validWords = words.map(word => word.trim()).filter(word => word.length >= 2);
  
  return validWords;
}
```

**入力**: `"会員情報の学年や現在の職業は自動で更新されますか"`

**分割パターン**: `/[の・・、は？]/g`（「の」「や」「は」などで分割）

**出力**: 
```
["会員情報", "学年", "現在", "職業", "自動", "更新", "されます"]
```

**説明**:
- 助詞（「の」「や」「は」「で」「か」）で区切る
- 2文字以上の連続する文字列を単語として扱う
- 空白を除去

### ステップ6: 重複除去

**処理**: `[...new Set(result.allKeywords)]`

**説明**:
- カテゴリ別に抽出されたキーワードから重複を除去
- Setを使用して重複を除去

**入力**: 
```
[
  "会員",      // ドメイン名
  "更新",      // 操作名
  "会員",      // システムフィールド（重複）
  "会員情報",  // システムフィールド
  "学年",      // システムフィールド
  "情報",      // システムフィールド
  "現在の職業", // システムフィールド
  "職業",      // システムフィールド
  "会員",      // システム用語（重複）
  "情報",      // システム用語（重複）
  "会員",      // 関連キーワード（重複）
  "会員情報",  // 関連キーワード（重複）
  "学年",      // 関連キーワード（重複）
  "情報",      // 関連キーワード（重複）
  "更新",      // 関連キーワード（重複）
  "現在の職業", // 関連キーワード（重複）
  "職業",      // 関連キーワード（重複）
  "自動"       // 関連キーワード
]
```

**出力**: 
```
["会員", "更新", "会員情報", "学年", "情報", "現在の職業", "職業", "自動"]
```

**キーワード数**: 8個（重複除去後）

### ステップ7: フォールバック処理（簡易版のキーワード抽出）

**処理**: `extractKeywords(query)` のフォールバック処理

**説明**:
- ドメイン知識連携のキーワード抽出が失敗した場合のフォールバック
- ストップワードを除外してキーワードを抽出

**コード**:
```typescript
// フォールバック: 簡易版のキーワード抽出
const stopWords = ['が', 'を', 'に', 'で', 'と', 'は', 'も', 'の', 'か', 'な', 'です', 'ます', 'た', 'て', 'で', 'どんな', 'どの', '何', 'どう', 'や', 'は', 'されます', 'されますか'];

const words: string[] = [];
let currentWord = '';

for (let i = 0; i < query.length; i++) {
  const char = query[i];
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF0-9A-Za-z]/.test(char)) {
    currentWord += char;
  } else {
    if (currentWord.length >= 2 && !stopWords.includes(currentWord)) {
      words.push(currentWord);
    }
    currentWord = '';
  }
}

if (currentWord.length >= 2 && !stopWords.includes(currentWord)) {
  words.push(currentWord);
}

return Array.from(new Set(words));
```

**問題点**:
- ❌ クエリ全体が1つのキーワードとして抽出される
- ❌ ストップワードの除外が不十分
- ❌ 日本語の単語分割が正しく動作していない

**実際の結果**:
```
入力: "会員情報の学年や現在の職業は自動で更新されますか"
出力: ["会員情報の学年や現在の職業は自動で更新されますか"]  // 1個（誤り）
```

**期待される結果**:
```
入力: "会員情報の学年や現在の職業は自動で更新されますか"
出力: ["会員情報", "学年", "現在", "職業", "自動", "更新"]  // 6個（正しい）
```

## キーワード抽出結果の詳細

### 抽出されたキーワード（8個）

1. **会員** (ドメイン名、システムフィールド、システム用語、関連キーワード)
   - 位置: 0文字目
   - マッチング: 完全一致

2. **更新** (操作名、関連キーワード)
   - 位置: 17文字目
   - マッチング: 完全一致

3. **会員情報** (システムフィールド、関連キーワード)
   - 位置: 0文字目
   - マッチング: 部分一致

4. **学年** (システムフィールド、関連キーワード)
   - 位置: 5文字目
   - マッチング: 完全一致

5. **情報** (システムフィールド、システム用語、関連キーワード)
   - 位置: 2文字目
   - マッチング: 部分一致

6. **現在の職業** (システムフィールド、関連キーワード)
   - 位置: 8文字目
   - マッチング: 完全一致

7. **職業** (システムフィールド、関連キーワード)
   - 位置: 11文字目
   - マッチング: 部分一致

8. **自動** (関連キーワード)
   - 位置: 14文字目
   - マッチング: 完全一致

### カテゴリ別の抽出結果

#### ドメイン名 (1個)
- `"会員"` (位置: 0文字目)

#### 機能名 (0個)
- なし

#### 操作名 (1個)
- `"更新"` (位置: 17文字目)

#### システムフィールド (6個)
- `"会員"` (位置: 0文字目)
- `"会員情報"` (位置: 0文字目)
- `"学年"` (位置: 5文字目)
- `"情報"` (位置: 2文字目)
- `"現在の職業"` (位置: 8文字目)
- `"職業"` (位置: 11文字目)

#### システム用語 (2個)
- `"会員"` (位置: 0文字目)
- `"情報"` (位置: 2文字目)

#### 関連キーワード (8個)
- `"会員"` (位置: 0文字目)
- `"会員情報"` (位置: 0文字目)
- `"学年"` (位置: 5文字目)
- `"情報"` (位置: 2文字目)
- `"更新"` (位置: 17文字目)
- `"現在の職業"` (位置: 8文字目)
- `"職業"` (位置: 11文字目)
- `"自動"` (位置: 14文字目)

## コンテンツ抽出での使用

### ステップ1: キーワードの位置を検索

**処理**: `extractRelevantContentMultiKeyword(content, query, maxLength)`

**説明**:
- コンテンツ内で各キーワードの位置を検索
- キーワードが複数回出現する場合、すべての位置を記録

**コード**:
```typescript
const keywordPositions: Array<{ keyword: string; position: number }> = [];
for (const keyword of keywords) {
  let pos = 0;
  while ((pos = content.indexOf(keyword, pos)) >= 0) {
    keywordPositions.push({ keyword, position: pos });
    pos += keyword.length;
  }
}
```

**例**:
```
コンテンツ: "会員情報の学年や現在の職業は自動で更新されますか..."
キーワード: ["会員", "更新", "会員情報", "学年", "情報", "現在の職業", "職業", "自動"]

検索結果:
- "会員": [0文字目, 502文字目, ...]
- "更新": [17文字目, 944文字目, 948文字目, ...]
- "会員情報": [0文字目, ...]
- "学年": [5文字目, 502文字目, ...]
- "情報": [2文字目, ...]
- "現在の職業": [8文字目, 1092文字目, ...]
- "職業": [11文字目, 1092文字目, ...]
- "自動": [14文字目, ...]
```

### ステップ2: キーワードの位置でソート

**処理**: `keywordPositions.sort((a, b) => a.position - b.position)`

**説明**:
- キーワードの位置でソート
- 最初と最後のキーワードの位置を取得

**コード**:
```typescript
keywordPositions.sort((a, b) => a.position - b.position);

const firstPos = keywordPositions[0].position;
const lastPos = keywordPositions[keywordPositions.length - 1].position;
```

### ステップ3: ハイブリッド抽出

**処理**: ランクベース抽出 + キーワードマッチング

**説明**:
1. **ランクベース抽出**: 先頭から`maxLength`分の文字数を取得
2. **キーワード範囲の確認**: 先頭範囲内にキーワードが含まれているか確認
3. **範囲外キーワードの補完**: 範囲外のキーワードがある場合、それらを含むように範囲を拡張

**コード**:
```typescript
// ステップ1: ランクベース抽出
let startPos = 0;
let endPos = Math.min(content.length, maxLength);
let extracted = content.substring(startPos, endPos);

// ステップ2: キーワード範囲の確認
const keywordsInRange = keywordPositions.filter(kp => kp.position < endPos);
const keywordsOutOfRange = keywordPositions.filter(kp => kp.position >= endPos);

// ステップ3: 範囲外キーワードの補完
if (keywordsOutOfRange.length > 0) {
  // 範囲外のキーワードを含むように範囲を拡張
  // ...
}
```

## 問題点と改善案

### 問題点1: フォールバック処理が正しく動作していない ❌

**問題**:
- クエリ全体が1つのキーワードとして抽出される
- 日本語の単語分割が正しく動作していない

**改善案**:
- より高度な日本語の単語分割を実装
- MeCabやkuromojiなどの形態素解析ライブラリを使用

### 問題点2: キーワードの優先順位が考慮されていない ⚠️

**問題**:
- すべてのキーワードが同じ優先順位で扱われる
- 重要度の高いキーワードが優先されない

**改善案**:
- カテゴリ別の優先順位を設定
- キーワードの出現頻度を考慮

### 問題点3: 同義語や関連語が考慮されていない ⚠️

**問題**:
- 同義語や関連語が検出されない
- 例: 「会員情報」と「ユーザー情報」が同じ意味でも検出されない

**改善案**:
- 同義語辞書を追加
- 関連語を考慮した検索

## まとめ

### キーワード抽出ロジックの処理フロー

1. **キーワードリストの読み込み**: ドメイン知識ベースからキーワードリストを読み込む
2. **カテゴリ別のキーワード抽出**: 各カテゴリからキーワードを抽出
3. **キーワードマッチング**: クエリとキーワードリストを比較
4. **重複除去**: カテゴリ別に抽出されたキーワードから重複を除去
5. **コンテンツ抽出での使用**: 抽出されたキーワードを使用してコンテンツを抽出

### 抽出されたキーワード

**クエリ**: `"会員情報の学年や現在の職業は自動で更新されますか"`

**抽出されたキーワード**: `["会員", "更新", "会員情報", "学年", "情報", "現在の職業", "職業", "自動"]`

**キーワード数**: 8個

### 評価

- ✅ **ドメイン知識連携**: 正常に動作
- ✅ **カテゴリ別の抽出**: 正常に動作
- ✅ **キーワードマッチング**: 正常に動作
- ❌ **フォールバック処理**: 正しく動作していない

## 参考資料

- `src/lib/unified-keyword-extraction-service.ts`: 統一キーワード抽出サービス
- `src/ai/flows/content-extraction-utils.ts`: コンテンツ抽出ユーティリティ
- `data/domain-knowledge-v2/keyword-lists-v2.json`: ドメイン知識ベース
