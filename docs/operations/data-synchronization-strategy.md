# データ同期戦略と定期実行スケジュール

**最終更新日**: 2025年1月13日  
**バージョン**: 2.0 (GitHub Actions移行完了)  
**対象システム**: Confluence Vector Search（ハイブリッド検索）

## 概要

このドキュメントでは、ハイブリッド検索システムにおける各データソースの更新戦略、定期実行スケジュール、および運用手順を定義します。

### システム全体のデータフロー

```mermaid
graph TB
    A[Confluence API] -->|毎日2時<br/>差分同期| B[GitHub Actions<br/>sync-confluence.yml]
    B -->|変更ページ取得| C[Sync Script]
    C -->|ベクトル生成| D[LanceDB]
    C -->|インデックス構築| E[Lunr.js]
    D -->|Cloud Storage| F[バックアップ]
    E -->|キャッシュ| F
    
    G[手動実行<br/>3-6ヶ月] -->|ドメイン知識抽出| H[Domain Knowledge DB]
    H -->|8,122 keywords| I[検索精度向上]
    
    D -->|ベクトル検索| J[ハイブリッド検索エンジン]
    E -->|BM25検索| J
    H -->|キーワード抽出| J
    J -->|検索結果| K[ユーザー]
    
    L[GitHub Actions<br/>手動実行] -.->|workflow_dispatch| B
    M[GitHub Actions<br/>ログ確認] -.->|Actions UI| F
    
    style B fill:#e1f5ff
    style C fill:#e1f5ff
    style G fill:#ffe1e1
    style H fill:#ffe1e1
    style L fill:#fff4e1
    style M fill:#e1ffe1
```

---

## 📊 データソース一覧と更新頻度

### 自動更新されるデータソース

| データソース | 更新頻度 | 自動/手動 | 保存場所 | 備考 |
|-------------|---------|----------|---------|------|
| **Confluenceページデータ** | 毎日 午前2時（JST） | 自動 | `.lancedb/`, Cloud Storage | GitHub Actions自動実行（✅ 動作確認済み） |
| **LanceDBベクトルDB** | Confluence同期後 | 自動 | `.lancedb/confluence.lance/` | 約2,500チャンク、768次元 |
| **Lunr.js BM25インデックス** | LanceDB更新後 | 自動 | メモリ + ディスクキャッシュ | 日本語トークン化済み |

### 手動更新が必要なデータソース

| データソース | 推奨更新頻度 | 自動/手動 | 保存場所 | 最終更新日 |
|-------------|------------|----------|---------|-----------|
| **ドメイン知識DB** | 3〜6ヶ月に1回 | 手動 | `data/domain-knowledge-v2/` | 2025年9月23日 |
| **LLM抽出知識** | 必要に応じて | 手動 | `data/llm-extraction-v2/` | - |

---

## 🔄 定期実行スケジュール

### 週次スケジュール概要

```mermaid
gantt
    title ハイブリッド検索システム 週次実行スケジュール
    dateFormat YYYY-MM-DD
    axisFormat %a
    
    section 自動同期
    日次差分同期（月）   :active, mon, 2025-10-13, 1d
    日次差分同期（火）   :active, tue, 2025-10-14, 1d
    日次差分同期（水）   :active, wed, 2025-10-15, 1d
    日次差分同期（木）   :active, thu, 2025-10-16, 1d
    日次差分同期（金）   :active, fri, 2025-10-17, 1d
    日次差分同期（土）   :active, sat, 2025-10-18, 1d
    週次完全同期（日）   :crit, sun, 2025-10-19, 1d
    
    section 手動メンテナンス
    ドメイン知識更新     :done, manual, 2025-09-23, 1d
    次回推奨更新         :milestone, next, 2025-12-23, 0d
```

### GitHub Actions自動同期

#### 日次差分同期
```yaml
ワークフロー: sync-confluence.yml
スケジュール: 毎日 午前2時（JST）
実行内容: 差分同期（変更されたページのみ）
タイムアウト: 6時間（GitHub Actions上限）
メモリ: 7GB
実装: .github/workflows/sync-confluence.yml
```

**処理フロー**:
1. プロジェクト全体をチェックアウト
2. Node.js環境セットアップ（v22）
3. 依存関係インストール
4. Confluence APIから変更ページを取得
5. 差分同期実行（`npm run sync:confluence:differential`）
6. Lunr.jsインデックス再構築
7. LanceDBベクトルインデックス最適化
8. Cloud Storageへアップロード
9. 同期完了ログ出力

