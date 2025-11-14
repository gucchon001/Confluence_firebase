# Operations ドキュメント

**最終更新**: 2025年11月13日  
**現在のPhase**: Phase 5完了 + BOM除去処理・トークン化修正完了 + デプロイドキュメント統合完了

Confluence Firebase RAGシステムの運用に関する**現行有効な**ドキュメントです。

## ✨ 最新情報（2025-11-13）

🎉 **デプロイ関連ドキュメントを統合！** デプロイ関連のドキュメントを`deployment-guide.md`に統合しました。

### 主な変更
- ✅ **デプロイドキュメント統合**: 7つのドキュメントを`deployment-guide.md`に統合
- ✅ **アーカイブ移行**: 統合済みドキュメントを`docs/archive/operations/deployment-integrated-2025-11-13/`に移動
- ✅ **README更新**: 統合済みドキュメントへの参照を削除し、`deployment-guide.md`への参照に更新

### 統合されたドキュメント
以下のドキュメントが`deployment-guide.md`に統合され、アーカイブに移動されました：
- `production-deployment-checklist.md` - デプロイチェックリスト
- `production-schema-verification-guide.md` - スキーマ確認ガイド
- `production-deployment-after-db-rebuild.md` - DB再構築後手順
- `firebase-app-hosting-configuration.md` - Firebase App Hosting設定
- `firebase-app-hosting-troubleshooting.md` - Firebase App Hostingトラブルシューティング
- `required-environment-variables.md` - 必須環境変数一覧
- `build-optimization-guide.md` - ビルド最適化ガイド

**最新の情報**: [deployment-guide.md](./deployment-guide.md) を参照してください。

### 以前の成果

#### BOM除去処理とトークン化修正（2025-11-06）
- ✅ **BOM除去処理の実装**: すべてのデータ処理パスでBOM文字（U+FEFF）を除去
- ✅ **トークン化修正**: kuromojiを使用する統一トークン化処理を実装
- ✅ **データベース再構築**: BOM除去処理を含むデータベース再構築完了（2,088行）
- ✅ **インデックス再構築**: Lunrインデックスとベクトルインデックスの再構築完了
- ✅ **本番環境デプロイ**: データベースアップロードとコードデプロイ完了

#### Phase 5（2025-10-17）
- ✅ 並列検索実装（ベクトル検索 + BM25検索）
- ✅ ハイブリッド検索強化（RRF融合 + Composite Scoring）
- ✅ 検索重み配分最適化（BM25 50% + タイトル 25% + ラベル 15% + ベクトル 5%）
- ✅ LanceDB接続プーリング
- ✅ 検索キャッシュ拡大（TTL 15分、maxSize 5000）

詳細は以下をご覧ください：
- [デプロイガイド](./deployment-guide.md)
- [Phase 5 Week 2完了レポート](../architecture/phase5-week2-completion-report.md)

---

## 📚 ドキュメント一覧

### 🤖 AI開発・協働

| ドキュメント | 説明 | 重要度 |
|------------|------|--------|
| [cursor-ai-collaboration-guide.md](./cursor-ai-collaboration-guide.md) | **Cursor AI協働マニュアル**<br>AI機能を最大限に活用するためのコミュニケーション技法<br>問題解決アプローチとデバッグ戦略 | ⭐⭐⭐ |

---

### 🚀 デプロイ・設定

| ドキュメント | 説明 | 重要度 |
|------------|------|--------|
| [deployment-guide.md](./deployment-guide.md) | **包括的デプロイガイド（統合版）**<br>環境変数設定、Firebase App Hosting設定、データ準備、デプロイ手順、トラブルシューティング、ビルド最適化<br>**統合内容**: チェックリスト、スキーマ確認ガイド、DB再構築後手順、App Hosting設定、トラブルシューティング、環境変数一覧、ビルド最適化 | ⭐⭐⭐ |
| [github-actions-setup.md](./github-actions-setup.md) | **GitHub Actions設定**<br>CI/CDパイプライン設定 | ⭐⭐ |

---

### 🔄 データ同期・管理

| ドキュメント | 説明 | 重要度 |
|------------|------|--------|
| [data-synchronization-strategy.md](./data-synchronization-strategy.md) | **データ同期戦略**<br>データソースの更新頻度と管理戦略<br>Firebase Functionsによる自動同期<br>定期実行スケジュール（日次・週次） | ⭐⭐⭐ |
| [firebase-scheduled-sync-setup.md](./firebase-scheduled-sync-setup.md) | **自動同期セットアップ**<br>Cloud Functionsのデプロイ方法<br>Secret Manager設定 | ⭐⭐⭐ |
| [backup-management-guide.md](./backup-management-guide.md) | **バックアップ管理**<br>自動バックアップ（毎日午前2時）<br>手動バックアップ・復元手順 | ⭐⭐ |

