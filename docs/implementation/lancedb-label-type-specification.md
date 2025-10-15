# LanceDB ラベルフィールド型仕様書

**作成日**: 2025年10月15日  
**バージョン**: 1.0  
**ステータス**: 公式仕様

---

## 📋 **ラベルフィールドの型定義**

### 1. Apache Arrow スキーマ定義

```typescript
// scripts/rebuild-lancedb-smart-chunking.ts:357
// src/lib/lancedb-schema-extended.ts:47-51

new arrow.Field(
  'labels',                                              // フィールド名
  new arrow.List(new arrow.Field('item', new arrow.Utf8())),  // List<string>型
  true                                                   // nullable: true（空配列可能）
)
```

**型詳細**:
- **フィールド名**: `labels`
- **データ型**: `List<Utf8>`（文字列の配列）
- **Nullable**: `true`（空配列または`null`が許容される）
- **用途**: Confluenceの旧形式ラベル（互換性用）

---

### 2. TypeScript 型定義

```typescript
// src/lib/lancedb-schema-extended.ts:117

interface ExtendedLanceDBRecord {
  // ...
  labels?: string[];  // オプショナル（undefined可能）
  // ...
}
```

**型詳細**:
- **TypeScript型**: `string[] | undefined`
- **デフォルト値**: `undefined`または`[]`（空配列）
- **例**:
  ```typescript
  labels: ['ワード・ディフィニション', '共通要件']
  labels: []  // 空配列（ラベルなし）
  labels: undefined  // 未定義
  ```

---

### 3. データ保存時の型

#### 正しい保存形式

```typescript
// Confluenceから取得
const labels: string[] = (page.metadata?.labels?.results || [])
  .map((l: any) => l.name || l.label || String(l))
  .filter((label: string) => label && label.length > 0);

// LanceDBレコードに保存
const record = {
  id: pageId,
  pageId: pageId,
  title: title,
  content: plainText,
  vector: embedding,
  // ...
  labels: labels,  // ← string[] 型（空配列の可能性あり）
  // ...
};
```

**重要**:
- ✅ `string[]` 型（文字列配列）
- ✅ 空配列`[]`も有効
- ❌ `undefined`は避ける（空配列`[]`を使用）
- ❌ `null`は避ける（スキーマでnullableだが、空配列`[]`推奨）

---

### 4. データ取得時の型

```typescript
// LanceDBから取得
const record = await table.query().limit(1).toArray();

// ラベルフィールドの型
record[0].labels: any  // LanceDBの戻り値はany型

// 正しい型アサーション
const labels: string[] = Array.isArray(record[0].labels) 
  ? record[0].labels 
  : [];

// または
const labels: string[] = record[0].labels || [];
```

---

## 🔍 **ラベル抽出の正しい実装**

### Confluenceラベル構造

```json
{
  "metadata": {
    "labels": {
      "results": [
        {
          "prefix": "global",
          "name": "ワード・ディフィニション",
          "id": "1726382102",
          "label": "ワード・ディフィニション"
        }
      ]
    }
  }
}
```

### 正しい抽出ロジック

```typescript
/**
 * Confluenceページからラベルを抽出
 * @param page Confluenceページオブジェクト
 * @returns string[] ラベル配列（空の場合は[]）
 */
function extractLabels(page: any): string[] {
  const rawLabels = page.metadata?.labels?.results || [];
  
  const labels = rawLabels
    .map((l: any) => {
      // 優先順位: name > label > toString
      return l.name || l.label || String(l);
    })
    .filter((label: string) => {
      // 空文字列を除外
      return label && label.trim().length > 0;
    })
    .map((label: string) => label.trim()); // 前後の空白を除去
  
  return labels;
}
```

**使用例**:
```typescript
const labels = extractLabels(page);
console.log(`Labels for ${page.title}: ${labels.join(', ') || '(none)'}`);

records.push({
  // ...
  labels: labels,  // ← 空配列[]または['label1', 'label2']
});
```

---

## 🎯 **型安全性のベストプラクティス**

