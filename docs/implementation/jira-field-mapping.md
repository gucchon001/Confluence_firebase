# Jira フィールド対応表

**作成日**: 2025-11-09  
**作成者**: GPT-5 Codex  
**目的**: Jira から取得した課題データを Confluence Firebase プロジェクトへ統合する際のフィールド対応・型情報を共有する。

---

## 1. `JIRA_table` 用フィールドマッピング

| column_name | column | type | description/data_type |
|-------------|--------|------|-----------------------|
| 課題キー | issue.key | default | 各課題を識別する一意のキー（例: CTJ-123）。 |
| 課題概要 | summary | default | 課題のタイトルや要約を表す短い説明。 |
| 優先度 | priority | default | 課題の重要度（例: "High", "Medium", "Low"）。例: `Highest`, `High`, `Medium` |
| 担当者 | assignee | default | 課題の割り当て先（担当者）のユーザーアカウント。例: `片岡`, `池田広大`, `kotake_jin` |
| 報告者 | reporter | default | 課題を作成したユーザーアカウント。例: `株式会社トモノカイ_共用`, `s-suzuki` |
| 作成日 | created | default | 課題が作成された日時。ISO8601形式。 |
| 更新日 | updated | default | 課題が最後に更新された日時。ISO8601形式。 |
| 課題タイプ | issuetype | default | 課題の種類（例: "Bug", "Task", "Story", "Epic"）。 |
| 月 | customfield_10276 | customfield | option 型。例: `6月`, `7月`, `8月`, `11月` |
| 担当 | customfield_10277 | customfield | option 型。例: `片岡`, `池田`, `原口` |
| GIG状況 | customfield_10278 | customfield | option 型。現状サンプルでは未設定が多い。 |
| dev検証 | customfield_10279 | customfield | option 型。例: `完了OK` |
| 本番検証 | customfield_10280 | customfield | option 型。例: `完了OK` |
| リリース予定日 | customfield_10281 | customfield | date 型。例: `2025-11-14T00:00:00.000Z` |
| 完了日 | customfield_10282 | customfield | date 型。完了課題で `YYYY-MM-DDT00:00:00.000Z` 形式。 |
| 希望リリース日 | customfield_10283 | customfield | date 型。例: `2025-10-01T00:00:00.000Z` |
| 限界リリース日 | customfield_10284 | customfield | date 型。例: `2025-08-31T00:00:00.000Z` |
| 影響業務 | customfield_10291 | customfield | option 型。例: `教室・求人編集`, `パーソナルオファー`, `請求書作成`, `その他` |
| 業務影響度 | customfield_10292 | customfield | option 型。例: `大`, `中`, `小`, `リリースの壁` |
| ステータス | status | default | 課題の現在の進行状況（例: "TO DO", "In Progress", "Done"）。`statusCategory` で To Do / In Progress / Done を取得可能。 |

> **メモ**: 日付フィールド（リリース予定日、完了日、希望リリース日、限界リリース日）はシート側で日付のみのフォーマットに統一。`作成日`・`更新日` は日時を保持。添付ファイル数は `attachment` フィールドの長さで判別できる（0〜7件程度）。

---

## 2. Jira API フィールド一覧（抜粋）

`JIRA_tableMapping` 以外に参照される可能性があるフィールドの定義。

