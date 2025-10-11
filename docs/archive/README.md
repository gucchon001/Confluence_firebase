# 🗄️ アーカイブドキュメント

**最終更新**: 2025年10月11日

このディレクトリには、過去のプロジェクト、完了した分析、修正済みの問題、および非推奨になったドキュメントが保管されています。

---

## 📂 ディレクトリ構造

```
docs/archive/
├── analysis-reports/       # 完了した分析レポート
├── bug-fix-reports/        # 修正済みバグのレポート
├── performance-analysis/   # パフォーマンス分析レポート
├── deployment-projects/    # 完了したデプロイプロジェクト
├── deprecated/             # 非推奨・古いドキュメント
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

