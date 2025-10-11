# 📁 Implementation ドキュメント

**最終更新**: 2025年10月11日

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
- 埋め込みモデル設定（Xenova Transformers、768次元）
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

以下のドキュメントは完了したプロジェクトや古い情報のため、`docs/archive/` に移動されました：

### 分析レポート (`docs/archive/analysis-reports/`)
- `scoring-simplification-analysis.md` - スコアリング簡素化分析
- `scoring-quality-checklist.md` - 品質チェックリスト

### バグ修正レポート (`docs/archive/bug-fix-reports/`)
- `markdown-processing-fixes.md` - Markdown処理修正レポート (2025-10-08)

### パフォーマンス分析 (`docs/archive/performance-analysis/`)
- `server-startup-analysis.md` - サーバー起動時間分析
- `nextjs-compile-time-optimization.md` - Next.jsコンパイル時間最適化

### 非推奨 (`docs/archive/deprecated/`)
- `current-implementation-status.md` - 古い実装状況 (2024-12)
- `api-design.md` - 古いAPI設計 (2025-09)

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

