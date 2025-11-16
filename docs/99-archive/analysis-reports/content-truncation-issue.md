# コンテンツ切り詰め問題の分析

**作成日**: 2025年11月4日  
**問題**: 「164_【FIX】教室削除機能」の詳細情報がAI回答に表示されない

## 🔍 問題の原因

### 1. コンテンツ切り詰めの制限

`src/ai/flows/summarize-confluence-docs.ts` の277行目で、各ドキュメントの内容を**800文字に制限**しています：

```typescript
const truncatedContent = doc.content && doc.content.length > 800 
  ? doc.content.substring(0, 800) + '...' 
  : doc.content || '内容なし';
```

### 2. 影響

- 「164_【FIX】教室削除機能」の詳細情報（求人の掲載状態に関する条件、応募情報・採用ステータスに関する条件など）が800文字を超える場合、切り詰められてAI回答に含まれない
- 特に長いドキュメントの場合、重要な情報が後半に含まれている可能性が高い

### 3. ストリーミング版の制限

`src/ai/flows/streaming-summarize-confluence-docs.ts` では**530文字に制限**されています：

```typescript
const truncatedContent = doc.content && doc.content.length > 530 
  ? doc.content.substring(0, 530) + '...' 
  : doc.content || '内容なし';
```

---

## 💡 解決策

### 1. ランキングに基づく動的な文字数制限（推奨）

上位のドキュメントにはより多くの文字数を割り当てる：

```typescript
const contextText = documents
  .slice(0, 10)
  .map((doc, index) => {
    // ランキングに基づく動的な文字数制限
    // 1位: 2000文字、2位: 1500文字、3位: 1200文字、4位以降: 800文字
    const maxLength = index === 0 ? 2000 : index === 1 ? 1500 : index === 2 ? 1200 : 800;
    const truncatedContent = doc.content && doc.content.length > maxLength 
      ? doc.content.substring(0, maxLength) + '...' 
      : doc.content || '内容なし';
    
    return `## ドキュメント: ${doc.title}
**URL**: ${doc.url}
**スペース**: ${doc.spaceName || 'Unknown'}
**最終更新**: ${doc.lastUpdated || 'Unknown'}
**ラベル**: ${(doc.labels || []).join(', ')}
**関連度スコア**: ${(doc as any).scoreText || 'N/A'}

### 内容
${truncatedContent}`;
  })
  .join('\n\n---\n\n');
```

### 2. 重要度に基づく優先度付け

1位のドキュメントには十分な文字数を確保：

```typescript
const contextText = documents
  .slice(0, 10)
  .map((doc, index) => {
    // 1位のドキュメントは全内容を含める（または大幅に拡張）
    const maxLength = index === 0 ? 3000 : 800;
    const truncatedContent = doc.content && doc.content.length > maxLength 
      ? doc.content.substring(0, maxLength) + '...' 
      : doc.content || '内容なし';
    
    // ... 以下同じ
  })
  .join('\n\n---\n\n');
```

### 3. コンテンツの重要部分を優先的に含める

特定のキーワードを含む部分を優先的に含める：

```typescript
const contextText = documents
  .slice(0, 10)
  .map((doc, index) => {
    const maxLength = index === 0 ? 2000 : 800;
    
    // 重要キーワードを含む部分を優先的に含める
    const importantKeywords = ['条件', '削除', '応募情報', '採用ステータス', '掲載状態'];
    const hasImportantContent = importantKeywords.some(kw => doc.content?.includes(kw));
    
    // 重要キーワードがある場合は、より多くの文字数を確保
    const actualMaxLength = hasImportantContent && index === 0 ? 3000 : maxLength;
    
    const truncatedContent = doc.content && doc.content.length > actualMaxLength 
      ? doc.content.substring(0, actualMaxLength) + '...' 
      : doc.content || '内容なし';
    
    // ... 以下同じ
  })
  .join('\n\n---\n\n');
```

---

## 📝 実装計画

### 優先度：高

1. **ランキングに基づく動的な文字数制限を実装**
   - 1位: 2000文字
   - 2位: 1500文字
   - 3位: 1200文字
   - 4位以降: 800文字

2. **ストリーミング版も同様に修正**
   - 1位: 1500文字
   - 2位: 1000文字
   - 3位: 800文字
   - 4位以降: 530文字

### テスト

1. 「教室削除ができないのは何が原因ですか」クエリでテスト
2. 「164_【FIX】教室削除機能」の詳細情報が含まれているか確認
3. 求人の掲載状態に関する条件、応募情報・採用ステータスに関する条件が表示されるか確認

---

## 📊 まとめ

- **問題**: 各ドキュメントの内容が800文字に制限されている
- **影響**: 詳細情報が切り詰められてAI回答に含まれない
- **解決策**: ランキングに基づく動的な文字数制限を実装

