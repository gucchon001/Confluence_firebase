# ドキュメント統合・整理計画

**作成日**: 2025年11月10日  
**目的**: `docs/analysis`と`docs/implementation`の整理と保守性向上

## 📊 現状分析

### docs/analysis (26ファイル)
- 問題分析・根本原因分析レポート
- 最適化分析レポート
- 多くは完了した問題の分析

### docs/implementation (41ファイル)
- 現行有効な仕様書（統合候補）
- 重複分析レポート（11ファイル）
- 詳細コード分析
- 問題分析

## 🎯 整理方針

### 1. 現行有効な仕様書 → `docs/architecture`に統合

#### 統合対象（docs/implementation → docs/architecture）
1. **AI・モデル設定**
   - `ai-models-configuration.md` → `03.03.01-ai-models-configuration.md`

2. **エラーハンドリング**
   - `error-handling.md` → `03.03.02-error-handling.md`

3. **データベース仕様**
   - `lancedb-data-structure-specification.md` → `01.02.02-lancedb-data-structure-specification.md`
   - `firestore-integration-guide.md` → `01.02.03-firestore-integration-guide.md`

4. **ラベルシステム**（既に`04.01.01-structured-label-design.md`があるため、参照を更新）
   - `label-system-overview.md` → 内容を`04.01.01-structured-label-design.md`に統合
   - `label-system-design.md` → 内容を`04.01.01-structured-label-design.md`に統合
   - `label-system-api.md` → `04.01.02-label-system-api.md`

5. **ドメイン知識**
   - `domain-knowledge-extraction-comprehensive-guide.md` → `04.02.01-domain-knowledge-extraction-guide.md`

6. **実装状況**
   - `current-implementation-status.md` → `01.03.01-current-implementation-status.md`

### 2. 完了した分析レポート → `docs/archive/analysis-reports/`に移動

#### アーカイブ対象（docs/analysis）
- すべての分析レポート（26ファイル）
- 完了した問題の分析
- 修正済みの問題の根本原因分析

#### アーカイブ対象（docs/implementation）
- 重複分析レポート（11ファイル）
  - `*-duplication-analysis.md`
- 詳細コード分析
  - `*-step-by-step-analysis.md`
  - `*-logical-analysis.md`
  - `content-extraction-*.md`（詳細分析系）
  - `keyword-extraction-logic-step-by-step.md`
- 問題分析
  - `*-issue-analysis.md`
  - `hybrid-extraction-issue-analysis.md`

### 3. `docs/implementation`の役割

統合後は以下のみ保持：
- 現行システムの重要な仕様書で`docs/architecture`に統合されないもの
- または`docs/architecture`に統合したファイルへの参照のみ

## 📋 実行計画

### Phase 1: 現行仕様書の統合
1. `docs/architecture`に採番規則に従って新しいファイルを作成
2. 既存の`docs/implementation`の内容を統合
3. 相互参照を更新
4. `docs/architecture/README.md`を更新

### Phase 2: アーカイブ
1. `docs/archive/analysis-reports/`に`docs/analysis`のファイルを移動
2. `docs/archive/implementation/analysis-reports/`に分析レポートを移動
3. `docs/archive/implementation/duplication-analysis/`に重複分析を移動
4. アーカイブREADMEを更新

### Phase 3: クリーンアップ
1. `docs/implementation`の残りファイルを整理
2. `docs/analysis`ディレクトリを削除
3. すべてのREADMEを更新
4. 参照リンクを修正

## ✅ 期待される効果

1. **保守性向上**: 現行仕様が`docs/architecture`に集約され、参照しやすくなる
2. **明確化**: アーカイブと現行仕様の区別が明確になる
3. **整理**: ファイル数が減少し、ナビゲーションが容易になる
4. **一貫性**: `docs/architecture`の採番規則に統一される

## 📝 注意事項

- アーカイブ前に既存の参照をすべて確認
- 重要な情報は`docs/architecture`に統合
- アーカイブ後も参照できるよう、READMEに記載

