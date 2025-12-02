# Operations ドキュメント

**最終更新**: 2025年11月16日  
**現在のPhase**: Phase 5完了 + BOM除去処理・トークン化修正完了 + デプロイドキュメント統合完了

Confluence Firebase RAGシステムの運用に関する**現行有効な**ドキュメントです。

> **関連ドキュメント**: 運用を理解するために、[アーキテクチャドキュメント](../architecture/README.md)、[仕様書](../specifications/spec.md)、[テストガイド](../testing/README.md)も併せて参照してください。

---

## 📚 ドキュメント構成

### 【メインドキュメント】運用ガイド（01-08）

#### 01. デプロイガイド
**ファイル**: [`01-deployment-guide.md`](./01-deployment-guide.md)  
**目的**: 本番環境へのデプロイ手順と設定  
**内容**: 環境変数設定、Firebase App Hosting設定、データ準備、デプロイ手順、トラブルシューティング、ビルド最適化  
**重要度**: ⭐⭐⭐  
**統合内容**: チェックリスト、スキーマ確認ガイド、DB再構築後手順、App Hosting設定、トラブルシューティング、環境変数一覧、ビルド最適化

#### 02. GitHub Actions設定
**ファイル**: [`02-github-actions-setup.md`](./02-github-actions-setup.md)  
**目的**: CI/CDパイプラインの設定  
**内容**: GitHub Actionsの設定方法、ワークフロー定義  
**重要度**: ⭐⭐

#### 03. データ同期戦略
**ファイル**: [`03-data-synchronization-strategy.md`](./03-data-synchronization-strategy.md)  
**目的**: データソースの更新頻度と管理戦略  
**内容**: データソースの更新頻度、Firebase Functionsによる自動同期、定期実行スケジュール（日次・週次）  
**重要度**: ⭐⭐⭐

**主な同期コマンド**:
```bash
# 全データ同期
npm run sync:confluence:batch

# 差分同期（推奨）
npm run sync:confluence:differential

# 差分同期（削除ページスキップ）
npm run sync:confluence:diff-no-delete
```

#### 19. 完全再構築スクリプト運用ガイド
**ファイル**: [`19-full-rebuild-scripts-guide.md`](./04.19-full-rebuild-scripts-guide.md)  
**目的**: データ同期・インデックス作成・GCSアップロードの確実な実行  
**内容**: 完全再構築スクリプトの使用方法、ConfluenceとJiraの完全再構築手順、トラブルシューティング  
**重要度**: ⭐⭐⭐  
**⚠️ 重要**: データ同期、インデックス作成、GCSアップロードを行う場合は、**必ず完全再構築スクリプトを使用してください**。

#### 04. バックアップ管理
**ファイル**: [`04-backup-management-guide.md`](./04-backup-management-guide.md)  
**目的**: データバックアップと復元  
**内容**: 自動バックアップ（毎日午前2時）、手動バックアップ・復元手順  
**重要度**: ⭐⭐

#### 05. 拡張スキーマ運用ガイド
**ファイル**: [`05-extended-schema-operation-guide.md`](./05-extended-schema-operation-guide.md)  
**目的**: LanceDB拡張スキーマの運用  
**内容**: LanceDB拡張スキーマ（StructuredLabel統合版）の運用、日常的な同期処理、インデックス管理  
**重要度**: ⭐⭐⭐

#### 06. スクリプト利用ガイド
**ファイル**: [`06-scripts-guide.md`](./06-scripts-guide.md)  
**目的**: 運用スクリプトの使用方法  
**内容**: 全スクリプトの用途・実行方法  
**重要度**: ⭐⭐⭐

#### 07. リポジトリ移管ガイド
**ファイル**: [`07-migration-guide.md`](./07-migration-guide.md)  
**目的**: リポジトリ移管時の手順  
**内容**: 必要ファイルのチェックリスト  
**重要度**: ⭐

#### 08. ネットワーク共有ガイド
**ファイル**: [`08-network-sharing-guide.md`](./08-network-sharing-guide.md)  
**目的**: ローカル開発環境の共有方法  
**内容**: ネットワーク共有設定、アクセス方法  
**重要度**: ⭐

#### 12. 環境別設定ガイド
**ファイル**: [`12-environment-setup.md`](./12-environment-setup.md)  
**目的**: ローカル環境と本番環境での設定方法  
**内容**: 環境別の設定ファイル、設定手順  
**重要度**: ⭐⭐⭐

#### 13. 環境変数設定ガイド
**ファイル**: [`13-environment-variables.md`](./13-environment-variables.md)  
**目的**: 環境変数の一元管理と設定方法  
**内容**: 必須環境変数一覧、検証ルール、設定方法  
**重要度**: ⭐⭐⭐

#### 18. LunrキャッシュGCS運用ガイド
**ファイル**: [`18-lunr-cache-gcs-operation-guide.md`](./04.18-lunr-cache-gcs-operation-guide.md)  
**目的**: LunrキャッシュのGCS統合機能の運用  
**内容**: 動作確認、手動操作、トラブルシューティング、メンテナンス  
**重要度**: ⭐⭐⭐  
**関連**: [アーキテクチャ設計](../01-architecture/01.05.01-lunr-cache-gcs-integration.md)