```mermaid
sequenceDiagram
    participant GA as GitHub Actions
    participant GH as GitHub Repository
    participant CS as Cloud Storage
    participant Conf as Confluence API
    participant Sync as Sync Script
    participant LDB as LanceDB
    participant Lunr as Lunr.js
    
    Note over GA: 毎日 午前2時（JST）<br/>sync-confluence.yml
    GA->>GH: プロジェクトチェックアウト
    GH-->>GA: 全ソースコード
    GA->>GA: Node.js環境セットアップ
    GA->>Conf: 変更ページ取得
    Conf-->>GA: 差分ページリスト
    GA->>Sync: 差分同期実行
    Sync->>LDB: ベクトル更新
    LDB-->>Sync: 更新完了
    Sync->>Lunr: インデックス再構築
    Lunr-->>Sync: 再構築完了
    Sync->>LDB: インデックス最適化
    Sync-->>GA: 同期完了レポート
    GA->>CS: 更新データアップロード
    Note over GA: GitHub Actionsログに記録
    alt 成功
        GA->>GA: ✅ ログ記録
    else 失敗
        GA->>GA: ❌ エラーログ記録
    end
```

#### 週次完全同期
```yaml
ワークフロー: weekly-full-sync.yml
スケジュール: 毎週日曜日 午前3時（JST）
実行内容: 完全同期（全ページ再取得）
タイムアウト: 6時間（GitHub Actions上限）
メモリ: 7GB
実装: .github/workflows/weekly-full-sync.yml
```

**処理フロー**:
1. プロジェクト全体をチェックアウト
2. Node.js環境セットアップ（v22）
3. 依存関係インストール
4. Confluence APIから全ページを取得
5. 完全同期実行（`npm run sync:confluence:batch`）
6. Lunr.jsインデックス完全再構築
7. LanceDBベクトルインデックス最適化
8. Cloud Storageへアップロード
9. GitHub Actionsログに結果を記録

---

## 🛠️ 同期スクリプト詳細

### 1. Confluence同期スクリプト

#### 差分同期（推奨・日常利用）
```bash
npm run sync:confluence:differential
```
- **説明**: 前回同期以降に更新されたページのみを同期
- **実行時間**: 約5〜15分
- **APIコール数**: 最小限
- **使用シーン**: 日次自動同期、開発中の定期更新

#### 完全同期
```bash
npm run sync:confluence:batch
```
- **説明**: 全ページを再取得して完全に再構築
- **実行時間**: 約30〜60分
- **APIコール数**: 大量（約1,000ページ + メタデータ取得）
- **使用シーン**: 週次同期、大規模変更後、データ不整合時

#### 削除スキップ同期
```bash
npm run sync:confluence:no-delete
```
- **説明**: 削除されたページの処理をスキップ
- **使用シーン**: アーカイブページを保持したい場合

#### 差分+削除スキップ
```bash
npm run sync:confluence:diff-no-delete
```
- **説明**: 差分同期 + 削除ページの処理をスキップ
- **使用シーン**: 安全な日次同期

### 2. インデックス再構築スクリプト

同期スクリプト実行後、以下が自動的に実行されます：

```bash
# Lunr.jsインデックス再構築（標準版）
lunrInitializer.initializeAsync()

# Lunr.jsインデックス再構築（最適化版）
optimizedLunrInitializer.initializeOnce()

# LanceDBベクトルインデックス最適化
lancedbClient.getTable() # 自動最適化トリガー
```

### 3. ドメイン知識抽出スクリプト

#### ドメイン知識抽出（v2）
```bash
npm run domain-knowledge-extraction-v2
```
- **説明**: Confluenceページから構造化知識を抽出
- **実行時間**: 約20〜40分（LLM API使用）
- **出力**:
  - `final-domain-knowledge-v2.json`: 8,122個のキーワード
  - `keyword-lists-v2.json`: カテゴリ別キーワードリスト
- **使用シーン**: 
  - 初回セットアップ
  - Confluenceの内容が大幅に変更された場合
  - 3〜6ヶ月ごとの定期更新

#### 完全パイプライン実行
```bash
npm run complete-pipeline
```
- **説明**: Confluence抽出 + LLM知識抽出 + ドメイン知識抽出の完全パイプライン
- **実行時間**: 約60〜90分
- **使用シーン**: システム全体の再構築

### 4. Cloud Storage連携スクリプト

#### データアップロード
```bash
npm run upload:production-data
```
- **説明**: ローカルの`.lancedb/`をCloud Storageにアップロード
- **アップロード先**: `gs://confluence-copilot-data/`

#### データダウンロード
```bash
npm run download:production-data
```
- **説明**: Cloud Storageからローカルにダウンロード
- **使用シーン**: 新環境のセットアップ、ビルド前の事前準備

