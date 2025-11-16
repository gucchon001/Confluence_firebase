# Firestoreラベル統合プラン

**作成日**: 2025年11月2日  
**目的**: 通常の同期プロセスでFirestoreの`structured_labels`をLanceDBに含める

## 📋 現状

### 現在の同期プロセス

1. **Confluence APIからページ取得**
   - `confluence-sync-service.ts`がConfluence APIからページを取得
   - Confluence APIの`metadata.labels`のみを取得
   - Firestoreの`structured_labels`は取得していない

2. **LanceDBに保存**
   - `labels: string[]` - Confluence APIから取得したラベル
   - `structured_*` フィールド - **現在は空**（別スクリプトで同期が必要）

### 問題点

- 通常の同期プロセスではFirestoreの`structured_labels`が含まれない
- 別途`scripts/sync-firestore-labels-to-lancedb.ts`を実行する必要がある
- 2段階の同期プロセスが必要で、手間がかかる

## 🎯 改善案

### 改善案: 通常の同期プロセスにFirestoreラベル取得を統合

**実装内容**:
```typescript
// confluence-sync-service.ts に追加

import { getStructuredLabel } from './structured-label-service';
import { flattenStructuredLabel } from './lancedb-schema-extended';

// addNewPage メソッドを修正
private async addNewPage(table: any, page: ConfluencePage): Promise<void> {
  try {
    // ページを2-3チャンクに分割
    const chunks = this.splitPageIntoChunks(page);
    
    // 【新規】FirestoreからStructuredLabelを取得（ページ単位で1回のみ）
    let structuredLabelFlat: Partial<ExtendedLanceDBRecord> = {};
    try {
      const structuredLabel = await getStructuredLabel(page.id);
      if (structuredLabel) {
        structuredLabelFlat = flattenStructuredLabel(structuredLabel);
        console.log(`  ✅ Firestore StructuredLabel取得: ${page.id}`);
      } else {
        console.log(`  ⚠️ Firestore StructuredLabelなし: ${page.id}`);
      }
    } catch (error) {
      // Firestore取得エラーは警告のみ（同期を継続）
      console.warn(`  ⚠️ Firestore StructuredLabel取得エラー: ${page.id}`, error);
    }
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // 埋め込みベクトルを生成
      const embedding = await getEmbeddings(chunk.content);
      
      // ラベルを抽出（Confluence APIから）
      const labels = this.extractLabelsFromPage(page);
      
      // チャンクデータを作成
      const chunkData = {
        id: `${chunk.pageId}-${chunk.chunkIndex}`,
        pageId: chunk.pageId,
        title: chunk.title,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        lastUpdated: chunk.lastUpdated,
        space_key: chunk.spaceKey,
        url: `${process.env.CONFLUENCE_BASE_URL}/wiki/spaces/${chunk.spaceKey}/pages/${chunk.pageId}`,
        labels: labels,
        vector: embedding
      };

      // LanceDBデータ形式に変換
      const lanceData = {
        id: String(chunkData.id),
        page_id: Number(chunkData.pageId),
        title: String(chunkData.title),
        content: String(chunkData.content),
        chunkIndex: Number(chunkData.chunkIndex),
        lastUpdated: String(chunkData.lastUpdated),
        space_key: String(chunkData.space_key),
        url: String(chunkData.url),
        labels: (() => {
          if (Array.isArray(chunkData.labels)) {
            return [...chunkData.labels].map(String);
          }
          return [];
        })(),
        vector: (() => {
          if (Array.isArray(chunkData.vector)) {
            return chunkData.vector.map(Number);
          }
          return new Array(768).fill(0.0);
        })(),
        // 【新規】Firestore StructuredLabelを統合
        ...structuredLabelFlat
      };

      // LanceDBに追加
      await table.add([lanceData]);
      console.log(`  ✅ チャンク ${i + 1}/${chunks.length} を追加: ${chunk.title}`);
    }
  } catch (error) {
    console.error(`ページ追加エラー: ${error}`);
    throw error;
  }
}

// updateExistingPage メソッドも同様に修正
private async updateExistingPage(table: any, page: ConfluencePage, existingChunks: ConfluenceChunk[]): Promise<void> {
  // addNewPage と同様の実装
  // ...
}
```

## 📊 実装の詳細

### 1. Firestore StructuredLabel取得の追加

**追加箇所**:
- `addNewPage()` メソッド
- `updateExistingPage()` メソッド

