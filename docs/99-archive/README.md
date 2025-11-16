# 🗄️ アーカイブドキュメント

**最終更新**: 2025年10月15日

このディレクトリには、過去のプロジェクト、完了した分析、修正済みの問題、および非推奨になったドキュメントが保管されています。

## ✨ 最新アーカイブ

### 2025-11-13: デプロイドキュメント統合

🎊 **デプロイ関連ドキュメントを統合！** 以下のドキュメントを`deployment-guide.md`に統合し、アーカイブに移動しました：

- **統合済みデプロイドキュメント** (`operations/deployment-integrated-2025-11-13/`)
  - `production-deployment-checklist.md` - デプロイチェックリスト
  - `production-schema-verification-guide.md` - スキーマ確認ガイド
  - `production-deployment-after-db-rebuild.md` - DB再構築後手順
  - `firebase-app-hosting-configuration.md` - Firebase App Hosting設定
  - `firebase-app-hosting-troubleshooting.md` - Firebase App Hostingトラブルシューティング
  - `required-environment-variables.md` - 必須環境変数一覧
  - `build-optimization-guide.md` - ビルド最適化ガイド

**統合先**: [deployment-guide.md](../operations/deployment-guide.md)

詳細は [deployment-integrated-2025-11-13/README.md](./operations/deployment-integrated-2025-11-13/README.md) を参照してください。

### 2025-10-15: Phase 0A 完了

🎊 **Phase 0A 完了！** 以下の計画書を完了済みとしてアーカイブしました：

- **phase-0A-implementation-plan.md** - Phase 0A 初期計画（100%達成で完了）
- **phase-0a-2-implementation-plan.md** - Phase 0A-2 Knowledge Graph実装計画（完了）
- **graphrag-tuned-architecture.md** - GraphRAG計画（Phase 0A-2で実装完了）

詳細は [docs/implementation/phase-0a-2-completion-report.md](../implementation/phase-0a-2-completion-report.md) をご覧ください。

---

## 📂 ディレクトリ構造

```
docs/archive/
├── analysis-reports/       # 完了した分析レポート
├── bug-fix-reports/        # 修正済みバグのレポート
├── performance-analysis/   # パフォーマンス分析レポート
├── deployment-projects/    # 完了したデプロイプロジェクト
├── deprecated/             # 非推奨・古いドキュメント
├── operations/             # Operations関連のアーカイブ
│   ├── deployment-integrated-2025-11-13/  # 統合済みデプロイドキュメント
│   ├── emergency-reports/  # 緊急対応レポート
│   ├── completed-reports/  # 完了レポート
│   └── analysis-reports/   # 分析レポート
├── [完了した計画書]        # Phase 0A計画書等（2025-10-15追加）
└── [その他の履歴データ]
```

---

## 📋 カテゴリ別ドキュメント

### 🔬 分析レポート (`analysis-reports/`)

完了した分析プロジェクトのレポート

#### [scoring-simplification-analysis.md](./analysis-reports/scoring-simplification-analysis.md)
スコアリング簡素化の影響分析
- **作成日**: 詳細不明
- **内容**: 複雑なスコアリングロジックの簡素化
- **結果**: パフォーマンス向上、品質維持
- **状態**: 実装完了

#### [scoring-quality-checklist.md](./analysis-reports/scoring-quality-checklist.md)
スコアリング簡素化後の品質チェックリスト
- **作成日**: 詳細不明
- **内容**: 最適化後の品質確認項目
- **状態**: チェック完了

---

### 🐛 バグ修正レポート (`bug-fix-reports/`)

修正済みバグの詳細レポート

#### [markdown-processing-fixes.md](./bug-fix-reports/markdown-processing-fixes.md)
Markdown処理の修正レポート
- **作成日**: 2025-10-08
- **問題**: 見出し内の数字分離、テーブル崩れなど
- **修正**: `src/lib/markdown-utils.tsx` 更新
- **状態**: 修正完了

---

### ⚡ パフォーマンス分析 (`performance-analysis/`)

パフォーマンス最適化プロジェクトの分析レポート

#### [server-startup-analysis.md](./performance-analysis/server-startup-analysis.md)
サーバー起動時間の分析
- **作成日**: 詳細不明
- **内容**: ウォーム/コールドスタートの詳細分析
- **結果**: 3-5ms（ウォーム）、10-50ms（コールド）
- **状態**: 最適化完了

#### [nextjs-compile-time-optimization.md](./performance-analysis/nextjs-compile-time-optimization.md)
Next.jsコンパイル時間の最適化
- **作成日**: 詳細不明
- **内容**: 初回コンパイル時間（9.4秒）の分析
- **提案**: 本番ビルド使用、SWC最適化など
- **状態**: 分析完了