### 1. 保存前の検証

```typescript
// ラベル配列の型検証
function validateLabels(labels: any): string[] {
  if (!Array.isArray(labels)) {
    console.warn('[validateLabels] Not an array, converting to empty array');
    return [];
  }
  
  const validated = labels.filter((label: any) => {
    if (typeof label !== 'string') {
      console.warn(`[validateLabels] Non-string label: ${typeof label}`);
      return false;
    }
    return label.trim().length > 0;
  });
  
  return validated;
}

// 使用
records.push({
  // ...
  labels: validateLabels(extractedLabels),
});
```

---

### 2. 取得後の正規化

```typescript
// LanceDBから取得後
function normalizeLabels(rawLabels: any): string[] {
  if (!rawLabels) return [];
  if (!Array.isArray(rawLabels)) return [];
  
  return rawLabels
    .filter((label: any) => typeof label === 'string')
    .map((label: string) => String(label).trim())
    .filter((label: string) => label.length > 0);
}

// 使用
const record = await table.query().limit(1).toArray();
const labels = normalizeLabels(record[0].labels);
```

---

### 3. デバッグ出力

```typescript
// 保存時
console.log(`   [Labels] ${title}: ${labels.length}件 - ${labels.join(', ') || '(none)'}`);

// 保存後の検証
const saved = await table.query().limit(1).toArray();
console.log(`   [Verify] Saved labels: ${saved[0].labels?.join(', ') || '(none)'}`);
```

---

## 📊 **型の比較表**

| レイヤー | 型 | 例 | 注意点 |
|---------|-----|-----|--------|
| **Confluence API** | `{ name: string }[]` | `[{ name: "権限" }]` | 構造化オブジェクトの配列 |
| **抽出後** | `string[]` | `["権限", "ワード"]` | 文字列配列に変換 |
| **Apache Arrow** | `List<Utf8>` | Schema定義 | LanceDB内部形式 |
| **LanceDB保存** | `string[]` | `["権限"]` | 実際のデータ |
| **LanceDB取得** | `any` | runtime型チェック必要 | 型アサーション推奨 |
| **TypeScript** | `string[] \| undefined` | オプショナル | 型安全性のため |

---

## 🔧 **現在の問題と修正**

### 問題1: ラベルが保存されていない ❌

**現状**:
```typescript
// Line 174, 203
labels: (page.metadata?.labels?.results || []).map((l: any) => l.name),

// 保存時: labels = []（空配列）
// 原因: page.metadata?.labels?.results が空または取得失敗
```

**修正**:
```typescript
// デバッグ付きラベル抽出
labels: (() => {
  const rawLabels = page.metadata?.labels?.results || [];
  console.log(`      [Debug] Raw labels for ${title}:`, rawLabels.length, 'items');
  
  if (rawLabels.length > 0) {
    console.log(`      [Debug] First label:`, JSON.stringify(rawLabels[0]));
  }
  
  const extracted = rawLabels
    .map((l: any) => l.name || l.label || String(l))
    .filter((label: string) => label && label.trim().length > 0);
  
  if (extracted.length > 0) {
    console.log(`      [Labels] ${title}: ${extracted.join(', ')}`);
  } else {
    console.log(`      [Labels] ${title}: (none)`);
  }
  
  return extracted;
})(),
```

---

### 問題2: 型安全性の欠如 ⚠️

**現状**:
```typescript
// 型チェックなし
labels: (page.metadata?.labels?.results || []).map((l: any) => l.name),
```

**修正**:
```typescript
/**
 * 型安全なラベル抽出関数
 */
function extractLabelsTypeSafe(page: any): string[] {
  if (!page?.metadata?.labels?.results) {
    return [];
  }
  
  const rawLabels = page.metadata.labels.results;
  
  if (!Array.isArray(rawLabels)) {
    console.warn(`[extractLabels] labels.results is not an array for page ${page.title}`);
    return [];
  }
  
  const labels: string[] = [];
  
  for (const labelObj of rawLabels) {
    const label = labelObj.name || labelObj.label;
    
    if (typeof label === 'string' && label.trim().length > 0) {
      labels.push(label.trim());
    } else {
      console.warn(`[extractLabels] Invalid label for page ${page.title}:`, labelObj);
    }
  }
  
  return labels;
}

// 使用
labels: extractLabelsTypeSafe(page),
```

