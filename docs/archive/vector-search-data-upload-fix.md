# Vector Search データアップロード修正

## 問題の特定

ConfluenceのベクトルデータがVertex AI Vector Searchに正しくアップロードされていない問題を特定しました。

### 特定された問題点

1. **Confluenceからのデータ取得制限**:
   - API呼び出しで一度に取得するページ数が25に制限されていた
   - ページネーションのロジックに問題があり、全ページを取得できていなかった

2. **デバッグモードの有効化**:
   - `isDebugMode`が有効になっており、1バッチ（5レコード）しか処理されていなかった

3. **ページ制限の設定**:
   - `pageLimit`環境変数によって処理対象のページ数が制限されていた

## 実施した修正

1. **Confluenceからのデータ取得数の増加**:
   ```typescript
   // 修正前
   limit: 25,
   
   // 修正後
   limit: 100, // 一度に取得するページ数を25から100に増やす
   ```

2. **ページネーションロジックの修正**:
   ```typescript
   // 修正前
   hasMore = size === limit && allResults.length < limit;
   
   // 修正後
   hasMore = size === limit; // 取得したページ数がlimitと同じ場合は次のページがある可能性がある
   ```

3. **デバッグモードの無効化**:
   ```typescript
   // 修正前
   const isDebugMode = process.env.DEBUG_VECTOR_SEARCH === 'true' || config.debug?.vector_search === 'true';
   const maxBatches = isDebugMode ? 1 : batches.length;
   
   // 修正後
   const isDebugMode = false; // 明示的にfalseに設定
   const maxBatches = batches.length; // 常に全バッチを処理
   ```

4. **ページ制限の解除**:
   ```typescript
   // 修正前
   const pageLimit = process.env.INGEST_PAGE_LIMIT ? parseInt(process.env.INGEST_PAGE_LIMIT, 10) : undefined;
   const targetPages = pageLimit ? pages.slice(0, pageLimit) : pages;
   
   // 修正後
   const targetPages = pages;
   console.log(`[ingest] Processing all ${pages.length} pages`);
   ```

5. **バッチサイズの増加**:
   ```typescript
   // 修正前
   const BATCH_SIZE = 5;
   
   // 修正後
   const BATCH_SIZE = 50;
   ```

## 環境設定の更新

1. **Firebase環境変数の更新**:
   ```bash
   firebase functions:config:set debug.vector_search=false
   firebase functions:config:unset ingest.page_limit
   ```

2. **関数の再デプロイ**:
   ```bash
   firebase deploy --only functions
   ```

## 次のステップ

1. **Vector Searchエンドポイントの設定確認**:
   - 現在も`400 Bad Request`エラーが発生しているため、エンドポイントの設定を確認する必要があります
   - `docs/vector-search-endpoint-guide.md`の手順に従ってエンドポイントをデプロイしてください

2. **Vector Search APIの検索パラメータ最適化**:
   - 検索結果の品質向上のため、`distanceThreshold`や`neighborCount`を調整する
   - 現在の設定: `distanceThreshold: 0.8`, `neighborCount: 5`

3. **エラーハンドリングの強化**:
   - エラーメッセージの詳細化
   - リトライロジックの調整

## 確認方法

1. **Cloud Functionsのログ確認**:
   ```bash
   firebase functions:log --only syncConfluenceData
   ```

2. **Vector Searchインデックスの確認**:
   - Google Cloud ConsoleのVertex AI > Vector Searchセクションでインデックスの状態を確認
   - データポイント数が増加していることを確認

3. **アプリケーションでのテスト**:
   - フォールバックロジックを無効化した状態でアプリケーションを実行
   - 検索結果が返ってくるか確認
