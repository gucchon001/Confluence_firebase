# ベクトル検索エラー修正実施

**修正日**: 2025-11-02  
**エラーメッセージ**: `No vector column found to match with the query vector dimension: 768`

## 修正内容

### ✅ 実施済み

1. **`scripts/copy-lancedb-data.js`を作成**
   - Kuromoji辞書と同様のpostbuildコピースクリプト
   - `.lancedb`を`.next/standalone`にコピー

2. **`package.json`の`postbuild`を修正**

```diff
- "postbuild": "node scripts/copy-kuromoji-dict.js",
+ "postbuild": "node scripts/copy-kuromoji-dict.js && node scripts/copy-lancedb-data.js",
```

### 修正後のビルドフロー

```
prebuild
  ↓ conditional-download.js
  ↓ .lancedb を /workspace/.lancedb にダウンロード ✅
  
build
  ↓ next build
  ↓ .next/standalone に最小限のファイルをコピー
  ↓ .lancedb は除外される（正常） ✅
  
postbuild
  ↓ copy-kuromoji-dict.js ✅
  ↓ copy-lancedb-data.js ✅ ← 追加済み
  ↓ .lancedb を .next/standalone にコピー ✅
  
デプロイ
  ↓ .next/standalone がコンテナイメージになる
  ↓ .lancedb が含まれる ✅
  
実行時
  ↓ LanceDBが .lancedb を見つける ✅
  ↓ ベクトル検索成功 ✅
```

## 期待される効果

### 修正前

- ベクトル検索が失敗: `No vector column found`
- Kuromoji辞書は正常（copy-kuromoji-dict.jsあり）

### 修正後

- ベクトル検索が成功: LanceDBデータが利用可能
- クエリベクトルの次元数との一致が確認できる
- BM25検索と並行してハイブリッド検索が正常動作

## 次のステップ

### デプロイと検証

1. 変更をコミット＆プッシュ
2. Firebase App Hostingで自動デプロイを開始
3. ビルドログで以下を確認：

```
> nextn@0.1.0 postbuild
> node scripts/copy-kuromoji-dict.js && node scripts/copy-lancedb-data.js
✅ [PostBuild] Kuromoji辞書ファイルをコピー完了: 12ファイル
📦 [PostBuild] LanceDBデータをコピー中...
✅ [PostBuild] LanceDBデータをコピー完了: XXファイル
   総サイズ: XX.XX MB
   ✅ confluence.lance: XXファイル
```

4. デプロイ完了後、本番環境でベクトル検索をテスト
5. Cloud Loggingでエラーログを確認

### 検証クエリ例

```
質問: "ログイン認証の仕組みは？"
```

**期待される結果**:
- ✅ ベクトル検索が成功
- ✅ 関連する文書が返される
- ✅ `No vector column found`エラーが発生しない

## 修正ファイル

1. **新規作成**: `scripts/copy-lancedb-data.js`
2. **修正**: `package.json`（postbuildスクリプト）

## 関連ドキュメント

- 調査結果: `docs/troubleshooting/final-investigation-report.md`
- 根本原因: `docs/troubleshooting/root-cause-confirmed.md`
- 仮説分析: `docs/troubleshooting/hypothesis-analysis-and-verification.md`

---

**修正実施完了**

次はデプロイとビルドログの確認を行ってください。