**主な同期コマンド**:
```bash
# 全データ同期
npm run sync:confluence:batch

# 差分同期（推奨）
npm run sync:confluence:differential

# 差分同期（削除ページスキップ）
npm run sync:confluence:diff-no-delete
```

---

### 🗄️ データベース・スキーマ

| ドキュメント | 説明 | 重要度 |
|------------|------|--------|
| [extended-schema-operation-guide.md](./extended-schema-operation-guide.md) | **拡張スキーマ運用ガイド**<br>LanceDB拡張スキーマ（StructuredLabel統合版）の運用<br>日常的な同期処理、インデックス管理 | ⭐⭐⭐ |

---

### 🌐 開発環境・ブランチ戦略

| ドキュメント | 説明 | 重要度 |
|------------|------|--------|
| [branch-strategy-guide.md](./branch-strategy-guide.md) | **ブランチ戦略ガイド**<br>mainブランチ（本番）とphase-0aブランチ（開発）の運用<br>ポート分離（9003/9004） | ⭐⭐⭐ |
| [network-sharing-guide.md](./network-sharing-guide.md) | **ネットワーク共有ガイド**<br>ローカル開発環境の共有方法 | ⭐ |
| [migration-guide.md](./migration-guide.md) | **リポジトリ移管ガイド**<br>必要ファイルのチェックリスト | ⭐ |

---

## 🚀 クイックスタート

### 🆕 新メンバー向け

1. **システム全体を理解する**
   - [アーキテクチャドキュメント](../architecture/data-flow-diagram-lancedb.md)
   - [システム設計図](../architecture/blueprint.md)

2. **開発環境をセットアップする**
   - [デプロイガイド](./deployment-guide.md)（環境変数設定を含む）
   - [ブランチ戦略](./branch-strategy-guide.md)

3. **データ同期を設定する**
   - [データ同期戦略](./data-synchronization-strategy.md)
   - [自動同期セットアップ](./firebase-scheduled-sync-setup.md)

### 🔧 運用担当者向け

1. **本番デプロイ**
   - [デプロイガイド](./deployment-guide.md)（チェックリスト、Firebase App Hosting設定を含む）

2. **監視・メンテナンス**
   - [バックアップ管理](./backup-management-guide.md)
   - [トラブルシューティングガイド](../troubleshooting/README.md)

3. **パフォーマンス最適化**
   - [デプロイガイド - ビルド最適化](./deployment-guide.md#35-ビルド最適化設定)
   - [拡張スキーマ運用ガイド](./extended-schema-operation-guide.md)

### 🐛 トラブルシューティング

問題が発生した場合：

1. **[トラブルシューティングガイド](../troubleshooting/README.md)** - よくあるエラーを確認
2. **ログを確認**
   - Firebase Console: ビルド・デプロイログ
   - Cloud Functions: 同期ログ
   - Cloud Logging: アプリケーションログ
   - [Cloud Logging確認コマンド集](../troubleshooting/cloud-logging-check-commands.md)
3. **チェックリストを確認**
   - [デプロイガイド - デプロイ前チェックリスト](./deployment-guide.md#5-デプロイ前チェックリスト)
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

## 🗄️ アーカイブされたドキュメント

以下のドキュメントは完了したプロジェクトや古い情報のため、`docs/archive/operations/` に移動されました：

### 統合済みデプロイドキュメント (`docs/archive/operations/deployment-integrated-2025-11-13/`)
**統合日**: 2025-11-13  
**統合先**: [deployment-guide.md](./deployment-guide.md)

以下のドキュメントは`deployment-guide.md`に統合され、アーカイブに移動されました：
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

### その他のアーカイブ
- `docs/archive/operations-legacy/` - 旧operationsドキュメント
- `docs/archive/deprecated/` - 非推奨ドキュメント
- `docs/archive/deployment-projects/` - 完了したデプロイプロジェクト
- `docs/archive/architecture-legacy/` - 旧アーキテクチャドキュメント

詳細は [アーカイブREADME](../archive/README.md) を参照してください。

---

## 🔗 関連リンク

- [アーキテクチャドキュメント](../architecture/) - システム設計・UML図
- [実装ガイド](../implementation/) - 実装詳細とベストプラクティス
- [仕様書](../specifications/) - 機能仕様と要件定義
- [テストドキュメント](../testing/) - テスト戦略と実行ガイド
- [アーカイブ](../archive/) - 古いドキュメント

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