**実装内容**:
```typescript
// ページ単位で1回のみFirestoreから取得
const structuredLabel = await getStructuredLabel(page.id);
if (structuredLabel) {
  const structuredLabelFlat = flattenStructuredLabel(structuredLabel);
  // すべてのチャンクに同じStructuredLabelを適用
}
```

### 2. エラーハンドリング

**方針**:
- Firestore取得エラーは警告のみ（同期を継続）
- StructuredLabelが存在しない場合は空のまま（既存の動作を維持）

**理由**:
- Firestore接続エラーで同期全体が失敗するのを防ぐ
- 既存のラベル（Confluence API）は保持される

### 3. パフォーマンスへの影響

**考慮事項**:
- Firestore取得はページ単位で1回のみ（チャンク単位ではない）
- 並列同期時は、各ページごとにFirestore取得が発生
- Firestoreクエリは高速（通常10-50ms）

**対策**:
- バッチ取得の検討（`getStructuredLabels(pageIds: string[])`を使用）
- キャッシュの検討（同じページの複数チャンクで再利用）

### 4. バッチ取得の最適化（オプション）

**実装内容**:
```typescript
// 並列同期時にバッチ取得を実装
async syncPagesParallel(pages: ConfluencePage[], concurrency: number = 10): Promise<SyncResult> {
  // 【新規】事前にFirestoreから全StructuredLabelを一括取得
  const pageIds = pages.map(p => p.id);
  const structuredLabelsMap = await getStructuredLabels(pageIds);
  
  // 各ページの同期時にStructuredLabelを使用
  for (const page of pages) {
    const structuredLabel = structuredLabelsMap.get(page.id);
    // ...
  }
}
```

**メリット**:
- Firestoreクエリ数を削減（N回 → 1回）
- パフォーマンス向上（特に大量ページの同期時）

**デメリット**:
- メモリ使用量の増加（全ラベルを一度に保持）
- 実装の複雑化

## 🔧 実装手順

### Step 1: 基本的な統合

1. `confluence-sync-service.ts`にimportを追加
   ```typescript
   import { getStructuredLabel } from './structured-label-service';
   import { flattenStructuredLabel } from './lancedb-schema-extended';
   ```

2. `addNewPage()` メソッドを修正
   - FirestoreからStructuredLabelを取得
   - `flattenStructuredLabel()`でフラット化
   - `lanceData`に統合

3. `updateExistingPage()` メソッドも同様に修正

### Step 2: エラーハンドリング

1. try-catchでFirestore取得を囲む
2. エラー時は警告のみ（同期を継続）
3. StructuredLabelが存在しない場合は空のまま

### Step 3: テスト

1. ローカル環境でテスト
   - StructuredLabelがあるページ
   - StructuredLabelがないページ
   - Firestore接続エラー時の動作

2. 本番環境でテスト
   - 既存の同期プロセスとの互換性確認
   - パフォーマンス確認

### Step 4: 最適化（オプション）

1. バッチ取得の実装
2. キャッシュの実装
3. パフォーマンステスト

## 📈 期待される効果

### メリット

1. ✅ **自動統合**: 通常の同期プロセスでFirestoreラベルが自動的に含まれる
2. ✅ **手間削減**: 別途同期スクリプトを実行する必要がなくなる
3. ✅ **データ整合性**: 同期時に常に最新のStructuredLabelが含まれる
4. ✅ **検索品質向上**: StructuredLabelが検索で活用される

### デメリット

1. ⚠️ **パフォーマンス**: Firestore取得が追加される（ページ単位で10-50ms）
2. ⚠️ **エラーハンドリング**: Firestore接続エラー時の処理が必要
3. ⚠️ **依存関係**: Firestore接続が必須になる（現在はオプション）

## 🎯 推奨実装

### 基本実装（推奨）

1. `addNewPage()` と `updateExistingPage()` にFirestore取得を追加
2. エラーハンドリングを実装（警告のみ、同期継続）
3. テストを実施

### 最適化（大量ページの場合）

1. バッチ取得を実装（`getStructuredLabels(pageIds: string[])`）
2. キャッシュを実装（同じページの複数チャンクで再利用）

## 🔗 関連ドキュメント

- [StructuredLabelスキーマ定義](../src/lib/lancedb-schema-extended.ts)
- [StructuredLabelサービス](../src/lib/structured-label-service.ts)
- [Confluence同期サービス](../src/lib/confluence-sync-service.ts)
- [Firestore同期スクリプト](../../scripts/sync-firestore-labels-to-lancedb.ts)

