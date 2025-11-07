# 📁 Implementation ドキュメント

**最終更新**: 2025年11月6日

このディレクトリには、Confluence Firebaseプロジェクトの実装に関する**現行有効な**ドキュメントのみが含まれています。

---

## 🗂️ ドキュメント一覧

### 🎯 システム設計・仕様

#### [error-handling.md](./error-handling.md)
エラーハンドリング仕様書
- APIエラーレスポンスフォーマット
- バッチ処理のエラーハンドリング
- リトライポリシーと監視

#### [ai-models-configuration.md](./ai-models-configuration.md)
AIモデル設定ガイド
- Gemini 2.5 Flash設定（温度、topK、maxOutputTokensなど）
- 埋め込みモデル設定（Gemini Embeddings API (text-embedding-004)、768次元）
- パラメータ調整ガイド

#### [lancedb-data-structure-specification.md](./lancedb-data-structure-specification.md)
LanceDB仕様書
- スキーマ定義（FullLanceDBSchema）
- フィールド詳細仕様
- データ型の対応関係
- ベストプラクティス

#### [firestore-integration-guide.md](./firestore-integration-guide.md)
Firestore統合ガイド
- コレクション構造
- セキュリティルール
- データモデル

---

### 🏷️ ラベルシステム

#### [label-system-overview.md](./label-system-overview.md)
ラベルシステム概要
- システムの主要な特徴
- フィルタリング仕様
- 使用例

#### [label-system-design.md](./label-system-design.md)
ラベルシステム設計書
- アーキテクチャ設計
- クラス設計
- データフロー

#### [label-system-api.md](./label-system-api.md)
ラベルシステムAPI仕様
- LabelManagerクラスAPI
- ユーティリティ関数
- 使用例

---

### 🧠 ドメイン知識

#### [domain-knowledge-extraction-comprehensive-guide.md](./domain-knowledge-extraction-comprehensive-guide.md)
ドメイン知識抽出包括ガイド
- ドメイン知識抽出システムの全体像
- 8,122個のキーワード管理
- 抽出パイプライン

---

### 📋 課題管理

#### [remaining-issues.md](./remaining-issues.md)
継続的な課題管理
- 既知の問題
- 技術的改善項目
- 優先度別の課題リスト

**更新頻度**: 定期的に更新

---

### 📊 監査レポート

#### [implementation-docs-audit-report.md](./implementation-docs-audit-report.md)
ドキュメント監査レポート
- 2025年10月11日実施
- 16ファイルの詳細監査
- アーカイブ推奨の判断基準

---

## 🗄️ アーカイブ済みドキュメント

以下のドキュメントは完了したプロジェクトや古い情報のため、`docs/archive/implementation/` に移動されました：

### Phase完了レポート (`docs/archive/implementation/phase-reports/`)
- `phase-0a-4-completion-report.md` - Phase 0A-4完了レポート
- `phase-0a-4-gen2-inmemory-implementation.md` - Phase 0A-4実装
- `phase-0a-4-production-deployment-fixes.md` - Phase 0A-4デプロイ修正
- `phase-4-kg-integration-completion-report.md` - Phase 4完了レポート
- `phase-4-kg-integration-plan.md` - Phase 4計画
- `phase-1-3-spec-compliance.md` - Phase 1-3完了
- `phase-1-4-implementation-status.md` - Phase 1-4完了

### バグ修正レポート (`docs/archive/implementation/bug-fixes/`)
- `bm25-score-propagation-bug-fix.md` - BM25スコア伝播バグ修正 (2025-10-16)
- `meeting-notes-filtering-fix.md` - ミーティングノートフィルタリング修正
- `lancedb-label-filtering-fix-report.md` - LanceDBラベルフィルタリング修正
- `quality-degradation-root-cause-report.md` - 品質劣化根本原因レポート

### 分析レポート (`docs/archive/implementation/analysis-reports/`)
- `vector-space-misconception-clarification.md` - ベクトル空間の誤解の解消
- `vector-space-stability-analysis.md` - ベクトル空間安定性分析
- `kg-contribution-analysis-report.md` - KG貢献度分析レポート
- `current-search-quality-report.md` - 現在の検索品質レポート

### その他のアーカイブ (`docs/archive/`)
- 分析レポート (`docs/archive/analysis-reports/`)
- バグ修正レポート (`docs/archive/bug-fix-reports/`)
- パフォーマンス分析 (`docs/archive/performance-analysis/`)
- 非推奨 (`docs/archive/deprecated/`)

---

## 📝 ドキュメント管理方針

### 現行ドキュメントの基準
- ✅ 現在の実装を正確に反映している
- ✅ 定期的に参照される
- ✅ 継続的に更新される

### アーカイブの基準
- 📦 完了したプロジェクトの分析レポート
- 📦 修正済みの問題のレポート
- 📦 古い技術スタックの情報
- 📦 実装と大きく乖離した仕様

### ドキュメント更新時のルール
1. 実装変更時は関連ドキュメントを同時に更新
2. 古くなったドキュメントは定期的にアーカイブ
3. アーカイブ時は監査レポートを作成
4. このREADMEを最新の状態に保つ

---

## 🔗 関連ドキュメント

- [アーカイブディレクトリ](../archive/)
- [Architecture実装検証](../architecture/architecture-implementation-verification.md)
- [仕様書実装ギャップ分析](../specifications/implementation-gap-analysis.md)
- [ドキュメント全体のREADME](../README.md)

---

## 📞 サポート

ドキュメントに関する質問や更新が必要な場合は、開発チームにお問い合わせください。