---

## 📋 推奨される運用戦略

### 日常運用（自動）

```
毎日 午前2時（JST）
├─ GitHub Actions自動トリガー (sync-confluence.yml)
├─ 差分同期実行（変更ページのみ）
├─ Lunr.jsインデックス再構築
├─ LanceDBインデックス最適化
└─ Cloud Storageへバックアップ
```

**メリット**:
- API使用量が最小限
- 実行時間が短い（5〜15分）
- 自動化されているため運用負荷ゼロ
- プロジェクト全体にアクセス可能
- 無料枠が充実（パブリックリポジトリ）

### 週次メンテナンス（自動）

```
毎週日曜日 午前3時（JST）
├─ GitHub Actions自動トリガー (weekly-full-sync.yml)
├─ 完全同期実行（全ページ再取得）
├─ 全インデックス完全再構築
├─ データ整合性チェック
└─ Cloud Storageへバックアップ
```

**メリット**:
- データの不整合を週次で解消
- 削除ページの適切な処理
- インデックスの完全最適化
- 最大6時間の実行時間制限
- 詳細なログ出力

### 月次・四半期メンテナンス（手動）

#### ドメイン知識更新（3〜6ヶ月）

```bash
# ステップ1: 最新Confluenceデータで完全同期
npm run sync:confluence:batch

# ステップ2: ドメイン知識を再抽出
npm run domain-knowledge-extraction-v2

# ステップ3: Cloud Storageへアップロード
npm run upload:production-data
```

**実行タイミング**:
- 大規模なConfluence更新後
- 新しいドメイン用語が大量に追加された場合
- 検索精度が低下したと感じた場合
- 前回更新から3〜6ヶ月経過

---

## 🚨 トラブルシューティング

### 同期失敗時の対応

#### GitHub Actionsで同期失敗

1. **ログ確認**: GitHub Actionsでエラーを確認
   ```bash
   # GitHub リポジトリページで確認
   # https://github.com/gucchon001/Confluence_firebase/actions
   ```

2. **確認事項**:
   - Confluence API トークンの有効期限
   - API レート制限（約1,000リクエスト/時間）
   - GitHub Secrets設定（CONFLUENCE_API_TOKEN, GEMINI_API_KEY）
   - Google Cloud Storage の認証情報（GOOGLE_CLOUD_CREDENTIALS）
   - ワークフローファイルの構文エラー

3. **リカバリー手順**:
   ```bash
   # オプション1: GitHub Actions手動実行
   # GitHub リポジトリ → Actions → 該当ワークフロー → Run workflow
   
   # オプション2: ローカルで手動実行
   npm run sync:confluence:differential
   npm run upload:production-data
   ```

4. **ステータス確認**:
   ```bash
   # GitHub Actionsの実行履歴で確認
   # https://github.com/gucchon001/Confluence_firebase/actions
   ```

#### Lunr.jsインデックス初期化失敗

**症状**: BM25検索が機能しない、検索結果が不完全

**対応**:
```bash
# キャッシュをクリアして再初期化
rm -rf .cache/lunr-*
npm run sync:confluence:differential
```

#### LanceDBデータ破損

**症状**: ベクトル検索がエラーを返す、データ不整合

**対応**:
```bash
# Cloud Storageから最新データをダウンロード
npm run download:production-data

# または完全再構築
npm run sync:confluence:batch
npm run upload:production-data
```

### 検索精度低下時の対応

#### 症状別診断

| 症状 | 考えられる原因 | 対応 |
|-----|-------------|------|
| 最新ページが検索されない | 同期漏れ | 差分同期実行 |
| 古い情報が表示される | キャッシュ問題 | 完全同期実行 |
| 用語認識が不正確 | ドメイン知識が古い | ドメイン知識再抽出 |
| 検索結果が少ない | インデックス不整合 | Lunr.js再構築 |

#### 段階的リカバリー手順

```bash
# レベル1: 差分同期（5〜15分）
npm run sync:confluence:differential

# レベル2: 完全同期（30〜60分）
npm run sync:confluence:batch

# レベル3: ドメイン知識再抽出（20〜40分）
npm run domain-knowledge-extraction-v2

# レベル4: 完全パイプライン再実行（60〜90分）
npm run complete-pipeline
```

---

## 📈 モニタリングと評価指標

### 同期成功の確認項目

#### GitHub Actions実行後
1. **GitHub Actionsで確認**:
   ```bash
   # GitHub リポジトリページで確認
   # https://github.com/gucchon001/Confluence_firebase/actions
   ```

