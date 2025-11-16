# RAGにおけるコンテンツ抽出：ベストプラクティス

## 概要

RAG（Retrieval-Augmented Generation）システムで、LLMに渡すコンテンツを抽出する際の一般的なアプローチと、現在の実装との比較をまとめます。

## 一般的なRAGの検索手法

### 1. キーワード検索 ✅ 標準的

**説明**:
- クエリ内のキーワードと一致する文書を検索
- BM25、TF-IDFなどのアルゴリズムを使用

**メリット**:
- 特定のキーワードを正確に検索できる
- ドメイン知識を活用した専門用語の検索に有効

**デメリット**:
- 同義語や関連語を検出しにくい
- 文脈を理解しない

### 2. ベクトル検索 ✅ 標準的

**説明**:
- クエリと文書をベクトル化し、類似度に基づいて検索
- セマンティック検索としても知られる

**メリット**:
- 同義語や関連語を検出できる
- 文脈を理解した検索が可能

**デメリット**:
- 専門用語の検索精度が低い場合がある
- ベクトル化の品質に依存

### 3. ハイブリッド検索 ✅ 標準的・推奨

**説明**:
- キーワード検索とベクトル検索を組み合わせる
- RRF (Reciprocal Rank Fusion) などの手法で統合

**メリット**:
- キーワード検索とベクトル検索の両方のメリットを活用
- 検索精度の向上

**デメリット**:
- 実装が複雑
- パフォーマンスへの影響

### 4. セマンティック検索 ✅ 標準的

**説明**:
- クエリの意味や意図を理解し、それに基づいて関連する文書を検索
- ベクトル検索の一種

**メリット**:
- より関連性の高い情報を取得できる
- 自然言語の理解が向上

**デメリット**:
- 計算コストが高い
- 専門用語の理解が不十分な場合がある

## コンテンツ抽出の一般的なアプローチ

### 1. 固定サイズチャンキング ✅ 基本的

**説明**:
- 文書を固定サイズ（例: 512文字、1024文字）で分割
- シンプルで実装が容易

**メリット**:
- 実装が簡単
- パフォーマンスが良い

**デメリット**:
- 文の境界を考慮しない
- 重要な情報が分割される可能性

**例**:
```typescript
// 固定サイズで分割
const chunkSize = 512;
for (let i = 0; i < text.length; i += chunkSize) {
  const chunk = text.substring(i, i + chunkSize);
  chunks.push(chunk);
}
```

### 2. セマンティックチャンキング ✅ 標準的・推奨

**説明**:
- 意味的な単位（文、段落など）で分割
- 文の境界を考慮

**メリット**:
- 重要な情報が分割されにくい
- 意味的な単位で分割される

**デメリット**:
- 実装が複雑
- パフォーマンスへの影響

**例**:
```typescript
// 文の境界で分割
const sentences = text.split(/[。！？]/);
let currentChunk = '';
for (const sentence of sentences) {
  if ((currentChunk + sentence).length > chunkSize) {
    chunks.push(currentChunk);
    currentChunk = sentence;
  } else {
    currentChunk += sentence;
  }
}
```

### 3. 階層的チャンキング ✅ 高度

**説明**:
- 見出し、段落、セクションなどの階層構造を考慮して分割
- ドキュメントの構造を保持

**メリット**:
- ドキュメントの構造が保持される
- 関連する情報がまとまる

**デメリット**:
- 実装が非常に複雑
- ドキュメントの構造に依存

**例**:
```typescript
// 見出しを基準に分割
const sections = text.split(/^#{1,6}\s/m);
for (const section of sections) {
  // セクションをさらに分割
  const chunks = splitSection(section);
  allChunks.push(...chunks);
}
```

### 4. キーワードマッチングによる抽出 ✅ 標準的

**説明**:
- クエリのキーワードに基づいて、関連する部分を抽出
- ドメイン知識を活用したキーワード抽出

**メリット**:
- クエリに関連する部分を優先的に抽出
- ドメイン知識を活用した専門用語の検出

**デメリット**:
- キーワード抽出の品質に依存
- 文脈を考慮しない場合がある

**例**:
```typescript
// キーワードに基づいて抽出
const keywords = extractKeywords(query);
const keywordPositions = findKeywordPositions(content, keywords);
const extractedContent = extractAroundKeywords(content, keywordPositions, maxLength);
```

