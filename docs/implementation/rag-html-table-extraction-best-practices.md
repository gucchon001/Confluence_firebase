# RAGシステムにおけるHTML表の扱い：ベストプラクティス

## 概要

RAG（Retrieval-Augmented Generation）システムでHTMLからテキストを抽出する際、表（`<table>`タグ）の扱いは重要な課題です。
一般的なベストプラクティスと、現在の実装との比較をまとめます。

## 一般的なベストプラクティス

### 1. 表の構造を保持する ✅ 推奨

**理由**:
- 表の構造が失われると、情報の意味が不明瞭になる
- LLMが表の内容を正しく理解できない可能性
- セル間の関係性が失われる

**方法**:
- セル間を ` | ` で区切る
- 行間を改行（`\n`）で区切る
- Markdown形式での表現

**例**:
```html
<table>
  <tr>
    <td>更新前</td>
    <td>更新後</td>
  </tr>
  <tr>
    <td>学部1年生</td>
    <td>学部2年生</td>
  </tr>
</table>
```

**期待される出力**:
```
更新前 | 更新後
学部1年生 | 学部2年生
```

### 2. Markdown形式での表現 ✅ 推奨

**メリット**:
- LLMが表の構造を理解しやすい
- セル間の関係性が明確
- 読みやすい形式

**方法**:
- セル間を ` | ` で区切る
- 行間を改行で区切る
- 必要に応じて、ヘッダー行の下に区切り線（`|---|---|`）を追加

**例**:
```
更新前 | 更新後
学部1年生 | 学部2年生
学部2年生 | 学部3年生
```

### 3. HTMLパーサーライブラリの使用 ✅ 推奨

**ライブラリの例**:
- **Inscriptis**: HTMLをプレーンテキストに変換する際、表のレイアウトを考慮
- **cheerio** / **jsdom**: HTMLパーサーライブラリ
- **HtmlRAG**: HTMLの構造情報を活用した情報抽出

**メリット**:
- より正確なHTML処理
- 複雑なHTML構造にも対応
- 表の構造を保持しやすい

**デメリット**:
- 依存関係の追加
- パフォーマンスの影響（軽微）

### 4. 表のタイトルや説明を保持 ✅ 推奨

**理由**:
- 表のタイトルや説明は、表の内容を理解する上で重要
- LLMが表の文脈を理解しやすい

**方法**:
- 表の前にタイトルや説明を配置
- 表の後に説明を配置（必要な場合）

**例**:
```
表1 「入学からの経過年数」ごとの対象判定条件
入学からの経過年数 | 対象となる条件
7以上 | 対象外
6 | 「大学：学年」が「学部6年生」
5 | 「大学：学年」が「学部6年生」ではない
```

### 5. ネストされた表の処理 ✅ 考慮が必要

**方法**:
- ネストされた表を検出して、適切に処理
- 表の階層を保持（必要に応じて）

## 現在の実装との比較

### 現在の実装 ❌ 非推奨

**実装**:
```typescript
// HTMLタグを削除して空白に置換
const withoutTags = text.replace(/<[^>]*>/g, ' ');

// 連続する空白を1つにまとめる
const normalizedSpaces = withoutTags.replace(/\s+/g, ' ');
```

**結果**:
```
更新前 更新後 学部1年生 学部2年生
```

**問題**:
- ❌ 表の構造が失われる
- ❌ セル間の区切りが空白になる
- ❌ 行の区切りが失われる
- ❌ LLMが表の内容を正しく理解できない可能性

### ベストプラクティスとの比較

| 項目 | 現在の実装 | ベストプラクティス |
|------|-----------|------------------|
| 表の構造保持 | ❌ 失われる | ✅ 保持される |
| セル間の区切り | ❌ 空白 | ✅ ` \| ` |
| 行の区切り | ❌ なし | ✅ 改行（`\n`） |
| Markdown形式 | ❌ なし | ✅ あり |
| LLMの理解 | ❌ 困難 | ✅ 容易 |

## 実装例

### 例1: 正規表現による表の処理（推奨）

