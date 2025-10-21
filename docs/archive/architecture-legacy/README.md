# Architecture Legacy - アーカイブ

このディレクトリには、過去のバージョンの設計書や完了したPhaseのドキュメントが保管されています。

**アーカイブ日**: 2025年10月20日  
**理由**: ドキュメント整理とメンテナンス性向上

---

## 📦 アーカイブされたドキュメント

### Hybrid Search関連（Phase 4以前）

| ファイル | 説明 | 作成日 | アーカイブ理由 |
|---------|------|--------|--------------|
| `hybrid-search-specification-v5.md` | ハイブリッド検索仕様 v5 | 2025-10 | 最新版（latest）に統合 |
| `hybrid-search-optimization-proposals.md` | 最適化提案書 | 2025-10 | Phase 5で実装完了 |
| `hybrid-search-flow-and-parallelization-analysis.md` | フロー分析と並列化検討 | 2025-10 | Phase 5で並列化実装完了 |
| `enhanced-hybrid-search-design.md` | 拡張設計書 | 2025-10 | 現在の実装に統合済み |

**最新ドキュメント**: `../architecture/hybrid-search-specification-latest.md`

---

### Phase 5関連

| ファイル | 説明 | 作成日 | アーカイブ理由 |
|---------|------|--------|--------------|
| `phase5-week2-completion-report.md` | Week 2完了レポート | 2025-10-17 | **残存** (最新) |
| `phase5-week1-completion-report.md` | Week 1完了レポート | 2025-10-17 | Week 2に統合 |
| `phase-5-improvement-plan.md` | Phase 5改善計画 | 2025-10 | 実装完了 |
| `phase5-parallel-search-risk-analysis.md` | 並列検索リスク分析 | 2025-10 | 実装完了・リスク解消 |
| `phase5-code-quality-check.md` | コード品質チェック | 2025-10 | チェック完了 |

**最新レポート**: `../architecture/phase5-week2-completion-report.md`

---

### Knowledge Graph関連（Phase 0A-2）

| ファイル | 説明 | 作成日 | アーカイブ理由 |
|---------|------|--------|--------------|
| `knowledge-graph-comprehensive-overview.md` | KG総合ドキュメント | 2025-10-19 | 無効化判断完了 |
| `label-domain-kg-integration.md` | ラベル・ドメイン・KG統合設計 | 2025-10-14 | 設計から実装に移行 |

**Knowledge Graph現状**: 
- ✅ 実装完了（ノード679件、エッジ24,208件）
- 🔴 **無効化済み**（パフォーマンス理由）
- 📋 将来計画: デュアルモード検索

**最新ドキュメント**: 
- `../architecture/KNOWLEDGE_GRAPH_README.md`
- `../architecture/KG_DOCUMENTATION_SUMMARY.md`

---

### Genkit関連

| ファイル | 説明 | 作成日 | アーカイブ理由 |
|---------|------|--------|--------------|
| `genkit-migration-and-expansion-roadmap.md` | Genkit移行・拡張ロードマップ | 2025-01 | 部分統合完了 |

**Genkit現状**:
- ✅ 部分統合完了（v1.19.2）
- ✅ 実装済みFlows: 3つ
- 🔄 ハイブリッド運用中

**最新ドキュメント**: `../architecture/genkit-design.md`

---

### その他

| ファイル | 説明 | 作成日 | アーカイブ理由 |
|---------|------|--------|--------------|
| `foundation-first-strategy.md` | 基盤優先戦略 | 2025-10 | Phase 0A完了 |

---

## 🔍 アーカイブの参照方法

### 歴史的経緯を調査する場合

1. **Phase 5の開発プロセスを知りたい**
   - `phase-5-improvement-plan.md`: 当初の計画
   - `phase5-week1-completion-report.md`: Week 1の成果
   - `../architecture/phase5-week2-completion-report.md`: 最終成果

2. **ハイブリッド検索の進化を追跡したい**
   - `enhanced-hybrid-search-design.md`: 初期設計
   - `hybrid-search-specification-v5.md`: v5仕様
   - `../architecture/hybrid-search-specification-latest.md`: 最新仕様

3. **Knowledge Graphの判断経緯を知りたい**
   - `knowledge-graph-comprehensive-overview.md`: 実装と無効化判断
   - `../architecture/KNOWLEDGE_GRAPH_README.md`: 現状と将来計画

### パフォーマンス最適化の歴史

| 最適化項目 | ドキュメント | 結果 |
|----------|------------|------|
| 並列検索実装 | `phase5-parallel-search-risk-analysis.md` | ✅ 実装完了（品質100%維持） |
| ハイブリッド検索強化 | `hybrid-search-optimization-proposals.md` | ✅ RRF融合 + Composite Scoring実装 |
| KG統合 | `knowledge-graph-comprehensive-overview.md` | 🔴 無効化（パフォーマンス優先） |

---

## 📋 ベストプラクティス

### アーカイブされたドキュメントの使い方

✅ **推奨**:
- 歴史的経緯の調査
- 過去の設計判断の理解
- 類似機能の開発時の参考

❌ **非推奨**:
- 新規開発のベースとして使用（最新版を参照）
- 現在の仕様として参照（最新版を参照）

### 新しいドキュメントをアーカイブする際の基準

1. **新しいバージョンが存在する**
   - 例: v5 → latest

2. **計画が実装完了した**
   - 例: improvement-plan → completion-report

3. **判断が確定した**
   - 例: KG統合検討 → KG無効化判断

---

## 🔗 関連リンク

- [現在のArchitectureドキュメント](../architecture/)
- [実装ガイド](../implementation/)
- [プロジェクト全体のREADME](../../README.md)

---

**質問・フィードバック**: プロジェクトチームまで