### 5. ランクベース抽出 ✅ 標準的

**説明**:
- 検索結果のランクに基づいて、上位のドキュメントから抽出
- ランクが高いほど多くの文字数を割り当て

**メリット**:
- 関連性の高い情報を優先的に抽出
- シンプルで実装が容易

**デメリット**:
- ランクが低いドキュメントの重要な情報が失われる可能性

**例**:
```typescript
// ランクに基づいて文字数を決定
const maxLength = rank === 0 ? 1500 : rank === 1 ? 1000 : rank === 2 ? 800 : 600;
const extractedContent = content.substring(0, maxLength);
```

### 6. ハイブリッド抽出 ✅ 標準的・推奨

**説明**:
- 複数のアプローチを組み合わせる
- ランクベース抽出 + キーワードマッチング

**メリット**:
- 複数のアプローチのメリットを活用
- 検索精度の向上

**デメリット**:
- 実装が複雑
- パフォーマンスへの影響

**例**:
```typescript
// ランクベース抽出 + キーワードマッチング
const maxLength = getMaxLengthByRank(rank);
let extractedContent = content.substring(0, maxLength);

// キーワードマッチングで補完
const keywords = extractKeywords(query);
const outOfRangeKeywords = findOutOfRangeKeywords(content, keywords, maxLength);
if (outOfRangeKeywords.length > 0) {
  extractedContent = expandToIncludeKeywords(extractedContent, outOfRangeKeywords, maxLength);
}
```

## 現在の実装との比較

### 現在の実装 ✅ 標準的

**アプローチ**:
1. **ハイブリッド検索**: ベクトル検索 + BM25検索 + タイトル検索
2. **ハイブリッド抽出**: ランクベース抽出 + キーワードマッチング
3. **ドメイン知識連携**: ドメイン知識ベースからキーワードを抽出

**実装**:
```typescript
// 1. ドメイン知識連携のキーワード抽出
const keywords = unifiedKeywordExtractionService.extractKeywordsSync(query);

// 2. ランクベース抽出
let startPos = 0;
let endPos = Math.min(content.length, maxLength);
let extracted = content.substring(startPos, endPos);

// 3. キーワードマッチングで補完
const keywordsInRange = keywordPositions.filter(kp => kp.position < endPos);
const keywordsOutOfRange = keywordPositions.filter(kp => kp.position >= endPos);
if (keywordsOutOfRange.length > 0) {
  // 範囲外のキーワードを含めるように範囲を拡張
  extracted = expandToIncludeKeywords(extracted, keywordsOutOfRange, maxLength);
}
```

**評価**:
- ✅ ハイブリッド検索: 標準的・推奨
- ✅ ハイブリッド抽出: 標準的・推奨
- ✅ ドメイン知識連携: 標準的・推奨
- ✅ ランクベース抽出: 標準的
- ✅ キーワードマッチング: 標準的

### 標準的なRAG実装との比較

| 項目 | 標準的なRAG実装 | 現在の実装 | 評価 |
|------|----------------|-----------|------|
| 検索手法 | ハイブリッド検索 | ハイブリッド検索 | ✅ 標準的 |
| コンテンツ抽出 | ランクベース + キーワードマッチング | ランクベース + キーワードマッチング | ✅ 標準的 |
| ドメイン知識 | オプション | 必須（ドメイン知識ベース） | ✅ 標準的・推奨 |
| チャンキング | セマンティックチャンキング | 固定サイズチャンキング | ⚠️ 改善の余地 |
| 表の処理 | 構造を保持 | 構造が失われる | ❌ 改善が必要 |

## 一般的なRAG実装でのコンテンツ抽出パターン

### パターン1: シンプルなランクベース抽出 ✅ 基本的

**説明**:
- 検索結果の上位N件から、固定サイズで抽出
- シンプルで実装が容易

**例**:
```typescript
const topResults = searchResults.slice(0, 5);
const context = topResults.map(result => result.content.substring(0, 500)).join('\n\n');
```

**使用ケース**:
- シンプルなRAGシステム
- プロトタイプ
- パフォーマンスが重要な場合

### パターン2: キーワードマッチング抽出 ✅ 標準的

**説明**:
- クエリのキーワードに基づいて、関連する部分を抽出
- ドメイン知識を活用