---

### 🚀 デプロイプロジェクト (`deployment-projects/`)

完了したデプロイプロジェクトの計画書

#### [deployment-plan-v1.md](./deployment-projects/deployment-plan-v1.md)
初回デプロイ計画書
- **作成日**: 2025-10-09
- **内容**: Firebase App Hostingへの初回デプロイ計画
- **状態**: デプロイ完了
- **成果**: 2025-10-10に安定版v1.0.0リリース

### 📚 Operations関連アーカイブ (`operations/`)

Operations関連のアーカイブドキュメント

#### 統合済みデプロイドキュメント (`operations/deployment-integrated-2025-11-13/`)
**統合日**: 2025-11-13  
**統合先**: [deployment-guide.md](../operations/deployment-guide.md)

以下のドキュメントは`deployment-guide.md`に統合され、アーカイブに移動されました：
- `production-deployment-checklist.md` - デプロイチェックリスト
- `production-schema-verification-guide.md` - スキーマ確認ガイド
- `production-deployment-after-db-rebuild.md` - DB再構築後手順
- `firebase-app-hosting-configuration.md` - Firebase App Hosting設定
- `firebase-app-hosting-troubleshooting.md` - Firebase App Hostingトラブルシューティング
- `required-environment-variables.md` - 必須環境変数一覧
- `build-optimization-guide.md` - ビルド最適化ガイド

詳細は [deployment-integrated-2025-11-13/README.md](./operations/deployment-integrated-2025-11-13/README.md) を参照してください。

#### 緊急対応レポート (`operations/emergency-reports/`)
- `production-performance-emergency-2025-10-20.md` - 本番環境パフォーマンス緊急対応（2025-10-20、解決済み）
- `huggingface-rate-limit-emergency.md` - Hugging Faceレートリミット緊急対応（2025-10-20、解決済み）

#### 完了レポート (`operations/completed-reports/`)
- `production-index-rebuild-completed.md` - 本番環境インデックス再構築完了報告（2025-11-05）
- `production-index-rebuild-instructions.md` - 本番環境インデックス再構築手順（2025-11-05）
- `phase2-performance-optimization-guide.md` - Phase 2パフォーマンス最適化ガイド（2025-10-20、完了）
- `lunr-performance-verification-guide.md` - Lunrパフォーマンス検証ガイド（2025-10-20、完了）

#### 分析レポート (`operations/analysis-reports/`)
- `latest-bucket-status.md` - バケット状態の最新情報（2025-10-19、古い状態情報）
- `cloud-storage-region-analysis.md` - Cloud Storageリージョン分析（2025-10-19、分析完了）

---

### 🎯 完了した計画書（2025-10-15追加）

Phase 0Aの完了により、以下の計画書をアーカイブしました。

#### [phase-0A-implementation-plan.md](./phase-0A-implementation-plan.md)
Phase 0A 基盤強化実装計画書
- **作成日**: 2025-10-12頃
- **内容**: Phase 0A全体の実装計画（Phase 0A-1、0A-1.5、0A-2）
- **目標**: 検索発見率17% → 81%
- **結果**: **100%達成** 🎉（目標を19%超過）
- **状態**: 完全達成によりアーカイブ

#### [phase-0a-2-implementation-plan.md](./phase-0a-2-implementation-plan.md)
Phase 0A-2 Knowledge Graph実装計画
- **作成日**: 2025-10-15
- **内容**: Knowledge Graph構築とSearch統合の詳細計画
- **目標**: 検索発見率83% → 100%
- **結果**: **100%達成** 🎉
- **実装内容**:
  - URLリンク・ページ番号参照抽出（1,348エッジ）
  - ドメイン・タグ関係構築（22,860エッジ）
  - Knowledge Graph検索統合（+5件平均拡張）
- **状態**: 実装完了によりアーカイブ

#### [graphrag-tuned-architecture.md](./graphrag-tuned-architecture.md)
GraphRAG調整アーキテクチャ計画
- **作成日**: 2025-10-12頃
- **内容**: Knowledge Graph導入の長期計画
- **Phase 0A-2での実装内容**:
  - ページ間参照関係の自動抽出
  - Structured Label活用による関係構築
  - 検索結果の関連ページ拡張
- **状態**: Phase 0A-2で基本機能実装完了

**📊 Phase 0A 全体の成果**:
- Phase 0A-1: 17% → 17%（初期実装）
- Phase 0A-1.5: 17% → 83%（+66%、キーワード抽出改善）
- Phase 0A-2: 83% → **100%**（+17%、Knowledge Graph統合）

