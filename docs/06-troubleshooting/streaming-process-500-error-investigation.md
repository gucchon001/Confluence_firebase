# ストリーミング処理API HTTP 500エラー調査

**調査日**: 2025-01-XX  
**エラーメッセージ**: HTTP 500 - HTMLレスポンスが返される  
**影響範囲**: `/api/streaming-process` エンドポイント

## 問題の概要

パフォーマンステスト実行時に、`/api/streaming-process` エンドポイントがHTTP 500エラーを返し、HTMLレスポンス（Next.jsのエラーページ）が返されている。

### エラーの特徴

- **ステータスコード**: 500
- **レスポンス形式**: HTML（Next.jsのエラーページ）
- **発生タイミング**: パフォーマンステスト実行時
- **影響**: すべてのクエリでエラーが発生

## 調査結果

### 1. 型エラーの確認

✅ **型エラーなし**: `npm run typecheck` で型エラーは検出されなかった

### 2. エラーハンドリングの確認

✅ **エラーハンドリング実装済み**: 
- `src/app/api/streaming-process/route.ts` の799-866行目でエラーハンドリングが実装されている
- `NextResponse.json()` でJSONレスポンスを返すように実装されている

### 3. 考えられる原因

#### 原因1: サーバーが起動していない、または別のポートで起動している

**確認方法**:
```bash
# 開発サーバーが起動しているか確認
npm run dev

# ポート9004でリッスンしているか確認
netstat -ano | findstr :9004
```

**対処方法**:
- 開発サーバーを起動: `npm run dev`
- ポートが正しいか確認: `package.json` の `dev` スクリプトで `-p 9004` が指定されている

#### 原因2: 未処理の例外が発生している

エラーハンドリングが実装されているにもかかわらず、HTMLレスポンスが返される場合、以下の可能性がある：

1. **エラーがエラーハンドリングの外で発生している**
   - 例: ミドルウェア、Next.jsの内部処理でのエラー

2. **非同期エラーが適切にキャッチされていない**
   - 例: Promise rejection が適切に処理されていない

3. **Next.jsのエラーバウンダリーが動作している**
   - 例: コンポーネントレベルのエラーがAPIルートに影響している

#### 原因3: リクエストの形式が正しくない

**確認項目**:
- リクエストボディの形式
- ヘッダーの設定
- Content-Type の設定

### 4. 改善したエラーハンドリング

テストスクリプト（`src/tests/test-api-performance.ts`）を改善し、HTMLレスポンスの場合に詳細なエラー情報を取得できるようにした：

```typescript
if (!response.ok) {
  const contentType = response.headers.get('content-type');
  
  if (contentType?.includes('text/html')) {
    // HTMLレスポンスの場合、エラーメッセージを抽出
    const errorMatch = errorText.match(/<title>([^<]+)<\/title>/i) || 
                      errorText.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                      errorText.match(/Error: ([^\n<]+)/i);
    
    if (errorMatch) {
      errorMessage += ` - Next.js Error Page: ${errorMatch[1]}`;
    }
    
    // HTMLの一部をログに出力（デバッグ用）
    console.error('   📄 HTMLレスポンスの先頭500文字:', errorText.substring(0, 500));
  }
}
```

## 次のステップ

### 1. サーバーログの確認

開発サーバーのログを確認し、実際のエラー原因を特定する：

```bash
# 開発サーバーを起動してログを確認
npm run dev
```

### 2. エラーログの確認

以下のログを確認：
- `❌ 処理ステップストリーミングAPIエラー:`
- `❌ 詳細エラー情報:`
- `❌ ストリーミング要約エラー:`

### 3. デバッグ方法

1. **開発サーバーを起動**
   ```bash
   npm run dev
   ```

2. **パフォーマンステストを実行**
   ```bash
   npx tsx src/tests/test-api-performance.ts
   ```

3. **サーバーログとテスト出力を比較**
   - サーバーログにエラーが出力されているか確認
   - テスト出力のHTMLレスポンスの内容を確認

### 4. 関連するトラブルシューティング事例

過去の類似事例：
- `docs/99-archive/troubleshooting/final-investigation-report.md`: ベクトル検索エラーの調査
- `docs/99-archive/troubleshooting/root-cause-confirmed.md`: 根本原因の特定方法

## 推奨される対処方法

### 即座に実施すべき確認

1. ✅ **開発サーバーが起動しているか確認**
2. ✅ **ポート9004でリッスンしているか確認**
3. ✅ **サーバーログを確認してエラーメッセージを特定**

### エラーが継続する場合

1. **APIエンドポイントのエラーハンドリングを強化**
   - すべての非同期処理を try-catch で囲む
   - Promise rejection を適切に処理する

2. **Next.jsのエラーログを確認**
   - `.next` ディレクトリのログを確認
   - ブラウザの開発者ツールでネットワークタブを確認

3. **最小限のリクエストで再現する**
   - シンプルなリクエストでエラーが再現するか確認
   - リクエストボディを最小限にしてテスト

## 関連ドキュメント

- [パフォーマンステスト仕様](../05-testing/05.04-performance-tests.md)
- [エラーハンドリング仕様](../01-architecture/03.03.02-error-handling.md)
- [APIエンドポイント実装](../01-architecture/03.01.01-genkit-design.md)

---

**調査状況**: 進行中  
**次のアクション**: サーバーログの確認とエラー原因の特定

