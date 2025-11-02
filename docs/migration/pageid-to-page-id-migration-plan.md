# pageId → page_id マイグレーション計画

## 📊 影響範囲分析結果

### 総発生数
- **合計**: 658 occurrences
- **カテゴリ別**:
  - Type定義: 148 occurrences
  - Query (クエリ): 28 occurrences
  - API (レスポンス): 55 occurrences
  - Schema (スキーマ): 1 occurrence
  - Test (テスト): 69 occurrences
  - Other (その他): 357 occurrences

### 重要度別
- **Critical (重要)**: 177 occurrences
- **High (高)**: 55 occurrences
- **Medium (中)**: 426 occurrences

### 影響の大きいファイル Top 10

1. `src/lib/lancedb-search-client.ts`: 39 occurrences (9 critical, 9 high)
2. `scripts/compare-lancedb-before-after.ts`: 32 occurrences (5 critical)
3. `src/lib/kg-search-service.ts`: 25 occurrences (4 critical, 4 high)
4. `src/lib/confluence-sync-service.ts`: 25 occurrences (13 critical)
5. `src/ai/flows/retrieve-relevant-docs-lancedb.ts`: 24 occurrences (8 critical, 4 high)
6. `scripts/test-get-all-chunks-by-pageid.ts`: 21 occurrences (6 critical)
7. `scripts/debug-kg-page-fetch.ts`: 19 occurrences (8 critical, 2 high)
8. `scripts/debug-177-pageid-field.ts`: 16 occurrences (4 critical)
9. `src/lib/kg-label-builder.ts`: 15 occurrences
10. `src/lib/structured-label-service.ts`: 14 occurrences (3 critical)

## 🔍 主要な型定義への影響

### 1. `src/types/search.ts`
```typescript
export interface LanceDBRow {
  pageId: number; // ← 変更が必要
}

export interface SearchResult {
  pageId: number; // ← 変更が必要
}
```

### 2. `src/lib/hybrid-search-engine.ts`
```typescript
export interface HybridSearchResult {
  pageId: number; // ← 変更が必要
}
```

### 3. `src/lib/lunr-search-client.ts`
```typescript
export interface LunrSearchResult {
  pageId: number; // ← 変更が必要
}
```

### 4. `src/types/knowledge-graph.ts`
```typescript
export interface KGNode {
  pageId?: string; // ← 変更が必要（文字列型）
}
```

### 5. `src/lib/lancedb-schema-extended.ts`
```typescript
export interface ExtendedLanceDBRecord {
  pageId: string; // ← 変更が必要
}
```

## 🚨 重要なクエリ箇所

### 1. `src/ai/flows/retrieve-relevant-docs-lancedb.ts`
```typescript
// Line 439: クエリ条件
.where(`\`pageId\` = ${numericPageId}`)
// ↓ 変更後
.where(`\`page_id\` = ${numericPageId}`)
```

### 2. `src/lib/lancedb-search-client.ts`
```typescript
// Line 1195: クエリ条件
.where(`\`pageId\` = '${pageId}'`)
// ↓ 変更後
.where(`\`page_id\` = '${pageId}'`)
```

### 3. `src/lib/confluence-sync-service.ts`
```typescript
// Line 558: フィルタリング
.filter((chunk: any) => chunk.pageId === parseInt(pageId))
// ↓ 変更後
.filter((chunk: any) => chunk.page_id === parseInt(pageId))
```

## 📋 マイグレーション戦略

### Phase 1: スキーマ定義の変更
1. `src/lib/lancedb-schema-extended.ts`: `pageId` → `page_id`
2. `src/lib/lancedb-schema.ts`: `pageId` → `page_id`
3. `src/lib/lancedb-client.ts`: スキーマ定義の更新

### Phase 2: データベースクエリの変更
1. `src/ai/flows/retrieve-relevant-docs-lancedb.ts`: クエリ条件の変更
2. `src/lib/lancedb-search-client.ts`: クエリ条件の変更
3. `src/lib/confluence-sync-service.ts`: フィルタリング条件の変更

### Phase 3: 型定義の変更
1. `src/types/search.ts`: インターフェースの変更
2. `src/lib/hybrid-search-engine.ts`: インターフェースの変更
3. `src/lib/lunr-search-client.ts`: インターフェースの変更
4. `src/types/knowledge-graph.ts`: インターフェースの変更

### Phase 4: APIレスポンスの変換
- **重要**: APIレスポンスでは`pageId`を維持し、内部処理でのみ`page_id`を使用する
- または、APIレスポンスも`page_id`に変更し、クライアント側も更新する

### Phase 5: テストコードの更新
1. すべてのテストファイルの`pageId`参照を`page_id`に変更
2. テストデータの更新

## ⚠️ 注意事項

### APIレスポンスへの影響
- **Frontend/Client側への影響**: APIレスポンスが`pageId`から`page_id`に変更されると、フロントエンド側も修正が必要
- **推奨**: 内部処理では`page_id`を使用し、APIレスポンスでは`pageId`を維持（マッピングレイヤーを追加）

### データベースマイグレーション
- **既存データ**: `.lancedb`データベースの再構築が必要
- **バックアップ**: マイグレーション前に必ずバックアップを取得

### 段階的リリース
1. **ローカル検証**: テストデータベースで動作確認（完了）
2. **ステージング環境**: ステージング環境で検証
3. **本番環境**: 本番データのバックアップ後に適用

## 🧪 テスト戦略

### Unit Tests
- すべての型定義のテスト
- クエリ関数のテスト
- データ変換関数のテスト

### Integration Tests
- APIエンドポイントのテスト
- データベースクエリのテスト
- エンドツーエンドのテスト

### Performance Tests
- インデックスが正常に動作することを確認
- クエリパフォーマンスの確認（目標: < 100ms）

## 📝 チェックリスト

### 事前準備
- [ ] 影響範囲の分析（完了）
- [ ] バックアップ戦略の確認
- [ ] ロールバック計画の作成

### 実装
- [ ] スキーマ定義の変更
- [ ] データベースクエリの変更
- [ ] 型定義の変更
- [ ] APIレスポンスの変換（必要に応じて）
- [ ] テストコードの更新

### 検証
- [ ] ローカル環境でのテスト
- [ ] ステージング環境でのテスト
- [ ] パフォーマンステスト

### デプロイ
- [ ] 本番データのバックアップ
- [ ] マイグレーションスクリプトの実行
- [ ] 動作確認
- [ ] ロールバック準備

## 🔄 次のステップ

1. **APIレスポンスの互換性確認**: フロントエンド側への影響を調査
2. **段階的実装**: Phase 1から順に実装・テスト
3. **パフォーマンス検証**: インデックスの効果を確認
4. **本番適用**: 十分なテスト後に本番環境に適用