```typescript
private extractTextFromHtml(html: string): string {
  if (!html) return '';
  
  let text = removeBOM(html);
  
  // HTML特殊文字をデコード
  const htmlEntities: { [key: string]: string } = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
    '&apos;': "'"
  };
  
  for (const [entity, char] of Object.entries(htmlEntities)) {
    text = text.replace(new RegExp(entity, 'g'), char);
  }
  
  // 表の処理を優先（構造を保持）
  text = text.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (match, tableContent) => {
    // 表の各行を処理
    const rows: string[] = [];
    const rowMatches = tableContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    
    for (const rowMatch of rowMatches) {
      // 各セルを処理
      const cells: string[] = [];
      const cellMatches = rowMatch.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
      
      for (const cellMatch of cellMatches) {
        // セル内のHTMLタグを削除してテキストを抽出
        let cellText = cellMatch.replace(/<[^>]*>/g, ' ');
        cellText = cellText.replace(/\s+/g, ' ').trim();
        if (cellText) {
          cells.push(cellText);
        }
      }
      
      if (cells.length > 0) {
        rows.push(cells.join(' | '));
      }
    }
    
    return rows.join('\n');
  });
  
  // その他のHTMLタグを削除
  text = text.replace(/<[^>]*>/g, ' ');
  
  // 空白の正規化
  text = text.replace(/\s+/g, ' ');
  
  return this.sanitizeText(text);
}
```

### 例2: HTMLパーサーライブラリの使用（より堅牢）

```typescript
import * as cheerio from 'cheerio';

private extractTextFromHtml(html: string): string {
  if (!html) return '';
  
  const $ = cheerio.load(html);
  
  // 表を処理
  $('table').each((_, table) => {
    const rows: string[] = [];
    $(table).find('tr').each((_, row) => {
      const cells: string[] = [];
      $(row).find('td, th').each((_, cell) => {
        const cellText = $(cell).text().trim();
        if (cellText) {
          cells.push(cellText);
        }
      });
      if (cells.length > 0) {
        rows.push(cells.join(' | '));
      }
    });
    $(table).replaceWith(rows.join('\n'));
  });
  
  // その他のHTMLタグを削除
  const text = $.text();
  
  return this.sanitizeText(text);
}
```

## 参考: Jiraの処理（良い例）

**ファイル**: `src/lib/jira-sync-service.ts` (407-445行目)

```typescript
case 'table':
  return (node.content || [])
    .map((row: any) => (row.content || [])
      .map((cell: any) => this.extractTextFromADF(cell).trim())
      .join(' | '))  // セル間を ' | ' で区切る
    .join('\n');     // 行間を改行で区切る
```

**メリット**:
- ✅ 表の構造が保持される
- ✅ セル間の区切りが明確
- ✅ 行の区切りが明確
- ✅ LLMが表の内容を理解しやすい

## まとめ

### 一般的なベストプラクティス

1. **表の構造を保持する**: セル間を ` | ` で区切り、行間を改行で区切る
2. **Markdown形式での表現**: LLMが理解しやすい形式
3. **HTMLパーサーライブラリの使用**: より正確なHTML処理
4. **表のタイトルや説明を保持**: 表の文脈を理解しやすくする

### 現在の実装の問題点

1. ❌ 表の構造が失われる
2. ❌ セル間の区切りが空白になる
3. ❌ 行の区切りが失われる
4. ❌ LLMが表の内容を正しく理解できない可能性

### 推奨される改善

1. ✅ 表の構造を考慮したHTML処理を実装
2. ✅ セル間を ` | ` で区切り、行間を改行で区切る
3. ✅ Markdown形式での表現
4. ✅ HTMLパーサーライブラリの使用を検討

## 参考資料

- [Inscriptis: HTML to Text Conversion with Table Layout Support](https://arxiv.org/abs/2108.01454)
- [HtmlRAG: HTML Structure-Aware Information Extraction](https://arxiv.org/abs/2411.02959)
- [Amazon Textract: Enhanced Table Extractions](https://aws.amazon.com/jp/blogs/news/announcing-enhanced-table-extractions-with-amazon-textract/)