### 【履歴ドキュメント】過去のデプロイ記録（09-10）

#### 04.09. 緊急デプロイ手順 (2025-10-20)
**ファイル**: [`04.09-emergency-deployment-20251020.md`](./04.09-emergency-deployment-20251020.md)  
**内容**: 本番環境のパフォーマンス問題とHugging Faceエラーを解決した緊急デプロイ手順  
**参照元**: `04.01-deployment-guide.md`  
**状態**: 完了（解決済み）

#### 04.10. コンテンツ切り詰め改善の本番環境適用ガイド
**ファイル**: [`04.10-content-truncation-improvement-deployment.md`](./04.10-content-truncation-improvement-deployment.md)  
**内容**: ランキングに基づく動的な文字数制限の実装と本番環境適用手順  
**参照元**: `04.01-deployment-guide.md`  
**作成日**: 2025年11月4日

#### 04.11. ビルド後ファイルコピーソリューション
**ファイル**: [`04.11-postbuild-file-copy-solution.md`](./04.11-postbuild-file-copy-solution.md)  
**内容**: Firebase App Hosting環境でのモデルファイルとKuromoji辞書ファイルのコピー解決策  
**参照元**: `04.01-deployment-guide.md`

---

## 🚀 クイックスタート

### 🆕 新メンバー向け

1. **システム全体を理解する**
   - [アーキテクチャドキュメント](../01-architecture/README.md)
   - [システム設計図](../01-architecture/01.01.01-data-flow-diagram-lancedb.md)

2. **開発環境をセットアップする**
   - [`01-deployment-guide.md`](./01-deployment-guide.md)（環境変数設定を含む）
   - [ブランチ戦略](../operations/branch-strategy-guide.md)

3. **データ同期を設定する**
   - [`04.03-data-synchronization-strategy.md`](./04.03-data-synchronization-strategy.md)
   - [`04.02-github-actions-setup.md`](./04.02-github-actions-setup.md) - GitHub Actionsによる自動同期

### 🔧 運用担当者向け

1. **本番デプロイ**
   - [`04.01-deployment-guide.md`](./04.01-deployment-guide.md)（チェックリスト、Firebase App Hosting設定を含む）

2. **監視・メンテナンス**
   - [`04.04-backup-management-guide.md`](./04.04-backup-management-guide.md)
   - [トラブルシューティングガイド](../06-troubleshooting/README.md)

3. **パフォーマンス最適化**
   - [`04.01-deployment-guide.md`](./04.01-deployment-guide.md) - ビルド最適化
   - [`04.05-extended-schema-operation-guide.md`](./04.05-extended-schema-operation-guide.md)

### 🐛 トラブルシューティング

問題が発生した場合：

1. **[トラブルシューティングガイド](../06-troubleshooting/README.md)** - よくあるエラーを確認
2. **ログを確認**
   - Firebase Console: ビルド・デプロイログ
   - Cloud Functions: 同期ログ
   - Cloud Logging: アプリケーションログ
3. **チェックリストを確認**
   - [`04.01-deployment-guide.md`](./04.01-deployment-guide.md) - デプロイ前チェックリスト
4. それでも解決しない場合は開発チームに連絡

---

## 📊 技術スタック概要

### ローカル開発環境
- **ポート**: 9003 (main) / 9004 (phase-0a)
- **データ配置**: ローカルファイルシステム（`.lancedb/`）
- **環境変数**: `.env.local`
- **データ同期**: 手動実行

### 本番環境（Firebase App Hosting）
- **ポート**: 443 (HTTPS)
- **データ配置**: Cloud Storage経由
- **環境変数**: `apphosting.yaml` + Firebase Secrets
- **インスタンス**: minInstances: 1, maxInstances: 4, memory: 4GB, cpu: 2
- **実行環境**: Gen1（Gen2からロールバック）
- **データ同期**: Cloud Functions（自動）
  - dailyDifferentialSync: 毎日午前2時
  - weeklyFullSync: 毎週日曜午前3時

---

## 🏷️ 現在の安定版

**バージョン**: Phase 5完了版  
**リリース日**: 2025年10月17日  
**主要機能**:
- 並列検索実装
- ハイブリッド検索強化（RRF融合 + Composite Scoring）
- LanceDB接続プーリング
- 検索キャッシュ拡大

---

## 📁 ドキュメントの構造