---

## 📚 **型定義サマリー**

### Apache Arrow Schema（LanceDB内部）

```typescript
new arrow.Field(
  'labels',                                           // フィールド名
  new arrow.List(                                     // リスト型
    new arrow.Field('item', new arrow.Utf8())         // 要素: 文字列
  ),
  true                                                // nullable: true
)
```

### TypeScript インターフェース

```typescript
interface LanceDBRecord {
  id: string;
  pageId: string;
  title: string;
  content: string;
  vector: number[];
  isChunked: boolean;
  chunkIndex: number;
  totalChunks: number;
  labels?: string[];     // ← オプショナル文字列配列
  spaceKey: string;
  lastUpdated: string;
}
```

### データ例

```typescript
// 正しい例
{
  labels: ['ワード・ディフィニション', '共通要件']
}

{
  labels: []  // 空配列（ラベルなし）
}

// 避けるべき例
{
  labels: null  // ❌ undefinedまたは[]を使用
}

{
  labels: [123, 'test']  // ❌ 文字列のみ
}
```

---

## 🎯 **推奨される実装パターン**

### Pattern 1: 関数による抽出（推奨）

```typescript
function extractLabelsFromConfluence(page: any): string[] {
  const rawLabels = page.metadata?.labels?.results || [];
  
  if (!Array.isArray(rawLabels)) return [];
  
  return rawLabels
    .map((l: any) => l.name || l.label || String(l))
    .filter((label: string) => typeof label === 'string' && label.trim().length > 0)
    .map((label: string) => label.trim());
}
```

### Pattern 2: インライン抽出（現状）

```typescript
labels: (page.metadata?.labels?.results || [])
  .map((l: any) => l.name || l.label || String(l))
  .filter((label: string) => label && label.trim().length > 0)
  .map((label: string) => label.trim())
```

### Pattern 3: 型安全な抽出（厳格）

```typescript
import { z } from 'zod';

const ConfluenceLabelSchema = z.object({
  name: z.string(),
  label: z.string().optional(),
  id: z.string().optional(),
  prefix: z.string().optional()
});

function extractLabelsWithValidation(page: any): string[] {
  const rawLabels = page.metadata?.labels?.results || [];
  const validated: string[] = [];
  
  for (const raw of rawLabels) {
    try {
      const parsed = ConfluenceLabelSchema.parse(raw);
      validated.push(parsed.name);
    } catch (error) {
      console.warn(`Invalid label structure:`, raw);
    }
  }
  
  return validated;
}
```

---

## 🔍 **デバッグ方法**

### 保存前のデバッグ

```typescript
// ページ処理時
const labels = extractLabels(page);
console.log(`[Labels] ${title}:`);
console.log(`  Count: ${labels.length}`);
console.log(`  Values: ${JSON.stringify(labels)}`);
console.log(`  Type: ${Array.isArray(labels) ? 'Array' : typeof labels}`);

if (labels.length > 0) {
  console.log(`  First label type: ${typeof labels[0]}`);
  console.log(`  All types valid: ${labels.every(l => typeof l === 'string')}`);
}
```

### 保存後の検証

```typescript
// LanceDB保存後
const verifyRecords = await table.query().limit(10).toArray();

console.log('\nLabel verification:');
verifyRecords.forEach((r, i) => {
  console.log(`${i + 1}. ${r.title}`);
  console.log(`   labels type: ${typeof r.labels}`);
  console.log(`   labels isArray: ${Array.isArray(r.labels)}`);
  console.log(`   labels value: ${JSON.stringify(r.labels)}`);
  console.log(`   labels count: ${r.labels?.length || 0}`);
});
```

---

## ✅ **型チェックリスト**

### 保存前チェック

