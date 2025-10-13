# GitHub Actions でのデータ同期自動化

## 概要

Firebase Cloud Functionsの制約により、スケジュールされた関数からプロジェクトルートのスクリプトを実行できないため、GitHub Actionsを使用してConfluenceデータの自動同期を実装しています。

## なぜGitHub Actionsを使用するのか

### Firebase Cloud Functionsの制約

1. **デプロイされるコードの制限**
   - `functions/`ディレクトリ内のコードのみがデプロイされる
   - プロジェクトルート（`src/scripts/`など）のファイルは含まれない

2. **実行環境の制約**
   ```
   /workspace/              ← Cloud Functions環境
   ├── lib/                 ← functions/src/のコンパイル結果のみ
   ├── package.json         ← functions/package.jsonのみ
   └── node_modules/        ← functions/の依存関係のみ
   ```

3. **スクリプト実行の失敗**
   ```bash
   npm error Missing script: "sync:confluence:differential"
   # ../src/scripts/batch-sync-confluence.ts が存在しない
   ```

### GitHub Actionsの利点

✅ **既存スクリプトの活用**
- プロジェクト全体がチェックアウトされる
- `npm run sync:confluence:differential`をそのまま実行可能

✅ **簡単な設定**
- YAMLファイルのみで完結
- シークレット管理が容易

✅ **無料枠が充実**
- パブリックリポジトリ: 無制限
- プライベートリポジトリ: 月2,000分

✅ **柔軟なスケジュール**
- Cron形式で詳細なスケジュール設定
- 手動実行（`workflow_dispatch`）も可能

## セットアップ手順

### 1. GitHub Secretsの設定

GitHubリポジトリの設定で、以下のシークレットを追加してください：

1. **リポジトリページ** → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**をクリック

**追加するシークレット:**

| Name | Value | 説明 |
|------|-------|------|
| `CONFLUENCE_API_TOKEN` | `***` | Confluence API トークン |
| `GEMINI_API_KEY` | `***` | Gemini API キー |

**取得方法:**
```bash
# ローカルの.env.localから取得
cat .env.local | grep CONFLUENCE_API_TOKEN
cat .env.local | grep GEMINI_API_KEY
```

### 2. Workflowファイルの確認

以下のワークフローファイルがデプロイされています：

**`.github/workflows/sync-confluence.yml`**
- **実行タイミング**: 毎日午前2時（JST）
- **処理内容**: 差分同期 → Cloud Storageアップロード

**`.github/workflows/weekly-full-sync.yml`**
- **実行タイミング**: 毎週日曜日午前3時（JST）
- **処理内容**: 完全同期 → Cloud Storageアップロード

### 3. 手動実行

**GitHub リポジトリページで:**

1. **Actions** タブをクリック
2. 実行したいワークフローを選択
   - `Sync Confluence Data`（差分同期）
   - `Weekly Full Sync`（完全同期）
3. **Run workflow** ボタンをクリック
4. **Run workflow**を再度クリックして実行

**差分同期と完全同期の選択:**
- `Sync Confluence Data`ワークフローでは、手動実行時に同期タイプを選択可能
  - `differential`: 差分同期（デフォルト）
  - `full`: 完全同期

### 4. 実行ログの確認

**GitHub リポジトリページで:**

1. **Actions** タブをクリック
2. 確認したいワークフロー実行をクリック
3. 各ステップの詳細ログを確認

**成功時のログ例:**
```
✅ Confluence data sync completed successfully
📊 Timestamp: 2025-10-13 17:00:00 UTC
```

**失敗時:**
- エラーメッセージとスタックトレースが表示される
- ローカルで`npm run sync:confluence:differential`を実行して問題を特定

## スケジュール

| ワークフロー | 頻度 | 実行時刻（JST） | Cron（UTC） |
|------------|------|---------------|------------|
| 差分同期 | 毎日 | 午前2時 | `0 17 * * *` |
| 完全同期 | 毎週日曜 | 午前3時 | `0 18 * * 6` |

**タイムゾーン変換:**
- JST = UTC + 9時間
- JST 2:00 = UTC 17:00（前日）
- JST 3:00（日曜） = UTC 18:00（土曜）

## トラブルシューティング

### エラー: Secrets not found

**症状:**
```
Error: Process completed with exit code 1.
Environment variable not set
```

**解決策:**
1. GitHub Secretsが正しく設定されているか確認
2. シークレット名のスペルが正確か確認（大文字小文字も一致させる）

### エラー: npm install failed

**症状:**
```
npm ERR! code ENOENT
npm ERR! syscall open
```

**解決策:**
1. `package.json`が正しくコミットされているか確認
2. Node.jsバージョンが適切か確認（22を使用）

### エラー: Cloud Storage upload failed

**症状:**
```
Error: Failed to upload to Cloud Storage
Permission denied
```

**解決策:**
1. GitHubのサービスアカウントがCloud Storageへのアクセス権限を持っているか確認
2. `GOOGLE_CLOUD_PROJECT`環境変数が正しく設定されているか確認
3. 必要に応じて、Google Cloud IAMで権限を追加

## モニタリング

### 定期的な確認事項

**週次:**
- GitHub Actionsの実行履歴を確認
- 失敗したワークフローがないか確認

**月次:**
- GitHub Actionsの使用時間を確認（無料枠の範囲内か）
- Cloud Storageのデータ更新日時を確認

### アラート設定（オプション）

GitHub Actionsの失敗時にSlackやメールで通知を受け取ることができます：

```yaml
# .github/workflows/sync-confluence.yml に追加
- name: Notify on failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## 参考リンク

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow syntax for GitHub Actions](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Events that trigger workflows](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows)