| j_name | name | type | description |
|--------|------|------|-------------|
| プロジェクトキー | projectKey | default | プロジェクトを識別する一意のキー（例: CTJ）。課題キーにも含まれる。 |
| プロジェクトID | projectId | default | プロジェクトを識別する一意の数値ID。Jira 内部で使用。 |
| プロジェクト名 | name | default | プロジェクトのフルネーム（例: "Customer Support"）。 |
| プロジェクトリーダー | lead | default | プロジェクトを管理する責任者のユーザーアカウント。 |
| 課題キー | issue.key | default | 各課題を識別する一意のキー（例: CTJ-123）。 |
| 課題概要 | summary | default | 課題のタイトルや要約を表す短い説明。 |
| 課題の説明 | description | default | 課題の詳細な説明。 |
| ステータス | status | default | 現在の進行状況（例: "TO DO", "In Progress", "Done"）。 |
| 優先度 | priority | default | 課題の重要度（例: "High", "Medium", "Low"）。 |
| 担当者 | assignee | default | 課題の割り当て先ユーザー。 |
| 報告者 | reporter | default | 課題を作成したユーザー。 |
| 作成日 | created | default | 課題が作成された日時。 |
| 更新日 | updated | default | 課題が最後に更新された日時。 |
| 期限日 | duedate | default | 課題の締め切り日。 |
| 課題タイプ | issuetype | default | 課題の種類（"Bug"、"Task" など）。 |
| コンポーネント | components | default | プロジェクトを構成するセクションや機能。 |
| ラベル | labels | default | 課題を整理するためのタグやキーワード。 |
| 解決状況 | resolution | default | 課題がどのように解決されたか。 |
| 投票数 | votes | default | 課題への投票数。 |
| ウォッチャー | watchers | default | 課題の更新を追跡しているユーザーのリスト。 |
| スプリント | sprint | default | 関連付けられているスプリント。 |
| エピック | epic | default | 関連付けられているエピック。 |
| カスタムフィールド | customfield_* | default | プロジェクト固有の追加フィールド。 |
| 添付ファイル | attachments | default | 課題に関連付けられたファイル。 |
| 残り時間 | timeestimate | default | 完了に必要な推定時間。 |
| 作業時間 | timespent | default | これまで費やされた時間。 |
| 親課題 | parent | default | サブタスクの親課題。 |
| バグ混入元 | customfield_10225 | customfield | array 型。 |
| Project overview key | customfield_10222 | customfield | string 型。 |
| Project overview status | customfield_10223 | customfield | string 型。 |
| 影響業務 | customfield_10290 | customfield | string 型。 |
| Web サイト | customfield_10050 | customfield | string 型。 |
| 業務影響度 | customfield_10292 | customfield | option 型。 |
| メール | customfield_10051 | customfield | string 型。 |
| 電話番号 | customfield_10052 | customfield | string 型。 |
| Request participants | customfield_10058 | customfield | array 型。 |
| 会社の規模 | customfield_10049 | customfield | option 型。 |
| 日付 | customfield_10206 | customfield | date 型。 |
| 本番検証 | customfield_10280 | customfield | option 型。 |
| リリース予定日 | customfield_10281 | customfield | date 型。 |
| 完了日 | customfield_10282 | customfield | date 型。 |
| 希望リリース日 | customfield_10283 | customfield | date 型。 |
| 限界リリース日 | customfield_10284 | customfield | date 型。 |
| 影響業務 | customfield_10285 | customfield | string 型。 |
| 影響業務 | customfield_10286 | customfield | string 型。 |
| 影響業務 | customfield_10287 | customfield | option 型。 |
| テスト | customfield_10288 | customfield | array 型。 |
| 業務影響度 | customfield_10289 | customfield | string 型。 |
| 月 | customfield_10276 | customfield | option 型。 |
| 担当 | customfield_10277 | customfield | option 型。 |
| GIG状況 | customfield_10278 | customfield | option 型。 |
| DEV検証 | customfield_10279 | customfield | option 型。 |
| Story Points | customfield_10028 | customfield | number 型。 |
| Sprint | customfield_10020 | customfield | array 型。 |
| Flagged | customfield_10021 | customfield | array 型。 |
| Target start | customfield_10022 | customfield | date 型。 |
| 反映状態 | customfield_10264 | customfield | option 型。 |
| Target end | customfield_10023 | customfield | date 型。 |
| 反映状況 | customfield_10265 | customfield | option 型。 |
| [CHART] Date of First Response | customfield_10024 | customfield | datetime 型。 |
| 反映状況 | customfield_10266 | customfield | option 型。 |
| [CHART] Time in Status | customfield_10025 | customfield | any 型。 |
| Sentiment | customfield_10267 | customfield | array 型。 |
| 目標 | customfield_10268 | customfield | array 型。 |
| Story point estimate | customfield_10016 | customfield | number 型。 |
| Issue color | customfield_10017 | customfield | string 型。 |
| Parent Link | customfield_10018 | customfield | any 型。 |
| Rank | customfield_10019 | customfield | any 型。 |
| Request Type | customfield_10010 | customfield | sd-customerrequesttype 型。 |
| Epic Name | customfield_10011 | customfield | string 型。 |
| Epic Status | customfield_10012 | customfield | option 型。 |
| Epic Color | customfield_10013 | customfield | string 型。 |
| Category | customfield_10134 | customfield | option 型。 |
| Epic Link | customfield_10014 | customfield | any 型。 |
| Start date | customfield_10015 | customfield | date 型。 |
| Change type | customfield_10005 | customfield | option 型。 |
| Change risk | customfield_10006 | customfield | option 型。 |
| Change reason | customfield_10007 | customfield | option 型。 |
| Change start date | customfield_10008 | customfield | datetime 型。 |
| Change completion date | customfield_10009 | customfield | datetime 型。 |
| Total forms | customfield_10120 | customfield | number 型。 |
| 開発 | customfield_10000 | customfield | any 型。 |
| Team | customfield_10001 | customfield | team 型。 |
| Organizations | customfield_10002 | customfield | array 型。 |
| Approvers | customfield_10003 | customfield | array 型。 |
| Vulnerability | customfield_10245 | customfield | any 型。 |
| Impact | customfield_10004 | customfield | option 型。 |
| Open forms | customfield_10117 | customfield | number 型。 |
| Design | customfield_10238 | customfield | array 型。 |
| Submitted forms | customfield_10118 | customfield | number 型。 |
| Locked forms | customfield_10119 | customfield | number 型。 |

