# 参照元リンク変換処理の分析レポート

**作成日**: 2025年1月  
**対象**: 参照元リンク変換処理（`convertReferencesToNumberedLinks`）

---

## 問題の概要

本文内に参照元のページ参照がある場合、数値にしてハイパーリンクにする処理が、できているところとできていないところがあります。

### 実際の例

**質問**: 「ログイン認証の仕組みはどうなっていますか？」

**回答内の参照元言及**:
- ✅ 「全体管理者登録情報（【FIX】全体管理者登録情報）」→ リンクに変換されない
- ✅ 「クライアント企業管理者情報（【FIX】クライアント企業管理者）」→ リンクに変換されない
- ✅ 「パスワード再設定機能（【FIX】パスワード再設定機能）」→ リンクに変換されない
- ✅ 「パスワード再設定機能（453_【FIX】パスワード再設定機能）」→ リンクに変換されない
- ✅ 「パスワード再設定機能（682_【FIX】パスワード再設定機能）」→ リンクに変換されない

**実際の参照元リスト**:
1. "451_【FIX】全体管理者ログイン・ログアウト機能"
2. "042_【FIX】会員ログイン・ログアウト機能"

---

## 現在の仕様

### 処理フロー

1. **AI回答生成** (`streaming-summarize-confluence-docs.ts`)
   - LLMが回答を生成
   - 回答内に`（...）`形式でページタイトルを言及

2. **使用された参照元の抽出** (`extractUsedReferenceIndices`)
   - 回答テキスト内の`（([^）]+)）`パターンを検出
   - 参照元リストとマッチングして、使用された参照元のインデックスを抽出

3. **参照元のフィルタリング** (`filterUsedReferences`)
   - 使用された参照元のみをフィルタリング
   - `finalReferences`として返される

4. **リンク変換** (`convertReferencesToNumberedLinks`)
   - `formatMessageContent`内で実行
   - `finalReferences`（使用された参照元のみ）に対してリンク変換を実行

### マッチングロジック

`convertReferencesToNumberedLinks`関数（`src/lib/markdown-utils.tsx`）のマッチング順序：

1. **完全一致**
   ```typescript
   if (refTitle === contentTrimmed) {
     return true;
   }
   ```

2. **番号部分を除いた比較**
   ```typescript
   const refWithoutNumber = refTitle.replace(/^\d+_/, '').trim();
   const contentWithoutNumber = contentTrimmed.replace(/^\d+_/, '').trim();
   if (refWithoutNumber === contentWithoutNumber) {
     return true;
   }
   ```

3. **番号除去後の包含関係**
   ```typescript
   if (refWithoutNumber.length > contentWithoutNumber.length) {
     if (refWithoutNumber.includes(contentWithoutNumber)) {
       return true;
     }
   }
   ```

4. **部分一致**
   ```typescript
   if (refTitle.length >= contentTrimmed.length && refTitle.includes(contentTrimmed)) {
     return true;
   }
   ```

---

## 問題の原因

### 原因1: 参照元リストに存在しないタイトルへの言及

AIが生成した回答に、参照元リストに含まれていないページタイトルへの言及が含まれています。

**例**:
- 回答内: 「全体管理者登録情報（【FIX】全体管理者登録情報）」
- 参照元リスト: "451_【FIX】全体管理者ログイン・ログアウト機能"
- 「【FIX】全体管理者登録情報」は参照元リストに存在しないため、マッチングできない

### 原因2: 使用された参照元のみがフィルタリングされている

`formatMessageContent`に渡される`references`は、使用された参照元のみがフィルタリングされています。

**コード** (`src/ai/flows/streaming-summarize-confluence-docs.ts:497-503`):
```typescript
const usedIndices = extractUsedReferenceIndices(answer, allReferences);
const finalReferences = usedIndices.size > 0
  ? Array.from(usedIndices).map(index => allReferences[index]).filter(Boolean)
  : allReferences;
```

**問題点**:
- `extractUsedReferenceIndices`がマッチングできない場合、`usedIndices`が空になる
- その結果、`finalReferences`は`allReferences`（全ての参照元）になる
- しかし、`formatMessageContent`に渡される時点で、既にフィルタリングされた参照元のみが渡される可能性がある

### 原因3: マッチングロジックの限界

現在のマッチングロジックは、以下のケースでマッチングできません：

1. **タイトルが完全に異なる場合**
   - 「【FIX】全体管理者登録情報」vs「451_【FIX】全体管理者ログイン・ログアウト機能」
   - 部分一致でもマッチングできない（「登録情報」と「ログイン・ログアウト機能」は異なる）

2. **番号が異なる場合**
   - 「453_【FIX】パスワード再設定機能」vs「682_【FIX】パスワード再設定機能」
   - 番号除去後の完全一致ではマッチングできるが、参照元リストに存在しない場合はマッチングできない

---

## 解決策の提案

### 解決策1: 参照元リスト全体を`formatMessageContent`に渡す

