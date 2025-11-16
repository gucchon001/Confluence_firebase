# Markdown処理の修正レポート

## 📋 概要

管理画面周辺のリファクタリング時に発生したMarkdown表示の問題を修正しました。

**作成日**: 2025-10-08

---

## 🔍 発見された問題

### 1. 見出し内の数字が分離される
**症状**: `#### 2. 応募後の流れ` が `#### \n2. 応募後の流れ` のように分離される

**原因**: 見出し行でも数字リスト処理が適用されていた

### 2. テーブルが崩れる
**症状**: タブ区切りのテーブルが正しく変換されない
```
| 項目名 | 説明 | 備考 |

:---	:---
求人番号	指定した番号
```

**原因**: タブ区切りの検出と変換が不完全

### 3. 数字リストが分離されない
**症状**: `1.項目A 2.項目B` が1行のまま

**原因**: 同じ行内の複数リスト項目の分離処理が不足

---

## 🔧 実施した修正

### 修正1: 見出しとテーブルの保護

**コード**: `src/lib/markdown-utils.tsx`

```typescript
// 番号付きリストの改行処理（見出しとテーブルを除外）
for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  const trimmed = line.trim();
  
  // 見出し行は保護（処理しない）
  if (/^#{1,6}\s/.test(trimmed)) {
    processedLines.push(line);
    continue;
  }
  
  // テーブル行は保護（処理しない）
  if (/^\|/.test(trimmed) || /^:?-{3,}/.test(trimmed)) {
    processedLines.push(line);
    continue;
  }
  
  // 数字リスト処理...
}
```

**効果**:
- ✅ 見出し `#### 2. 応募後の流れ` が保護される
- ✅ テーブル行が誤って処理されない

### 修正2: 同じ行内の複数リスト項目の分離

```typescript
// 同じ行内に複数の数字リストがある場合、分離
// 「1.項目A 2.項目B 3.項目C」→ 分離
if (/\d+\.[^\n]+\s+\d+\./.test(line)) {
  const parts = line.split(/\s+(?=\d+\.)/);
  parts.forEach((part, idx) => {
    if (idx === 0) {
      let processed = part.replace(/([。！？])\s*(\d+\.)/, '$1\n$2');
      processedLines.push(processed);
    } else {
      processedLines.push(part);
    }
  });
  continue;
}
```

**変換例**:
```
入力: 「説明です。1.会員登録 2.仮登録メール 3.本登録」

出力:
説明です。

1. 会員登録
2. 仮登録メール
3. 本登録
```

### 修正3: タブ区切りテーブルの変換強化

```typescript
// タブ区切りの検出
const looksLikeTabDelimited = trimmed.includes('\t') && !trimmed.includes('|');

if (looksLikeTabDelimited) {
  const cells = trimmed.split('\t').map(c => c.trim()).filter(c => c);
  const normalized = '| ' + cells.join(' | ') + ' |';
  // ... テーブル処理
}

// タブ区切り区切り線の検出と正規化
if (looksLikeSeparator && currentColumns) {
  fixed.push(normalizeSeparator(trimmed, currentColumns));
  continue;
}
```

**変換例**:
```
入力:
| 項目名 | 説明 | 備考 |

:---	:---
求人番号	指定した番号の求人基本情報

出力:
| 項目名 | 説明 | 備考 |
| :--- | :--- | :--- |
| 求人番号 | 指定した番号の求人基本情報 | - |
```

### 修正4: テーブル処理の簡素化

**問題**: 行を列数で分割する処理が、正常な行も分割していた

**修正**: 不要な分割処理を削除

```typescript
// 削除した処理
// if (currentColumns && cells.length > currentColumns) {
//   for (let off = 0; off < cells.length; off += currentColumns) {
//     ...
//   }
// }

// シンプルに
fixed.push(normalized);
```

---

## 🧪 テスト結果

### ユニットテスト

全5テスト **合格** ✅