> **注意**: `customfield_*` はプロジェクト固有の型や構造を持つため、取り込み時には値のフォーマットと null ハンドリングに留意すること。

---

## 4. 最新疎通テストで確認できた追加フィールド

| フィールド名 | 補足 |
|--------------|------|
| statuscategorychangedate | ステータスカテゴリーが変更された日時（例: `2025-10-29T05:54:53.898+0900`）。 |
| parent | 親課題オブジェクト（サブタスクの場合）。サンプルでは未設定。 |
| timespent / aggregatetimespent / timeestimate / aggregatetimeestimate / aggregatetimeoriginalestimate | 作業時間・見積り関連。現在のサンプルでは未入力。 |
| project | 課題が属するプロジェクト情報。`project.key=CTJ`, `project.name=Confluence Firebase` 等。 |
| fixVersions / versions | 紐付いているバージョン情報。現状サンプルでは未設定。 |
| statusCategory | ステータスカテゴリー（To Do / In Progress / Done）。ダッシュボード進捗指標に利用可能。 |
| issuerestriction | 課題の閲覧制限設定。サンプルでは未設定。 |
| watches | ウォッチャー情報。`isWatching` フラグと `watchCount` を含む。 |
| lastViewed | ユーザーが最後に閲覧した日時。例: `2025-11-05T10:15:17.339Z`。 |
| description | 課題の本文説明。テキスト長が長い場合がある。 |
| security | セキュリティレベル。サンプルでは未設定。 |
| attachment | 添付ファイル情報。0〜7件で確認。 |
| subtasks | サブタスク一覧。サンプルでは未設定。 |
| aggregateprogress / progress | 進捗率。`progress.percent` など。 |
| comment / worklog | コメント・作業ログ。今後の詳細分析に使用可能。 |
| customfield_10275, customfield_10473, customfield_10506, customfield_10507, customfield_10539, customfield_10540, customfield_10572, customfield_10638, customfield_10770 | プロジェクト固有のカスタムフィールド。用途・型は確認中（フィールドメタ情報参照予定）。 |

> 追加フィールドの型判別が必要な場合は、Jira フィールド設定画面または `/rest/api/3/field` で取得可能なメタデータと照合すること。サンプルでは `customfield_10275` など未解明項目が複数確認できる。
> `inspect-jira-fields.ts` を実行すると、各フィールドの `type` / `custom` / `customId` を一覧表示できる（例: `customfield_10539` = select 型、`customfield_10572` = textarea 型）。

---

## 5. 利用時のガイドライン

- 取得スクリプトでは、最低限 `issue.key`, `summary`, `status`, `assignee`, `updated` を必須フィールドとして読み込む。  
- 日付/日時フィールドは ISO 8601 → `YYYY-MM-DD` or `YYYY-MM-DD HH:mm:ss` へ正規化。  
- Option 型フィールドは `value`、User 型は `displayName` を優先的に抽出。  
- 今後の仕様追加は本ファイルに追記し、実装・スキーマと同期を取る。  
- LanceDB/StructuredLabel へのマッピングが決まり次第、関連ドキュメント（`architecture/confluence-jira-integration-plan.md` など）も更新する。