2. **実行ログの確認**:
   ```bash
   # ワークフロー実行ページで各ステップのログを確認
   # 成功時: ✅ Confluence data sync completed successfully
   ```

3. **確認ポイント**:
   - 同期タイプ（differential / full）
   - 処理件数（added, updated, deleted）
   - エラー件数
   - 実行時間
   - Cloud Storageアップロード成功

#### ローカル実行後
```bash
# LanceDBのレコード数確認
ls -lh .lancedb/confluence.lance/

# Lunr.jsインデックスステータス確認
# アプリ起動後、ログで以下を確認:
# [LunrInitializer] Lunr index initialized successfully
# [LunrInitializer] Document count: XXXX
```

### パフォーマンス指標

| 指標 | 目標値 | 確認方法 |
|-----|-------|---------|
| **同期実行時間** | 差分: <15分, 完全: <60分 | GitHub Actions ログ |
| **検索レスポンス** | <2秒 | アプリのパフォーマンスログ |
| **Lunr初期化時間** | <10秒 | サーバー起動ログ |
| **ベクトル検索精度** | 上位5件に関連結果 | 手動検証 |
| **BM25検索カバレッジ** | 全ページインデックス済み | ドキュメントカウント確認 |
| **GitHub Actions実行成功率** | >99% | GitHub Actions ダッシュボード |

---

## 🔐 セキュリティとアクセス制御

### 必要な認証情報

#### GitHub Secrets（自動同期用）
```bash
# GitHub リポジトリページで設定
# Settings → Secrets and variables → Actions → New repository secret
```

- `CONFLUENCE_API_TOKEN`: Confluence API トークン
- `GEMINI_API_KEY`: Google AI (Gemini) API キー
- `GOOGLE_CLOUD_CREDENTIALS`: Google Cloud Service Account JSON（Cloud Storageアップロード用）

詳細は `docs/operations/github-actions-setup.md` を参照してください。

#### ローカル環境変数
```bash
CONFLUENCE_API_TOKEN=your_token
CONFLUENCE_BASE_URL=https://giginc.atlassian.net
CONFLUENCE_USER_EMAIL=kanri@jukust.jp
CONFLUENCE_SPACE_KEY=CLIENTTOMO
GEMINI_API_KEY=your_gemini_key
GOOGLE_CLOUD_PROJECT=confluence-copilot-ppjye
```

詳細は `docs/operations/required-environment-variables.md` を参照してください。

### Cloud Storage権限

サービスアカウントに必要な権限:
- `storage.objects.create`
- `storage.objects.get`
- `storage.objects.list`
- `storage.buckets.get`

---

## 📚 関連ドキュメント

- [GitHub Actions セットアップ](./github-actions-setup.md) - 詳細なセットアップ手順
- [Firebase Functions スケジュール同期セットアップ](./firebase-scheduled-sync-setup.md) - 旧方式（参考）
- [アーキテクチャ図](../architecture/data-flow-diagram-lancedb.md) - システム全体のデータフロー
- [ハイブリッド検索仕様](../architecture/hybrid-search-contract.md) - 検索システムの契約
- [環境変数一覧](./required-environment-variables.md) - 必要な環境変数
- [テスト実行ガイド](../test-execution-guide.md) - テスト方法

---

## 📝 変更履歴

| 日付 | バージョン | 変更内容 |
|-----|----------|---------|
| 2025-01-13 | 2.0 | GitHub Actionsへの完全移行、Firebase Functionsの制約を回避 |
| 2025-10-11 | 1.1 | Firebase Functionsへの移行を反映、GitHub Actionsからの変更 |
| 2025-10-11 | 1.0 | 初版作成：更新戦略と定期実行スケジュールを定義 |

---

## 📞 サポート

問題が発生した場合は、以下を確認してください：

1. **GitHub Actions**: 
   - Actions ページ: https://github.com/gucchon001/Confluence_firebase/actions
   - 実行ログとエラーメッセージの確認
   
2. **GitHub Secrets**:
   ```bash
   # GitHub リポジトリ → Settings → Secrets and variables → Actions
   # CONFLUENCE_API_TOKEN, GEMINI_API_KEY, GOOGLE_CLOUD_CREDENTIALS が設定済みか確認
   ```

3. **ローカル実行テスト**:
   ```bash
   npm run sync:confluence:differential
   npm run upload:production-data
   ```

4. **ローカルログ**: `build.log`, `server.log`
5. **このドキュメント**: トラブルシューティングセクション
6. **セットアップガイド**: `docs/operations/github-actions-setup.md`

それでも解決しない場合は、開発チームにお問い合わせください。

