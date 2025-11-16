# GCSバージョン管理問題の分析と改善案

**作成日**: 2025-11-13  
**問題**: 古いGCSデータが残り、本番環境で古いバージョンが使用される

---

## 問題の概要

### 発見された問題
- **症状**: 本番環境で`structured_tags`が`null`のまま
- **原因**: GCSに古いLanceDBバージョンが残っており、本番環境が古いデータをダウンロードしていた
- **影響**: 検索結果の順位が正しく反映されない

### 根本原因

#### 1. LanceDBのバージョン管理の仕組みを理解していなかった

**LanceDBのバージョン管理**:
- LanceDBは`_versions/`ディレクトリにマニフェストファイルを保存
- 新しいデータを追加すると、新しいバージョンが作成される
- **古いバージョンは自動的に削除されない**
- 最新のマニフェストが参照するデータのみが使用される

**現在の実装の問題**:
```typescript
// scripts/upload-production-data.ts
// 単純にディレクトリを再帰的にアップロードするだけ
await uploadDirectory('.lancedb/confluence.lance', 'lancedb/confluence.lance', stats);
```

**問題点**:
- 古いバージョンのファイル（`_versions/`, `_transactions/`, `data/`）が残る
- GCSのストレージ容量が無駄に消費される
- 本番環境が古いバージョンをダウンロードする可能性がある

#### 2. アップロードスクリプトが「追加のみ」で「置き換え」ではない

**現在の動作**:
1. ローカルLanceDBをGCSにアップロード
2. 新しいバージョンが作成される
3. **古いバージョンは残る**

**期待される動作**:
1. 古いバージョンを削除（または最新のみ保持）
2. 新しいバージョンをアップロード
3. 最新バージョンのみがGCSに存在

#### 3. デプロイフローにクリーンアップ手順が組み込まれていない

**現在のデプロイフロー**:
```bash
# Step 1-4: データ同期とアップロード
npx tsx scripts/generate-structured-labels.ts 5000
npx tsx scripts/sync-firestore-labels-to-lancedb.ts
npx tsx scripts/create-lancedb-indexes.ts
npx tsx scripts/upload-production-data.ts  # ← 古いバージョンを削除しない
```

**問題点**:
- クリーンアップ手順が含まれていない
- 手動で`cleanup-lancedb-completely.ts`を実行する必要がある
- デプロイフローが複雑で、手順を忘れやすい

#### 4. バージョン管理のベストプラクティスが確立されていない

**現在の状況**:
- バージョン管理のドキュメントが不足
- クリーンアップのタイミングが不明確
- 古いバージョンを保持する必要があるかどうかが不明

---

## 改善案

### 改善案1: アップロード前に古いバージョンを削除（推奨）

**実装方法**:
`upload-production-data.ts`を修正して、アップロード前に古いバージョンを削除する

**メリット**:
- デプロイフローがシンプルになる
- 手動クリーンアップが不要
- 常に最新バージョンのみがGCSに存在

**デメリット**:
- 過去のバージョンに戻れなくなる（ロールバック不可）
- アップロード失敗時にデータが失われるリスク

**実装例**:
```typescript
// scripts/upload-production-data.ts に追加
async function cleanupOldVersions() {
  console.log('🧹 古いLanceDBバージョンを削除中...');
  const prefix = 'lancedb/confluence.lance/';
  const [files] = await bucket.getFiles({ prefix });
  
  if (files.length > 0) {
    console.log(`📊 削除対象: ${files.length}ファイル`);
    await Promise.all(files.map(file => file.delete()));
    console.log('✅ 古いバージョンを削除しました');
  }
}

async function main() {
  // アップロード前に古いバージョンを削除
  await cleanupOldVersions();
  
  // 新しいバージョンをアップロード
  await uploadDirectory('.lancedb/confluence.lance', 'lancedb/confluence.lance', stats);
}
```

### 改善案2: デプロイフローにクリーンアップ手順を組み込む

**実装方法**:
`deploy:data`スクリプトにクリーンアップ手順を追加

**メリット**:
- 既存のスクリプトを活用できる
- クリーンアップのタイミングが明確

**デメリット**:
- 手動でクリーンアップを実行する必要がある
- 手順を忘れる可能性がある

**実装例**:
```json
// package.json
{
  "scripts": {
    "deploy:data": "tsx scripts/generate-structured-labels.ts 5000 && tsx scripts/sync-firestore-labels-to-lancedb.ts && tsx scripts/create-lancedb-indexes.ts && tsx scripts/cleanup-lancedb-completely.ts --execute && tsx scripts/upload-production-data.ts && tsx scripts/verify-production-readiness.ts"
  }
}
```

### 改善案3: バージョン管理のベストプラクティスを確立

**実装方法**:
1. バージョン管理ポリシーを決定
2. ドキュメントを作成
3. 自動化スクリプトを改善

**推奨ポリシー**:
- **最新バージョンのみ保持**: 本番環境では最新バージョンのみを保持
- **バックアップ**: 重要な更新前にバックアップを作成
- **ロールバック**: 必要に応じてバックアップから復元

---

## 推奨される改善策

### 即座に実施すべき改善

1. **`upload-production-data.ts`を修正**
   - アップロード前に古いバージョンを削除する機能を追加
   - オプションで「完全削除」または「最新のみ保持」を選択可能にする

2. **`deploy:data`スクリプトを更新**
   - クリーンアップ手順を組み込む
   - エラーハンドリングを改善

3. **ドキュメントを更新**
   - バージョン管理の仕組みを説明
   - デプロイフローにクリーンアップ手順を明記

### 長期的な改善

1. **バックアップ機能の強化**
   - 重要な更新前に自動バックアップを作成
   - バックアップからの復元機能を実装

2. **監視とアラート**
   - GCSのストレージ使用量を監視
   - 古いバージョンが一定数以上残っている場合にアラート

3. **自動クリーンアップ**
   - 定期的に古いバージョンを自動削除
   - 保持期間を設定可能にする

---

## 実装優先度

| 改善案 | 優先度 | 実装難易度 | 効果 |
|--------|--------|------------|------|
| `upload-production-data.ts`の修正 | **高** | 低 | 高 |
| `deploy:data`スクリプトの更新 | **高** | 低 | 中 |
| ドキュメントの更新 | **中** | 低 | 中 |
| バックアップ機能の強化 | 中 | 中 | 中 |
| 監視とアラート | 低 | 高 | 低 |
| 自動クリーンアップ | 低 | 中 | 低 |

---

## 結論

**根本原因**:
1. LanceDBのバージョン管理の仕組みを理解していなかった
2. アップロードスクリプトが「追加のみ」で「置き換え」ではない
3. デプロイフローにクリーンアップ手順が組み込まれていない
4. バージョン管理のベストプラクティスが確立されていない

**推奨される対応**:
1. **即座に**: `upload-production-data.ts`を修正して、アップロード前に古いバージョンを削除
2. **短期**: `deploy:data`スクリプトを更新して、クリーンアップ手順を組み込む
3. **中期**: バージョン管理のドキュメントを作成し、ベストプラクティスを確立

これにより、今後同様の問題が発生することを防ぐことができます。

