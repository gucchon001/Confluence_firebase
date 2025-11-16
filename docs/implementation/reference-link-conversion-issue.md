# 参照元リンク変換の問題調査レポート

## 問題の概要

本文中の参照元が数字にしてリンク変換できていないケースがある。

## 調査結果

### 1. 重複コードの確認

`convertReferencesToNumberedLinks`は以下の2箇所で呼び出されている：

1. **61行目**: `MessageCard`コンポーネント内（通常のメッセージ表示）
   - 使用データ: `msg.sources || []`
   - 条件: `isAssistant ? convertReferencesToNumberedLinks(...) : msg.content`

2. **820行目**: ストリーミング中のメッセージ表示
   - 使用データ: `streamingReferences || []`
   - 条件: ストリーミング中のメッセージ表示時

### 2. 参照元データの流れ

```
streamingSummarizeConfluenceDocsBackend()
  ↓
references: Array<{title: string, url?: string}>
  ↓
314行目: 完了コールバック
  ├─ 320行目: setStreamingReferences(references)
  └─ 332行目: sources: references.map(...)
       ↓
      msg.sources (Message型)
```

### 3. 問題の可能性

#### 3.1. データ構造の違い

- `streamingReferences`: 元の`references`構造を保持
- `msg.sources`: `references.map((ref: any) => ({...}))`で変換された構造

```typescript
// streamingReferences (元の構造)
references: Array<{
  id: string;
  title: string;
  url: string;
  distance?: number;
  score?: number;
  source?: string;
}>

// msg.sources (変換後の構造)
sources: Array<{
  title: string;
  url: string;
  distance: number;
  source?: string;
}>
```

#### 3.2. マッチングロジックの問題

`convertReferencesToNumberedLinks`のマッチング条件：

```typescript
const matchedIndex = references.findIndex(ref => {
  const refTitle = ref.title || '';
  return refTitle === content || 
         refTitle.includes(content) || 
         content.includes(refTitle) ||
         refTitle.replace(/^\d+_/, '') === content.replace(/^\d+_/, '') ||
         refTitle.replace(/^\d+_/, '').includes(content.replace(/^\d+_/, '')) ||
         content.replace(/^\d+_/, '').includes(refTitle.replace(/^\d+_/, ''));
});
```

**問題点**:
- `refTitle.includes(content)` と `content.includes(refTitle)` が両方含まれるため、短い文字列が長い文字列に含まれる場合に誤マッチする可能性
- タイトルの形式が微妙に異なる場合（例: `453_【FIX】パスワード再設定機能` vs `045_【FIX】パスワード再設定機能`）にマッチしない

### 4. 適用されないケースの可能性

#### ケース1: ストリーミング中のメッセージ

- 820行目で`streamingReferences`を使用して変換
- `streamingReferences`が空の場合、変換されない

#### ケース2: 通常のメッセージ（完了後）

- 61行目で`msg.sources`を使用して変換
- `msg.sources`が空の場合、変換されない
- `msg.sources`の構造が異なる場合、マッチングが失敗する可能性

#### ケース3: タイトルの不一致

- 本文中のパターン: `（453_【FIX】パスワード再設定機能）`
- 参照元タイトル: `045_【FIX】パスワード再設定機能`
- → 番号が異なるため、完全一致しない

## 実施した対応

### 1. 重複コードの統合 ✅

`convertReferencesToNumberedLinks`の呼び出しを2箇所から1箇所に統合：
- 新規関数: `formatMessageContent`を作成（45行目）
- 61行目: `MessageCard`コンポーネントで使用
- 829行目: ストリーミング中のメッセージ表示で使用

### 2. マッチングロジックの改善 ✅

番号部分を除いた比較を優先するように改善：

```typescript
// 改善前: 複数の条件が並列でチェック（誤マッチの可能性）
return refTitle === content || 
       refTitle.includes(content) || 
       content.includes(refTitle) ||
       refTitle.replace(/^\d+_/, '') === content.replace(/^\d+_/, '') ||
       ...

// 改善後: 優先度順にチェック（完全一致 → 番号除去後比較 → 部分一致）
1. 完全一致を最優先
2. 番号除去後の完全一致を優先
3. 番号除去後の包含関係（長い方に短い方が含まれる）
4. 部分一致（短い方に長い方が含まれる場合は除外）
```

### 3. データ構造の確認

- `streamingReferences`: `references`の元の構造を保持
- `msg.sources`: `references.map((ref: any) => ({...}))`で変換された構造
- 両方とも`{title: string, url?: string}`の形式を期待しているため、問題なし

## 残存する可能性がある問題

### 問題1: タイトルの不一致

本文中のパターンと参照元タイトルが微妙に異なる場合：
- 本文: `（453_【FIX】パスワード再設定機能）`
- 参照元: `045_【FIX】パスワード再設定機能`
- → 番号が異なる場合、番号除去後の比較でマッチするはず

### 問題2: マッチングロジックの限界

- タイトルに微妙な差がある場合（例: 全角・半角、空白文字の有無）
- 参照元リストに該当するタイトルが含まれていない場合

## 推奨対応（追加）

1. **デバッグログの追加**: マッチング失敗の原因を特定
2. **タイトルの正規化**: 全角・半角、空白文字を統一
3. **実際のデータでのテスト**: 問題が発生している具体的なケースを確認

