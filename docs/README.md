# Confluence仕様書要約チャットボット - ドキュメント

## 📁 ドキュメント構成

### **📋 基本仕様**
- `spec.md` - プロダクト仕様書（機能要件・非機能要件・アーキテクチャ）
- `blueprint.md` - 開発方針・スタイルガイド

### **🔧 技術実装**
- `lancedb-integration-guide.md` - LanceDB統合ガイド（768次元ベクトル）
- `hybrid-search-contract.md` - ハイブリッド検索仕様・実装状況
- `search-bm25.md` - BM25/Lunr検索仕様
- `search-tuning-plan.md` - 検索チューニング設計・要件

### **🧠 AI・検索品質**
- `keyword-extraction-strategy.md` - キーワード抽出戦略
- `keyword-extraction-algorithm-design.md` - キーワード抽出アルゴリズム設計
- `keyword-extractor-class-design.md` - キーワード抽出クラス設計
- `vector-search-testing-guide.md` - ベクトル検索テストガイド
- `case_classroom-management-search-quality-test.md` - 教室管理検索品質テスト

### **📊 データ・ドメイン知識**
- `domain-knowledge-extraction-strategy.md` - ドメイン知識抽出戦略
- `domain-knowledge-extraction-production-guide.md` - ドメイン知識抽出本番ガイド
- `domain-knowledge-extraction-readme.md` - ドメイン知識抽出README

### **🏷️ ラベル・フィルタリング**
- `label-system-overview.md` - ラベルシステム概要
- `label-system-design.md` - ラベルシステム設計
- `label-system-api.md` - ラベルシステムAPI

### **🔌 統合・API**
- `api-design.md` - API設計
- `firestore-integration-guide.md` - Firestore統合ガイド
- `genkit-design.md` - Genkit設計

### **🚀 運用・デプロイ**
- `deployment-guide.md` - デプロイメントガイド
- `error-handling.md` - エラーハンドリング
- `differential-sync-test-plan.md` - 差分同期テスト計画

### **📈 分析・最適化**
- `search-tuning-results.md` - 検索チューニング結果
- `confluence-fetch-analysis.md` - Confluence取得分析
- `confluence-sync-duplicate-analysis.md` - Confluence同期重複分析

### **📁 アーカイブ**
- `archive/` - 古いバージョンのドキュメント

## 🔄 最近の更新

### 2024年12月
- **重複ドキュメントの統合**: キーワード抽出・ベクトル検索テスト関連の重複を解消
- **ハイブリッド検索の実装状況更新**: 現在の実装状況を反映
- **ベクトル次元の統一**: 全ドキュメントで768次元に統一

## 📝 ドキュメント更新ガイドライン

1. **重複の回避**: 類似の内容は既存ドキュメントを更新
2. **実装状況の反映**: コードの変更に合わせてドキュメントを更新
3. **一貫性の維持**: 用語・仕様の一貫性を保つ
4. **アーカイブの活用**: 古いバージョンはarchiveフォルダに移動

## 🚨 注意事項

- ベクトル次元は **768次元** で統一
- ハイブリッド検索は **ベクトル検索が完全実装**、BM25検索は部分実装
- 検索品質テストは **教室管理** を中心に実施
