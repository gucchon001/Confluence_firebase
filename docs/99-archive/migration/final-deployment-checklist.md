# 最終デプロイチェックリスト

## ✅ 完了項目

### 1. TypeScriptエラー修正 ✅
- `src/lib/title-search-service.ts`: 修正完了
- `src/lib/lancedb-utils.ts`: 修正完了
- `npm run typecheck`: エラーなし

### 2. ローカルデータベース確認 ✅
- スキーマ: `page_id`フィールドが存在 ✅
- パフォーマンス: 28ms（目標: < 100ms） ✅
- 総行数: 1,229行 ✅

## 🚨 重要: 本番データベースの再アップロード

本番環境でスキーマエラーが発生している可能性があります：
- **エラー**: `No field named page_id. Did you mean 'pageId'?`
- **原因**: Cloud Storage上のデータベースが古い`pageId`スキーマのまま

### 対処方法

#### ステップ1: マイグレーション済みデータベースの確認
```bash
npm run prepare:production
```

**確認ポイント**:
- ✅ `page_id`フィールドが存在する
- ✅ `pageId`フィールドが存在しない
- ✅ クエリが高速（< 100ms）

#### ステップ2: データベースの再アップロード
```bash
npm run upload:production-data
```

**確認ポイント**:
- アップロードが成功した
- ファイル数が想定通り（28ファイル以上）
- エラーが発生していない

#### ステップ3: コードのコミットとプッシュ（TypeScriptエラー修正）
```bash
git add .
git commit -m "fix: resolve TypeScript errors in title-search-service and lancedb-utils"
git push
```

## 📋 デプロイ手順

### Phase 1: データベースのアップロード（最優先）

**重要**: コードをデプロイする前に、必ず`page_id`スキーマのデータベースをアップロードしてください。

```bash
npm run upload:production-data
```

### Phase 2: コードのコミットとプッシュ

```bash
git add .
git commit -m "fix: resolve TypeScript errors and ensure page_id schema consistency"
git push
```

### Phase 3: デプロイ確認

Firebase App Hostingを使用している場合、自動デプロイが開始されます。

**Firebase Consoleで確認**:
```
https://console.firebase.google.com/project/confluence-copilot-ppjye/apphosting
```

## 🎯 成功基準

以下の条件がすべて満たされれば成功：

1. ✅ TypeScriptエラーが解決されている
2. ✅ ローカルデータベースが`page_id`スキーマである
3. ✅ 本番データベースが`page_id`スキーマである（Cloud Storageにアップロード済み）
4. ✅ 本番環境でエラーが発生していない
5. ✅ パフォーマンスが改善されている（< 100ms）

## ⚠️ 注意事項

- **データベースのアップロードは必須**: コードだけをデプロイしても、データベースが古いスキーマのままではエラーが発生します
- **デプロイ順序**: データベース → コードの順でデプロイしてください
- **バックアップ**: 問題が発生した場合のロールバック手順を確認してください

