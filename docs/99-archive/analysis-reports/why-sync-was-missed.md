# 本番環境のLanceDB同期が漏れた理由の分析

## 問題の概要
- **ローカル環境**: `structured_tags`がLanceDBに正しく同期されている
- **本番環境**: `structured_tags`が`null`（同期されていない）

## 手順が漏れた理由

### 1. デプロイフローの不完全な実行

`deployment-guide.md`のセクション5.2「データ同期」には以下の手順が記載されています：

```bash
npx tsx scripts/generate-structured-labels.ts 5000
npx tsx scripts/sync-firestore-labels-to-lancedb.ts
npx tsx scripts/create-lancedb-indexes.ts
npx tsx scripts/upload-production-data.ts  # ← これが実行されていない
```

**問題点:**
- ローカル環境で`sync-firestore-labels-to-lancedb.ts`を実行したが、その後の`upload-production-data.ts`が実行されていない
- ローカル環境のLanceDBには`structured_tags`が反映されているが、GCS（本番環境）には反映されていない

### 2. 手順の依存関係の理解不足

**正しいフロー:**
1. FirestoreにStructuredLabelを生成（`generate-structured-labels.ts`）
2. ローカルLanceDBに同期（`sync-firestore-labels-to-lancedb.ts`）
3. **ローカルLanceDBをGCSにアップロード（`upload-production-data.ts`）** ← これが漏れた
4. 本番環境（App Hosting）がGCSからLanceDBバンドルをダウンロード

**実際に実行されたフロー:**
1. FirestoreにStructuredLabelを生成 ✅
2. ローカルLanceDBに同期 ✅
3. GCSへのアップロード ❌（実行されていない）
4. 本番環境は古いLanceDBバンドルを使用

### 3. チェックリストの確認不足

`deployment-guide.md`のセクション4「デプロイ前チェックリスト」には以下が記載されています：

| カテゴリ | 項目 | 状態 |
|----------|------|------|
| Cloud Storage | `npx tsx scripts/upload-production-data.ts` を実行しアップロード成功 | ☐ |

このチェックリスト項目が確認されていなかった可能性があります。

## 根本原因

1. **手順の分離**: `sync-firestore-labels-to-lancedb.ts`と`upload-production-data.ts`が別々のコマンドとして実行される必要があるが、連続して実行されなかった
2. **ローカルと本番の環境差**: ローカル環境で同期が成功したため、本番環境でも反映されていると誤認した
3. **検証不足**: 本番環境のLanceDBデータを確認する手順（`check-production-lancedb-page703594590.ts`）が実行されていなかった

## 今後の対策

### 1. デプロイフローの改善

```bash
# 一括実行スクリプトの作成
npm run deploy:data
```

このスクリプトで以下を順次実行：
1. `generate-structured-labels.ts`
2. `sync-firestore-labels-to-lancedb.ts`
3. `create-lancedb-indexes.ts`
4. `upload-production-data.ts`
5. アップロード結果の検証

### 2. 自動検証の追加

`upload-production-data.ts`実行後に、以下を自動検証：
- アップロードされたファイル数とサイズ
- サンプルページ（例: `pageId=703594590`）の`structured_tags`が正しくアップロードされているか

### 3. チェックリストの強化

デプロイ前チェックリストに以下を追加：
- [ ] 本番環境のLanceDBデータをダウンロードして検証（`check-production-lancedb-page703594590.ts`）
- [ ] サンプルページの`structured_tags`が正しく反映されているか確認

### 4. ドキュメントの改善

`deployment-guide.md`に以下を追加：
- 各手順の目的と依存関係を明記
- 手順をスキップした場合の影響を明記
- 検証手順を必須化

