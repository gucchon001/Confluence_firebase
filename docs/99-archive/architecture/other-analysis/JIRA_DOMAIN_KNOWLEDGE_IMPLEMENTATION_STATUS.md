# Jira課題へのドメイン知識統合 - 実装状況

**作成日**: 2025年1月  
**最終更新**: 2025年1月

---

## 📊 実装状況サマリー

| Phase | ステータス | 進捗 |
|-------|----------|------|
| Phase 1: auto-label-flow.tsのJira対応 | ✅ 完了 | 100% |
| Phase 2: Jira課題用のStructuredLabel生成スクリプト | 🟡 実装済み（テスト中） | 90% |
| Phase 3: LanceDB jira_issuesテーブルへの統合 | ⏳ 未実装 | 0% |
| Phase 4: データ同期と本番環境へのデプロイ | ⏳ 未実装 | 0% |

---

## Phase 1: auto-label-flow.tsのJira対応 ✅

### 実装完了項目

1. **入力スキーマの拡張** ✅
   - `source: 'confluence' | 'jira'`を追加
   - `issueType`, `status`, `priority`（Jira特有フィールド）を追加

2. **プロンプトの調整** ✅
   - ソースに応じて「Confluenceページ」/「Jira課題」を切り替え
   - Jira特有情報（種別、ステータス、優先度）をプロンプトに含める

3. **ルールベース生成の調整** ✅
   - Jiraの場合は既存の`status`を活用
   - ドメイン推測は共通ロジックを使用

4. **Jiraステータスマッピング関数の追加** ✅
   - `mapJiraStatusToStructuredStatus`関数を実装
   - 完了状態（approved）、進行中状態（review）、作成中状態（draft）に対応

### テスト結果

- ✅ Jiraステータスマッピングが正常に動作（「調査中」→`review`、「修正待ち」→`review`、「To Do」→`draft`）
- ✅ ルールベース生成が正常に動作（信頼度90%で生成）
- ✅ ドメイン知識が正しく適用（「全体管理」などのドメインが推測）

---

## Phase 2: Jira課題用のStructuredLabel生成スクリプト 🟡

### 実装完了項目

1. **スクリプト作成** ✅
   - `scripts/generate-jira-structured-labels.ts`を作成
   - LanceDB `jira_issues`テーブルから課題を読み込み
   - `auto-label-flow`を呼び出してラベル生成
   - Firestoreに保存

2. **テストスクリプト作成** ✅
   - `scripts/test-jira-structured-label-generation.ts`を作成
   - サンプル課題（3件）で動作確認

### 次のステップ

- [ ] より多くの課題（10-100件）でテスト
- [ ] エラーハンドリングの改善
- [ ] 進捗表示の改善

---

## Phase 3: LanceDB jira_issuesテーブルへの統合 ✅

### 実装完了項目

1. **統合スクリプトの作成** ✅
   - `scripts/sync-firestore-jira-labels-to-lancedb.ts`を作成
   - FirestoreからJira課題のStructuredLabelを取得
   - LanceDB `jira_issues`テーブルに統合
   - Jira課題のID形式（`CTJ-1234`など）を判定する機能を追加

2. **スキーマ拡張** ✅
   - `flattenStructuredLabel`関数を使用して`structured_*`フィールドを追加
   - 既存のレコード構造を維持しながらStructuredLabelを統合

### 次のステップ

- [ ] Jiraデータを同期してから、統合スクリプトを実行（Phase 4）

---

## Phase 4: データ同期と本番環境へのデプロイ 🟡

### 実装済み項目

1. **データ同期スクリプト** ✅
   - `scripts/generate-jira-structured-labels.ts`: StructuredLabel生成
   - `scripts/sync-firestore-jira-labels-to-lancedb.ts`: LanceDB統合

### 実装が必要な項目

1. **Jiraデータの同期** ⏳
   - 先にJiraデータを同期する必要がある: `npm run sync:jira`
   - その後、StructuredLabelを生成・統合

2. **インデックス作成** ⏳
   - `jira_issues`テーブルにインデックスを作成: `npm run lancedb:create-indexes`

3. **本番環境へのデプロイ** ⏳
   - GCSにアップロード: `npm run upload:production-data`
   - 本番環境での検証

---

## 📝 実装手順（ステップバイステップ）

### Step 1: Phase 1の確認と改善 ✅

- [x] 入力スキーマの拡張
- [x] プロンプトの調整
- [x] ルールベース生成の調整
- [x] Jiraステータスマッピング関数の追加
- [x] テストと動作確認

### Step 2: Phase 2の完成 🟡

- [x] スクリプト作成
- [x] テストスクリプト作成
- [ ] より多くの課題でテスト（10-100件）
- [ ] エラーハンドリングの改善
- [ ] 進捗表示の改善

### Step 3: Phase 3の実装 ⏳

- [ ] 統合スクリプトの作成
- [ ] スキーマ拡張の確認
- [ ] テストと動作確認

### Step 4: Phase 4の実装 ⏳

- [ ] データ同期
- [ ] インデックス作成
- [ ] 本番環境へのデプロイ

---

## 🎯 次のアクション

1. **Phase 2の完成**
   - より多くの課題でテスト（10-100件）
   - エラーハンドリングの改善

2. **Phase 3の実装**
   - 統合スクリプトの作成
   - スキーマ拡張の確認

3. **Phase 4の実装**
   - データ同期
   - インデックス作成
   - 本番環境へのデプロイ

---

## 📚 関連ドキュメント

- [Jira課題へのドメイン知識統合計画](./JIRA_DOMAIN_KNOWLEDGE_INTEGRATION_PLAN.md)
- [StructuredLabel実装状況](./STRUCTURED_LABEL_SYSTEM_STATUS.md)
- [Jira検索システム仕様](../02-specifications/02.03-jira-spec.md)

---

## 📝 更新履歴

**2025年1月**: 初版作成
- Phase 1完了を確認
- Phase 2実装状況を確認
- Phase 3、Phase 4の実装計画を追加