詳細は [docs/implementation/phase-0a-2-completion-report.md](../implementation/phase-0a-2-completion-report.md) をご覧ください。

---

### ❌ 非推奨ドキュメント (`deprecated/`)

古い技術スタックや実装と乖離したドキュメント

#### Implementation関連

**[current-implementation-status.md](./deprecated/current-implementation-status.md)**
古い実装状況ドキュメント
- **作成日**: 2024年12月
- **問題**: 
  - Next.js 14 (現在15.3.3)
  - OpenAI API (現在Gemini 2.5 Flash)
  - ストリーミング「削除」(現在実装済み)
- **非推奨理由**: 技術スタックと実装状況が古い

**[api-design.md](./deprecated/api-design.md)**
古いAPI設計書
- **作成日**: 2025-09-11
- **問題**:
  - ストリーミングAPI未記載
  - 記載エンドポイントの多くが存在しない
  - 実装と大きく乖離
- **非推奨理由**: 現在の実装と一致しない

#### Operations関連

**[github-secrets-setup.md](./deprecated/github-secrets-setup.md)**
GitHub Secrets設定ガイド
- **作成日**: 2025-10-10
- **問題**: 
  - GitHub Actionsを削除したため不要
  - 現在はFirebase Functionsを使用
- **非推奨理由**: 削除済み機能のドキュメント

**[automated-data-sync.md](./deprecated/automated-data-sync.md)**
自動データ同期（複数実装方法）
- **作成日**: 2025-10-10
- **問題**:
  - オプションA、B、Cの3つの実装方法を説明
  - 実際はFirebase Functionsのみ使用
  - GitHub Actionsは削除済み
- **非推奨理由**: Firebase Functionsに統一したため

---

## 📊 その他のアーカイブファイル

### LanceDB関連
- `lancedb-documentation-index.md`
- `lancedb-implementation-report.md`
- `lancedb-integration-guide.md`
- `lancedb-optimization.md`
- `lancedb-test-plan.md`
- `lancedb-test-report-updated.md`
- `lancedb-test-results.md`
- `lancedb-troubleshooting.md`

### パフォーマンス関連
- `PERFORMANCE_ANALYSIS_RESULTS.md`
- `PERFORMANCE_INVESTIGATION_PLAN.md`
- `PERFORMANCE_OPTIMIZATION_SUMMARY.md`
- `performance-comparison-analysis.md`

### プロジェクト管理
- `CLEANUP_SUMMARY.md`
- `comprehensive-optimization-summary.md`
- `PROJECT_CLEANUP_PLAN.md`

### データスナップショット
- `archive-pages-2025-09-26T04-12-56-560Z.json`
- `bm25-search-optimization-2025-09-25T19-02-30-484Z.json`
- `vector-search-optimization-2025-09-25T19-00-56-866Z.json`
- `xxx-pages-2025-09-26T04-18-05-569Z.json`

---

## 🔍 アーカイブ検索のヒント

### 履歴を調べたい場合

1. **パフォーマンス最適化の履歴**: `performance-analysis/` を確認
2. **バグ修正の履歴**: `bug-fix-reports/` を確認
3. **古い仕様**: `deprecated/` を確認
4. **分析レポート**: `analysis-reports/` を確認

### アーカイブからの復元

アーカイブされたドキュメントの情報が必要な場合：
1. 該当ファイルを `docs/archive/` から確認
2. 情報が現在も有効であれば、新しいドキュメントとして再作成
3. 古い技術スタック情報は参考程度に

---

## ⚠️ 注意事項

- このディレクトリのドキュメントは**履歴目的**で保管されています
- 最新の実装を確認する場合は、`docs/implementation/`、`docs/architecture/`、`docs/specifications/` を参照してください
- アーカイブされたドキュメントの情報は古い可能性があります

---

## 📚 関連ドキュメント

- [Implementation フォルダ](../implementation/README.md) - 現行有効なドキュメント
- [Implementation 監査レポート](../implementation/implementation-docs-audit-report.md) - 監査結果
- [ドキュメント全体のREADME](../README.md) - 全体構成

---

## 📝 アーカイブ履歴

| 日付 | アクション | ファイル数 | 説明 |
|-----|----------|----------|------|
| 2025-10-11 | 整理 | 10件 | implementation/operations フォルダの監査とアーカイブ実施 |
| 2025-10-11 | 移動 | 7件 | implementationフォルダから分析レポート等を移動 |
| 2025-10-11 | 移動 | 3件 | operationsフォルダから非推奨ドキュメント等を移動 |

---

**保管方針**: アーカイブされたドキュメントは削除せず、プロジェクトの歴史として保管します。

