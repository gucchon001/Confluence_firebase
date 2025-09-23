# 教室管理検索のキーワード抽出戦略

## 現状分析

### 現在のキーワード抽出結果
- **入力クエリ:** `教室管理の詳細は`
- **抽出キーワード:** `["教室管理の"]` のみ
- **問題点:**
  - キーワードが過度に短縮されている
  - 分割ロジックが機能していない
  - LLM拡張が動作していない

### 理想のページタイトル分析

#### 主要な教室管理機能ページ（優先度：高）
- `160_【FIX】教室管理機能` → キーワード: `["教室", "管理", "機能"]`
- `161_【FIX】教室一覧閲覧機能` → キーワード: `["教室", "一覧", "閲覧", "機能"]`
- `162_【FIX】教室新規登録機能` → キーワード: `["教室", "新規", "登録", "機能"]`
- `163_【FIX】教室情報編集機能` → キーワード: `["教室", "情報", "編集", "機能"]`
- `168_【FIX】教室コピー機能` → キーワード: `["教室", "コピー", "機能"]`

#### 関連する求人管理ページ（優先度：中）
- `511_【FIX】教室管理-求人一覧閲覧機能` → キーワード: `["教室", "管理", "求人", "一覧", "閲覧", "機能"]`
- `512_【FIX】教室管理-求人情報新規登録機能` → キーワード: `["教室", "管理", "求人", "情報", "新規", "登録", "機能"]`

## キーワード抽出戦略

### 1. 基本キーワード抽出の改善

#### 1.1 分割ロジックの強化
```typescript
// 現在の問題: 「教室管理の詳細は」→「教室管理の」
// 改善案: 「教室管理の詳細は」→「教室管理」「詳細」「仕様」

const splitPatterns = [
  /[の・・、]/g,  // 現在のパターン
  /(詳細|仕様|機能|管理|情報|一覧|閲覧|登録|編集|削除|コピー)/g,  // 機能語での分割
  /(教室|求人|企業|ユーザー)/g  // エンティティ語での分割
];
```

#### 1.2 ストップワードの調整
```typescript
// 現在のSTOPWORDSから除外すべき語
const REMOVE_FROM_STOPWORDS = [
  '詳細', '仕様', '機能', '情報', '方法'  // 教室管理では重要な語
];

// 追加すべきSTOPWORDS
const ADD_TO_STOPWORDS = [
  'は', 'が', 'を', 'に', 'で', 'と', 'や', 'から', 'まで'  // 助詞のみ
];
```

### 2. クエリ特化のキーワード抽出

#### 2.1 「教室管理」クエリの特化処理
```typescript
if (query.includes('教室管理')) {
  // 教室管理に関連するキーワードを優先抽出
  const classroomKeywords = [
    '教室', '管理', '機能', '一覧', '閲覧', '登録', '編集', '削除', 'コピー',
    '求人', '情報', '新規', '更新', '設定', '切り替え', 'フラグ'
  ];
  
  // これらのキーワードを含む語を優先的に抽出
  const relevantKeywords = extractRelevantKeywords(query, classroomKeywords);
}
```

#### 2.2 「詳細」「仕様」クエリの特化処理
```typescript
if (query.includes('詳細') || query.includes('仕様')) {
  // 詳細・仕様に関連するキーワードを追加
  const specKeywords = [
    '詳細', '仕様', '要件', '機能', '設定', '手順', '方法', 'プロセス'
  ];
  
  // これらのキーワードを保持
  const specRelevantKeywords = extractRelevantKeywords(query, specKeywords);
}
```

### 3. LLM拡張の改善

#### 3.1 汎用的なLLMプロンプトの改善
```typescript
const genericPrompt = `
あなたは社内ドキュメント検索のためのキーワード抽出を行います。
以下のクエリから、検索に有効なキーワードを抽出してください。

抽出方針：
1. 名詞・動詞・形容詞などの実質的な語を抽出
2. 機能名・システム名・プロセス名を重視
3. 一般語（詳細、仕様、機能、情報など）は除外
4. 同義語・関連語・略語も含める
5. 日本語・英語の双方を含めても構いません

クエリ: ${query}
`;
```

#### 3.2 動的キーワード優先度の設定
```typescript
function calculateKeywordPriority(keywords: string[], query: string): Map<string, number> {
  const priority = new Map<string, number>();
  
  for (const keyword of keywords) {
    let score = 1; // 基本スコア
    
    // クエリに直接含まれるキーワードは高優先度
    if (query.includes(keyword)) {
      score += 10;
    }
    
    // 長いキーワードは高優先度
    score += keyword.length * 0.5;
    
    // 機能語は高優先度
    const functionWords = ['機能', '管理', '一覧', '閲覧', '登録', '編集', '削除', '設定', '更新'];
    if (functionWords.some(fw => keyword.includes(fw))) {
      score += 5;
    }
    
    // 一般語は低優先度
    const genericWords = ['詳細', '仕様', '情報', '方法', '手順', '要件'];
    if (genericWords.some(gw => keyword.includes(gw))) {
      score -= 3;
    }
    
    priority.set(keyword, score);
  }
  
  return priority;
}
```

### 4. キーワードマッチングの改善

#### 4.1 部分マッチングの強化
```typescript
// 現在: 完全一致のみ
// 改善: 部分一致も考慮

function calculateKeywordScore(keywords: string[], title: string, content: string): number {
  let score = 0;
  
  for (const keyword of keywords) {
    // 完全一致（高スコア）
    if (title.includes(keyword) || content.includes(keyword)) {
      score += 10;
    }
    
    // 部分一致（中スコア）
    const partialMatches = findPartialMatches(keyword, title + ' ' + content);
    score += partialMatches * 5;
    
    // 同義語マッチング（低スコア）
    const synonymMatches = findSynonymMatches(keyword, title + ' ' + content);
    score += synonymMatches * 2;
  }
  
  return score;
}
```

#### 4.2 タイトルマッチングの重み付け
```typescript
const titleMatchWeights = {
  exact: 20,      // 完全一致
  partial: 10,    // 部分一致
  keyword: 5,     // キーワード一致
  synonym: 2      // 同義語一致
};
```

## 実装計画

### Phase 1: 基本キーワード抽出の改善
1. 分割ロジックの強化
2. ストップワードの調整
3. クエリ特化処理の追加

### Phase 2: LLM拡張の改善
1. 教室管理特化プロンプトの実装
2. キーワード優先度の設定
3. 同義語辞書の構築

### Phase 3: マッチングロジックの改善
1. 部分マッチングの実装
2. タイトルマッチングの重み付け
3. スコア計算の最適化

## 期待される結果

### 改善後のキーワード抽出
- **入力クエリ:** `教室管理の詳細は`
- **期待される抽出キーワード:** `["教室", "管理", "詳細", "仕様", "機能", "一覧", "閲覧", "登録", "編集"]`

### 期待される検索結果
1. `160_【FIX】教室管理機能` (スコア: 85+)
2. `161_【FIX】教室一覧閲覧機能` (スコア: 80+)
3. `162_【FIX】教室新規登録機能` (スコア: 80+)
4. `163_【FIX】教室情報編集機能` (スコア: 80+)
5. `168_【FIX】教室コピー機能` (スコア: 75+)

## 品質メトリクス

### 目標値
- **Precision:** 0.8以上
- **Recall:** 0.7以上
- **F1スコア:** 0.75以上
- **平均スコア:** 60以上