`formatMessageContent`に渡す`references`を、使用された参照元のみではなく、元の参照元リスト全体に変更します。

**メリット**:
- より多くの参照元タイトルとマッチングできる可能性が高まる
- 実装が簡単

**デメリット**:
- 使用されていない参照元もリンクに変換される可能性がある

### 解決策2: マッチングロジックの改善

より柔軟なマッチングロジックを実装します。

**改善案**:
1. **キーワードベースのマッチング**
   - 「全体管理者登録情報」と「全体管理者ログイン・ログアウト機能」を、キーワード「全体管理者」でマッチング

2. **類似度ベースのマッチング**
   - 文字列の類似度（Levenshtein距離など）を使用してマッチング

3. **部分文字列の優先度を上げる**
   - 現在の部分一致ロジックを改善し、より多くのケースでマッチングできるようにする

### 解決策3: AIプロンプトの改善

AIが生成する回答で、参照元リストに含まれているタイトルのみを言及するようにプロンプトを改善します。

**改善案**:
- プロンプトに「参照元リストに含まれているタイトルのみを言及してください」という指示を追加
- 参照元リストをプロンプトに含める

---

## 実装した解決策

**解決策1と解決策2の組み合わせ**を実装しました。

### 1. 参照元リスト全体を`formatMessageContent`に渡す

**変更内容**:
- `StreamingMessage`インターフェースに`allReferences`フィールドを追加
- `streaming-process-client.ts`で`allReferences`を受け取り、`onCompletion`コールバックに渡す
- `chat-page.tsx`で`allReferences`を保存し、`formatMessageContent`に渡す
- `Message`型に`_allReferences`フィールドを追加（非表示フィールド）

**実装ファイル**:
- `src/lib/streaming-process-client.ts`
- `src/components/chat-page.tsx`
- `src/types.ts`

### 2. マッチングロジックの改善（キーワードベースのマッチング）

**変更内容**:
- `convertReferencesToNumberedLinks`関数にキーワードベースのマッチングを追加
- `extractUsedReferenceIndices`関数にも同じロジックを適用
- 日本語のキーワード（2文字以上）を抽出し、共通キーワードでマッチング
- 長いキーワード（3文字以上）が1つ以上、または共通キーワードが2つ以上ある場合にマッチ

**実装ファイル**:
- `src/lib/markdown-utils.tsx`

---

## 実装の詳細

### 現在のコード

**`src/lib/markdown-utils.tsx:196-263`**:
```typescript
export function convertReferencesToNumberedLinks(markdown: string, references: Array<{title: string, url?: string}>): string {
  // ...
  const referencePattern = /（([^）]+)）/g;
  
  return markdown.replace(referencePattern, (match, content) => {
    const matchedIndex = references.findIndex(ref => {
      // マッチングロジック
    });
    
    if (matchedIndex >= 0) {
      return `[${referenceNumber}](${referenceUrl})`;
    }
    
    return match; // マッチしない場合は元のテキストを返す
  });
}
```

**`src/ai/flows/streaming-summarize-confluence-docs.ts:497-503`**:
```typescript
const usedIndices = extractUsedReferenceIndices(answer, allReferences);
const finalReferences = usedIndices.size > 0
  ? Array.from(usedIndices).map(index => allReferences[index]).filter(Boolean)
  : allReferences;
```

**`src/components/chat-page.tsx:220-230`**:
```typescript
<ReactMarkdown 
  remarkPlugins={[remarkGfm]}
  components={createSharedMarkdownComponents(msg.sources || []) as any}
>
  {formatMessageContent(msg.content, msg.sources || [], isAssistant)}
</ReactMarkdown>
```

### 修正が必要な箇所

1. **`src/components/chat-page.tsx`**: `formatMessageContent`に渡す`references`を、使用された参照元のみではなく、元の参照元リスト全体に変更
2. **`src/lib/markdown-utils.tsx`**: マッチングロジックの改善（キーワードベースのマッチング）

---

## テストケース

以下のテストケースで動作確認が必要です：

1. **完全一致**: 「（451_【FIX】全体管理者ログイン・ログアウト機能）」→ `[1]`
2. **番号除去後の完全一致**: 「（【FIX】全体管理者ログイン・ログアウト機能）」→ `[1]`
3. **部分一致**: 「（全体管理者ログイン・ログアウト機能）」→ `[1]`
4. **キーワードベース**: 「（全体管理者登録情報）」→ `[1]`（「全体管理者」でマッチング）
5. **マッチング失敗**: 「（存在しないタイトル）」→ 元のテキストを返す

---

## まとめ

参照元リンク変換処理の問題は、以下の原因によるものです：

1. AIが生成した回答に、参照元リストに含まれていないページタイトルへの言及が含まれている
2. 使用された参照元のみがフィルタリングされているため、マッチングできる参照元が限られている
3. マッチングロジックが、完全に異なるタイトルをマッチングできない

解決策として、参照元リスト全体を`formatMessageContent`に渡し、マッチングロジックを改善することを推奨します。

