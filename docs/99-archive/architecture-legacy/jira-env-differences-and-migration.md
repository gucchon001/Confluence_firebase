# Jira Integration Environment Differences & Migration Plan

**作成日**: 2025-11-09  
**作成者**: GPT-5 Codex  
**対象**: Jira 個別検索 Phase 1

---

## 1. 環境別主要構成

| 項目 | ローカル環境 | 本番環境 |
|------|--------------|----------|
| アプリ実行 | Next.js Dev Server (`npm run dev`) | Firebase App Hosting (Gen1) |
| データ同期 | 手動実行 (`npm run sync:jira` 予定) | Cloud Functions / Cloud Run バッチ or CLI 手動トリガー |
| Firestore | 開発プロジェクトを直接使用（Emulator非使用） | 本番プロジェクト (asia-northeast1) |
| LanceDB | ローカル `.lancedb/` ディレクトリ | Cloud Storage からダウンロード後、コンテナローカルに配置 |
| 認証 | Firebase Auth (ドメイン制限)、開発用テストユーザー | Firebase Auth (本番ドメイン制限) |
| Jira 認証情報 | `.env.local` で管理 | Firebase Config / Secrets Manager で管理 |
| ログ・監視 | コンソールログ、`tmp/` の JSON 出力 | Cloud Logging, Error Reporting, JiraSyncJobs コレクション |
| データ件数 | サンプル or 全件 | 全件 (プロジェクト CTJ) |

---

## 2. 環境差分のポイント

1. **データ同期**
   - ローカル: 手動で sync スクリプトを実行。再実行・差分検証に使用。
   - 本番: Cloud Scheduler or 手動トリガーで全件バッチを実行。実行履歴を `jiraSyncJobs` に記録。

2. **データ保管**
   - ローカル: Firestore 開発プロジェクトに直接保存。必要に応じて削除→再同期で検証。
   - 本番: Firestore 本番コレクションと LanceDB バイナリを Cloud Storage に保持し、App Hosting 起動時にダウンロード。

3. **認証情報**
   - ローカル: `.env.local` に Jira API キー、ユーザー、プロジェクトキーを設定。
   - 本番: Firebase Config (`firebase functions:config:set`) または Secrets Manager で安全に管理。App Hosting では `apphosting.yaml` にも設定。

4. **モニタリング**
   - ローカル: CLI／ログ初見で確認。
   - 本番: Cloud Logging, Slack 通知等を利用。`jiraSyncJobs` コレクションで成功/失敗を可視化。

---

## 3. 移行計画（Phase 1）

### Step 0: 準備
- [ ] Firestore に `jiraIssues`, `jiraSyncJobs`, `jiraAttachments`（任意）を作成。セキュリティルール更新。
- [ ] LanceDB に Jira 専用テーブル `jira_issues` を追加。スキーマを Confluence と整合。
- [ ] `.env` / `.env.local` に Jira 認証情報 (`JIRA_BASE_URL`, `JIRA_USER_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY`) を設定。
- [ ] テストスクリプト `npm run test:jira` で疎通確認。

### Step 1: ローカル同期テスト
- [ ] `npm run inspect:jira-issues` / `scripts/search-jira.ts` を用いてサンプルデータの取得・整形確認。
- [ ] `jira-data-flow-lancedb.md` に沿って LanceDB へデータ投入。検索 API のレスポンス確認。
- [ ] `docs/testing/jira-quality-testcases.md` のケースで回答品質を目視検証。

### Step 2: 本番同期初回実行
- [ ] Cloud Functions / Cloud Run に同期タスクをデプロイ。手動トリガーで全件同期。
- [ ] Firestore `jiraIssues` の件数、一部ドキュメントの整形内容を確認。
- [ ] LanceDB データが本番環境でも問題なく読み込まれるか確認。

### Step 3: UI リリース (Phase 1)
- [ ] `source=jira` タブを有効化し、Confluence タブと並列動作を確認。
- [ ] `docs/architecture/confluence-jira-integration-plan.md` に沿ったレスポンス項目（サマリー・ステータスなど）が表示されるか確認。
- [ ] 通知・監視（`jiraSyncJobs` ログ、Cloud Logging）を有効化。

### Step 4: 移行完了チェック
- [ ] テストケース（CTJ-4714 詳細、求人掲載順位関連課題一覧など）の回答品質を再確認。
- [ ] 本番デプロイ後、1週間程度は同期ジョブの結果を監視し、エラー時のリトライ手順を整備。

---

## 4. 今後の予定 (Phase 2 以降)

- 統合検索モード（Hybrid）の追加時に、ローカル環境では `source=hybrid` で新 API の検証、本番では Feature Flag を使い段階的にロールアウト。
- ダッシュボード指標の集計は、ローカルでクエリを PoC → 本番の BigQuery or Firestore 集計へ反映。
- Genkit への移行は、既存ロードマップ（`archive/architecture-legacy/genkit-migration-and-expansion-roadmap.md`）に準拠してフェーズ分け予定。
