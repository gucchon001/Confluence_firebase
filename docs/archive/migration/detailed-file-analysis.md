# 主要ファイルの詳細分析

## 📄 src/ai/flows/retrieve-relevant-docs-lancedb.ts

### pageId使用箇所
1. **Line 192**: `pageId: String(r.pageId ?? r.id ?? '')` - APIレスポンスマッピング
2. **Line 304**: `const pageId = result.pageId || result.id` - 変数取得
3. **Line 319**: `await getAllChunksByPageId(String(pageId))` - 関数呼び出し
4. **Line 323**: ログ出力
5. **Line 401**: 関数定義 `getAllChunksByPageId(pageId: string)`
6. **Line 418**: 関数定義 `getAllChunksByPageIdInternal(pageId: string)`
7. **Line 439**: `.where(\`pageId\` = ${numericPageId})` - **Critical: クエリ条件**
8. **Line 447, 463, 465, 473, 479**: ログ出力
9. **Line 495, 501**: `pageId`の取得と使用

### 変更内容
- Line 439: `.where(\`pageId\` = ...)` → `.where(\`page_id\` = ...)`
- その他は主に変数名やログ出力（影響は小さい）

## 📄 src/lib/lancedb-search-client.ts

### pageId使用箇所
1. **Line 102**: `pageId?: number` - 型定義
2. **Line 379, 385, 388, 394, 402**: フォールバック処理
3. **Line 643**: `r.pageId` - 重複除去のキー
4. **Line 1104**: `pageId: r.pageId` - マッピング
5. **Line 1195**: `.where(\`pageId\` = '${pageId}')` - **Critical: クエリ条件**

### 変更内容
- Line 1195: `.where(\`pageId\` = ...)` → `.where(\`page_id\` = ...)`
- Line 102: 型定義は内部処理のみなので、`page_id`に変更（APIレスポンスでは変換）

## 📄 src/lib/lancedb-schema-extended.ts

### pageId使用箇所
1. **Line 24**: `new arrow.Field('pageId', new arrow.Int64(), false)` - **Critical: スキーマ定義**

### 変更内容
- Line 24: `'pageId'` → `'page_id'`

## 📄 src/lib/lancedb-schema.ts

### pageId使用箇所
1. **Line 32**: `pageId: { type: 'int64', nullable: false }` - **Critical: スキーマ定義**
2. **Line 46**: `pageId: string` - 型定義
3. **Line 64, 91, 104**: 関数での使用

### 変更内容
- Line 32: `pageId` → `page_id`
- Line 46: 型定義は維持（API互換性のため）

## 📄 src/lib/confluence-sync-service.ts

### pageId使用箇所
1. **Line 30**: `pageId: number` - 型定義
2. **Line 558**: `.filter((chunk: any) => chunk.pageId === parseInt(pageId))` - **Critical: フィルタリング**

### 変更内容
- Line 558: `chunk.pageId` → `chunk.page_id`