```bash
✓ markdown-utils > normalizeMarkdownSymbols > 見出し内の数字を保護する
✓ markdown-utils > normalizeMarkdownSymbols > 段落内の数字リストを分離する
✓ markdown-utils > normalizeMarkdownSymbols > 数字リストの前に空行を追加する
✓ markdown-utils > fixMarkdownTables > タブ区切りのテーブルをパイプ区切りに変換
✓ markdown-utils > fixMarkdownTables > ヘッダーと区切り線の間の空行を処理
```

### 変換例のテスト

#### 例1: 見出しの保護
```
入力: #### 2. 応募後の流れ
出力: #### 2. 応募後の流れ ✅（変更なし）
```

#### 例2: 数字リストの分離
```
入力: 説明です。1.項目A 2.項目B
出力:
説明です。

1. 項目A
2. 項目B
```

#### 例3: テーブルの修正
```
入力:
| 項目名 | 説明 | 備考 |

:---	:---
求人番号	指定した番号

出力:
| 項目名 | 説明 | 備考 |
| :--- | :--- | :--- |
| 求人番号 | 指定した番号 | - |
```

---

## 📝 プロンプトの改善

LLMに正しいMarkdown形式を指示するため、両方のプロンプトに以下を追加しました：

- `src/ai/flows/streaming-summarize-confluence-docs.ts`
- `src/ai/flows/summarize-confluence-docs.ts`

### 追加した指示

```
## 番号付きリストの厳格なルール
**絶対に守るべきルール**:

1. **各項目は必ず新しい行から開始**してください
2. **ピリオドの後に半角スペースを1つ**入れてください
3. **サブ項目は3スペースのインデント + ハイフン**で記述してください
4. **リストの前には空行**を入れてください

## テーブル形式の厳格なルール
**絶対に守るべきルール**:

1. **各セルはパイプ（|）で区切る**
2. **ヘッダー行の次の行に区切り線を入れる**: | :--- | :--- |
3. **各行は必ずパイプで開始・終了する**
4. **タブ文字は使用しない**（必ずパイプを使用）
5. **テーブルの前後には空行を入れる**
```

---

## ✅ 修正済みファイル

1. **`src/lib/markdown-utils.tsx`**
   - 見出し保護処理の追加
   - テーブル保護処理の追加
   - 複数リスト項目の分離処理
   - タブ区切りテーブルの変換

2. **`src/ai/flows/streaming-summarize-confluence-docs.ts`**
   - プロンプトに番号付きリストのルール追加
   - プロンプトにテーブル形式のルール追加

3. **`src/ai/flows/summarize-confluence-docs.ts`**
   - プロンプトに番号付きリストのルール追加
   - プロンプトにテーブル形式のルール追加

4. **`src/components/admin-dashboard.tsx`**
   - 関数適用順序の修正

5. **`src/tests/markdown-utils.test.ts`** (新規作成)
   - ユニットテストの追加

---

## 🎯 ブラウザテスト手順

開発サーバーが起動しました（`http://localhost:3000`）。以下の手順でテストしてください：

### テストケース1: 数字リスト

質問例:
```
ログインフローを教えて
```

期待される表示:
```
1. 会員登録完了: ...
2. 仮登録メール送信: ...
3. 本登録と同時ログイン: ...
```

### テストケース2: 見出しの数字

質問例:
```
求人詳細画面の仕様を教えて
```

期待される表示:
```
#### 2. 応募後の流れ  ← "####" が消えていないこと
```

### テストケース3: テーブル

質問例:
```
求人の項目一覧を教えて
```

期待される表示:
```
| 項目名 | 説明 | 備考 |
| :--- | :--- | :--- |
| 求人番号 | ... | ... |
```

---

## 📊 期待される改善

- ✅ 見出しが保護される
- ✅ 数字リストが正しく分離・表示される
- ✅ テーブルが正しく表示される
- ✅ サブ項目が箇条書きになる

次回のAI回答から、これらの改善が反映されます！

---

## 🔄 更新履歴

| 日付 | 変更内容 |
|:---|:---|
| 2025-10-08 | Markdown処理の修正完了、テスト追加 |