- [ ] `labels`は`string[]`型である
- [ ] すべての要素が`string`型である
- [ ] 空文字列が含まれていない
- [ ] `null`や`undefined`が含まれていない
- [ ] 配列が空の場合は`[]`（`undefined`ではない）

### スキーマチェック

- [ ] Apache Arrow定義: `List<Utf8>, nullable=true`
- [ ] TypeScript定義: `labels?: string[]`
- [ ] 両者が一致している

### 保存後チェック

- [ ] 保存されたレコードで`labels`が`string[]`型
- [ ] ラベルあるページはラベルが保持されている
- [ ] ラベルなしページは空配列`[]`

---

## 📊 **期待される動作**

### サンプルデータ

```typescript
// ページ1: ラベルあり
{
  id: "666927116",
  pageId: "666927116",
  title: "ワード・ディフィニション",
  labels: ["ワード・ディフィニション"],  // ← 1件
  // ...
}

// ページ2: 複数ラベル
{
  id: "123456789",
  pageId: "123456789",
  title: "会員退会機能",
  labels: ["会員管理", "退会", "機能要件"],  // ← 3件
  // ...
}

// ページ3: ラベルなし
{
  id: "640450787",
  pageId: "640450787",
  title: "client-tomonokai-juku Home",
  labels: [],  // ← 空配列（undefined ではない）
  // ...
}
```

### 統計

```
期待される分布（Confluenceの実態ベース）:
  ラベルありページ: 約30%（300-400レコード）
  ラベルなしページ: 約70%（900-1,000レコード）
  
現状:
  ラベルありページ: 0% (0レコード) ❌
  ラベルなしページ: 100% (1,316レコード) ❌
```

---

## 🔧 **修正実装例**

### rebuild-lancedb-smart-chunking.ts への追加

```typescript
// ファイルの先頭に関数を追加
/**
 * Confluenceページからラベルを抽出（型安全）
 */
function extractLabels(page: any): string[] {
  const rawLabels = page.metadata?.labels?.results || [];
  
  if (!Array.isArray(rawLabels)) {
    console.warn(`   [Warning] labels.results is not array for: ${page.title}`);
    return [];
  }
  
  const labels = rawLabels
    .map((l: any) => l.name || l.label || String(l))
    .filter((label: string) => typeof label === 'string' && label.trim().length > 0)
    .map((label: string) => label.trim());
  
  return labels;
}

// Line 174, 203 を修正
labels: extractLabels(page),  // ← 関数を使用

// または、インラインで詳細なデバッグ
labels: (() => {
  const rawLabels = page.metadata?.labels?.results || [];
  
  // デバッグ出力
  if (rawLabels.length > 0) {
    console.log(`      [Debug] ${title} has ${rawLabels.length} raw labels`);
    console.log(`      [Debug] First label:`, rawLabels[0]);
  }
  
  const extracted = rawLabels
    .map((l: any) => l.name || l.label || String(l))
    .filter((label: string) => typeof label === 'string' && label.trim().length > 0)
    .map((label: string) => label.trim());
  
  if (extracted.length > 0) {
    console.log(`      [Labels] ${title}: ${extracted.join(', ')}`);
  }
  
  return extracted;
})(),
```

---

## 🎯 **まとめ**

### ラベルフィールドの型（確定仕様）

| 項目 | 値 |
|------|-----|
| **Apache Arrow型** | `List<Utf8>` |
| **Nullable** | `true` |
| **TypeScript型** | `string[]` (optional) |
| **デフォルト値** | `[]`（空配列） |
| **保存形式** | `["label1", "label2"]`または`[]` |

### 実装ガイドライン

1. ✅ ラベル抽出には`extractLabels()`関数を使用
2. ✅ 空配列`[]`をデフォルトとする（`undefined`や`null`は避ける）
3. ✅ すべての要素が`string`型であることを検証
4. ✅ デバッグ出力でラベル取得を確認
5. ✅ 保存後の検証を実施

---

**次のステップ**: この型仕様に基づいて`rebuild-lancedb-smart-chunking.ts`を修正

