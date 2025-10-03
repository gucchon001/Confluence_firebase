# Confluenceデータ取得機能の重複分析

## 重複ファイル一覧

1. **src/scripts/confluence-fetch.ts** - 基本的なConfluenceデータ取得（JSON出力のみ）
2. **src/scripts/confluence-fetch-one-to-lancedb.ts** - 単一ページをLanceDBに保存
3. **src/scripts/confluence-to-lancedb.ts** - 複数ページをLanceDBに保存（基本版）
4. **src/scripts/confluence-to-lancedb-improved.ts** - 複数ページをLanceDBに保存（改良版）
5. **src/scripts/batch-sync-confluence.ts** - **実際に使用されているメインの同期スクリプト**

## 機能比較

| 機能 | confluence-fetch.ts | confluence-fetch-one-to-lancedb.ts | confluence-to-lancedb.ts | confluence-to-lancedb-improved.ts | batch-sync-confluence.ts |
|------|-------------------|-----------------------------------|-------------------------|----------------------------------|-------------------------|
| Confluence API取得 | ✅ | ✅ | ✅ | ✅ | ✅ |
| LanceDB保存 | ❌ | ✅ | ✅ | ✅ | ✅ |
| バッチ処理 | ❌ | ❌ | ✅ | ✅ | ✅ |
| エラーハンドリング | 基本 | 基本 | 基本 | 強化 | 強化 |
| 差分同期 | ❌ | ❌ | ❌ | ❌ | ✅ |
| ラベル取得 | ❌ | ❌ | ❌ | ❌ | ✅ |
| チャンク分割 | ❌ | ❌ | ✅ | ✅ | ✅ |
| 進捗表示 | 基本 | 基本 | 基本 | 改善 | 改善 |
| 実際の使用 | ❌ | ❌ | ❌ | ❌ | ✅ |

## 使用状況

### 実際に使用されているファイル
- **batch-sync-confluence.ts** - メインの同期スクリプト
  - `getConfluencePages()` - ページ一覧取得
  - `getConfluenceLabels()` - ラベル取得
  - 差分同期機能
  - エラーハンドリング強化

### 他のファイルから参照されている関数
- `resync-specific-pages.ts` → `getConfluenceLabels`をimport
- `debug-differential-analysis.ts` → `getConfluencePages`をimport
- `test-labels-fetch.ts` → `getConfluenceLabels`をimport

### 未使用のファイル
- `confluence-fetch.ts` - JSON出力のみ、LanceDB保存なし
- `confluence-fetch-one-to-lancedb.ts` - 単一ページのみ
- `confluence-to-lancedb.ts` - 基本版、差分同期なし
- `confluence-to-lancedb-improved.ts` - 改良版だが未使用

## 統合提案

### 統合後のクラス設計
```typescript
class ConfluenceDataService {
  // 基本機能
  async fetchPages(spaceKey: string, start: number, limit: number): Promise<ConfluencePage[]>
  async fetchSinglePage(pageId: string): Promise<ConfluencePage>
  async fetchLabels(pageId: string): Promise<string[]>
  
  // LanceDB統合
  async saveToLanceDB(pages: ConfluencePage[], tableName: string): Promise<void>
  async saveSinglePageToLanceDB(pageId: string, tableName: string): Promise<void>
  
  // 差分同期
  async syncWithDifferentialCheck(spaceKey: string, lastSyncTime?: string): Promise<void>
  
  // ユーティリティ
  extractTextFromHtml(html: string): string
  splitTextIntoChunks(text: string): string[]
}
```

### 削除対象ファイル
1. `confluence-fetch.ts` - 機能が他のファイルに統合済み
2. `confluence-fetch-one-to-lancedb.ts` - 単一ページ機能は統合クラスで対応
3. `confluence-to-lancedb.ts` - 基本版、改良版に統合
4. `confluence-to-lancedb-improved.ts` - 未使用、統合クラスで代替

### 移行計画
1. `ConfluenceDataService`クラスを作成
2. `batch-sync-confluence.ts`の機能をクラスに移行
3. 他のファイルの依存関係を新しいクラスに更新
4. 重複ファイルを削除