**例**:
```typescript
const keywords = extractKeywords(query);
const extractedContent = extractRelevantContent(content, keywords, maxLength);
```

**使用ケース**:
- ドメイン特化型RAGシステム
- 専門用語が多い場合
- キーワード検索が重要な場合

### パターン3: ハイブリッド抽出 ✅ 標準的・推奨

**説明**:
- ランクベース抽出 + キーワードマッチング
- 複数のアプローチを組み合わせる

**例**:
```typescript
// ランクベース抽出
let extracted = content.substring(0, maxLength);

// キーワードマッチングで補完
const keywords = extractKeywords(query);
if (hasOutOfRangeKeywords(content, keywords, maxLength)) {
  extracted = expandToIncludeKeywords(extracted, keywords, maxLength);
}
```

**使用ケース**:
- 本番環境のRAGシステム
- 検索精度が重要な場合
- 複雑なクエリに対応する場合

### パターン4: セマンティックチャンキング ✅ 高度

**説明**:
- 意味的な単位（文、段落など）で分割
- 文の境界を考慮

**例**:
```typescript
const sentences = splitIntoSentences(content);
const relevantSentences = findRelevantSentences(sentences, keywords);
const extractedContent = relevantSentences.join(' ');
```

**使用ケース**:
- 高度なRAGシステム
- 文脈が重要な場合
- 長文ドキュメントの場合

## 現在の実装の評価

### 強み ✅

1. **ハイブリッド検索**: ベクトル検索 + BM25検索 + タイトル検索
2. **ハイブリッド抽出**: ランクベース抽出 + キーワードマッチング
3. **ドメイン知識連携**: ドメイン知識ベースからキーワードを抽出
4. **動的優先度付け**: ランクに基づいて文字数を動的に決定

### 改善の余地 ⚠️

1. **チャンキング**: 固定サイズチャンキングからセマンティックチャンキングへ
2. **表の処理**: 表の構造を保持する処理を追加
3. **文の境界**: 文の境界を考慮した抽出

### 改善が必要 ❌

1. **表の構造**: 表の構造が失われる問題
2. **キーワード抽出**: より高度なキーワード抽出（同義語、関連語）

## まとめ

### 一般的なRAG実装でのコンテンツ抽出

1. **ハイブリッド検索**: キーワード検索 + ベクトル検索 ✅ 標準的
2. **ハイブリッド抽出**: ランクベース抽出 + キーワードマッチング ✅ 標準的
3. **ドメイン知識連携**: ドメイン知識ベースからキーワードを抽出 ✅ 標準的・推奨
4. **セマンティックチャンキング**: 意味的な単位で分割 ✅ 標準的・推奨

### 現在の実装の評価

- ✅ **標準的**: ハイブリッド検索、ハイブリッド抽出、ドメイン知識連携
- ✅ **推奨**: ドメイン知識連携によるキーワード抽出
- ⚠️ **改善の余地**: セマンティックチャンキング、文の境界を考慮
- ❌ **改善が必要**: 表の構造を保持する処理

### 結論

現在の実装（ドメイン知識 + キーワード検索によるコンテンツ抽出）は、**一般的なRAG実装の標準的なアプローチ**です。

特に、以下の点で標準的・推奨される実装です：
1. **ハイブリッド検索**: ベクトル検索 + BM25検索
2. **ハイブリッド抽出**: ランクベース抽出 + キーワードマッチング
3. **ドメイン知識連携**: ドメイン知識ベースからキーワードを抽出

改善の余地がある点：
1. **セマンティックチャンキング**: 文の境界を考慮した抽出
2. **表の処理**: 表の構造を保持する処理

## 参考資料

- [Microsoft Azure AI: RAG Solution Design](https://learn.microsoft.com/ja-jp/azure/ai-services/content-understanding/tutorial/build-rag-solution)
- [IBM: Retrieval-Augmented Generation](https://www.ibm.com/jp-ja/think/topics/retrieval-augmented-generation)
- [Elastic: RAG Guide](https://www.elastic.co/jp/what-is/retrieval-augmented-generation)
- [Microsoft Azure: RAG Information Retrieval](https://learn.microsoft.com/ja-jp/azure/architecture/ai-ml/guide/rag/rag-information-retrieval)