```
docs/operations/
├── README.md                                    # 運用ドキュメント全体の概要（このファイル）
│
├── 【メインドキュメント】運用ガイド
│   ├── 01-deployment-guide.md                  # デプロイガイド（統合版）
│   ├── 02-github-actions-setup.md              # GitHub Actions設定
│   ├── 03-data-synchronization-strategy.md     # データ同期戦略
│   ├── 04-backup-management-guide.md           # バックアップ管理
│   ├── 05-extended-schema-operation-guide.md   # 拡張スキーマ運用ガイド
│   ├── 06-scripts-guide.md                     # スクリプト利用ガイド
│   ├── 07-migration-guide.md                   # リポジトリ移管ガイド
│   ├── 08-network-sharing-guide.md             # ネットワーク共有ガイド
│   ├── 12-environment-setup.md                 # 環境別設定ガイド
│   └── 13-environment-variables.md             # 環境変数設定ガイド
│
└── 【履歴ドキュメント】過去のデプロイ記録
    ├── 09-emergency-deployment-20251020.md     # 緊急デプロイ手順 (2025-10-20)
    └── 10-content-truncation-improvement-deployment.md  # コンテンツ切り詰め改善適用ガイド
```

---

## 🗄️ アーカイブされたドキュメント

以下のドキュメントは完了したプロジェクトや古い情報のため、`docs/archive/operations/` に移動されました：

### 統合済みデプロイドキュメント (`docs/archive/operations/deployment-integrated-2025-11-13/`)
**統合日**: 2025-11-13  
**統合先**: [`01-deployment-guide.md`](./01-deployment-guide.md)

以下のドキュメントは`01-deployment-guide.md`に統合され、アーカイブに移動されました：
- `production-deployment-checklist.md` - デプロイチェックリスト
- `production-schema-verification-guide.md` - スキーマ確認ガイド
- `production-deployment-after-db-rebuild.md` - DB再構築後手順
- `firebase-app-hosting-configuration.md` - Firebase App Hosting設定
- `firebase-app-hosting-troubleshooting.md` - Firebase App Hostingトラブルシューティング
- `required-environment-variables.md` - 必須環境変数一覧
- `build-optimization-guide.md` - ビルド最適化ガイド

### 緊急対応レポート (`docs/archive/operations/emergency-reports/`)
- `production-performance-emergency-2025-10-20.md` - 本番環境パフォーマンス緊急対応（2025-10-20、解決済み）
- `huggingface-rate-limit-emergency.md` - Hugging Faceレートリミット緊急対応（2025-10-20、解決済み）

### 完了レポート (`docs/archive/operations/completed-reports/`)
- `production-index-rebuild-completed.md` - 本番環境インデックス再構築完了報告（2025-11-05）
- `production-index-rebuild-instructions.md` - 本番環境インデックス再構築手順（2025-11-05）
- `phase2-performance-optimization-guide.md` - Phase 2パフォーマンス最適化ガイド（2025-10-20、完了）
- `lunr-performance-verification-guide.md` - Lunrパフォーマンス検証ガイド（2025-10-20、完了）

### 分析レポート (`docs/archive/operations/analysis-reports/`)
- `latest-bucket-status.md` - バケット状態の最新情報（2025-10-19、古い状態情報）
- `cloud-storage-region-analysis.md` - Cloud Storageリージョン分析（2025-10-19、分析完了）

詳細は [アーカイブREADME](../archive/README.md) を参照してください。

---

## 🔗 関連ドキュメント

### アーキテクチャ・設計
- [アーキテクチャドキュメント](../architecture/README.md): システム設計とアーキテクチャ
- [データフロー図](../architecture/01.01.01-data-flow-diagram-lancedb.md): LanceDBデータフロー図

### 仕様・実装
- [仕様書](../specifications/spec.md): 機能仕様と要件定義
- [実装ガイド](../implementation/): 実装詳細とベストプラクティス

### テスト
- [テストガイド](../testing/README.md): テスト戦略と実行ガイド
  - [デプロイ・整合性テスト](../testing/03-deployment-integration.md): デプロイ前の確認項目
  - [データ関連テスト](../testing/01-data-validation.md): データ整合性の確認

### 設定・環境
- [環境変数設定](../configuration/environment-variables.md): 環境変数の設定方法
- [環境セットアップ](../configuration/environment-setup.md): 開発環境のセットアップ方法

---

## 📝 ドキュメント更新ガイドライン

### 新しい運用手順を追加する場合
1. 適切なカテゴリ（デプロイ、同期、監視等）を選択
2. markdownファイルを作成
3. このREADMEに追加
4. 重要度を設定（⭐〜⭐⭐⭐）

### ドキュメントを更新する場合
1. ファイル内の「最終更新」日付を更新
2. 変更履歴を記載（ファイル末尾等）
3. 大きな変更の場合はこのREADMEも更新

### ドキュメントをアーカイブする場合
1. 適切なアーカイブフォルダに移動（`docs/archive/operations/`配下）
   - 緊急対応レポート → `emergency-reports/`
   - 完了レポート → `completed-reports/`
   - 分析レポート → `analysis-reports/`
   - 履歴デプロイ記録 → 番号付きで`docs/operations/`に保持（09-10）
2. このREADMEから削除
3. アーカイブREADMEに追加

---

## 🤝 貢献ガイド

運用ドキュメントの改善にご協力ください：

1. **誤りを発見した場合**: 修正のPRを作成
2. **新しい手順が必要な場合**: ドキュメントを作成してPR
3. **質問がある場合**: Issue を作成

---

**質問・フィードバック**: プロジェクトチームまで
