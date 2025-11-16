# 📁 Implementation ドキュメント

**最終更新**: 2025年11月16日

このディレクトリには、Confluence Firebaseプロジェクトの実装に関する**現行有効な**ドキュメントのみが含まれています。

## 🔄 ドキュメント整理について

**2025年11月16日**: ドキュメント整理を実施しました。

### 統合先

以下のドキュメントは`docs/architecture`に統合されました：

| 元のファイル | 統合先 |
|------------|--------|
| `ai-models-configuration.md` | `docs/architecture/03.03.01-ai-models-configuration.md` |
| `error-handling.md` | `docs/architecture/03.03.02-error-handling.md` |
| `lancedb-data-structure-specification.md` | `docs/architecture/01.02.02-lancedb-data-structure-specification.md` |
| `firestore-integration-guide.md` | `docs/architecture/01.02.03-firestore-integration-guide.md` |
| `label-system-api.md` | `docs/architecture/04.01.02-label-system-api.md` |
| `domain-knowledge-extraction-comprehensive-guide.md` | `docs/architecture/04.02.01-domain-knowledge-extraction-guide.md` |
| `current-implementation-status.md` | `docs/architecture/01.03.01-current-implementation-status.md` |

### アーカイブ先

以下のドキュメントは`docs/archive`に移動されました：

- **分析レポート**: `docs/archive/analysis-reports/`（`docs/analysis`から全ファイル）
- **重複分析**: `docs/archive/implementation/duplication-analysis/`（11ファイル）
- **詳細分析**: `docs/archive/implementation/analysis-reports/`（コード詳細分析、問題分析など）

詳細は [`docs/archive/documentation-consolidation-plan.md`](../archive/documentation-consolidation-plan.md) を参照してください。

---

## 🗂️ 現在のドキュメント

### 仕様書

#### [jira-field-mapping.md](./jira-field-mapping.md)
Jiraフィールドマッピング仕様
- JiraデータとLanceDB/StructuredLabelのマッピング
- フィールド変換ロジック
- 統合計画の詳細仕様

---

## 📚 関連ドキュメント

### アーキテクチャドキュメント
主要な仕様書は`docs/architecture`に集約されています：

- **システム設計**: `docs/architecture/README.md`
- **データベース仕様**: `docs/architecture/01.02.02-lancedb-data-structure-specification.md`
- **AI設定**: `docs/architecture/03.03.01-ai-models-configuration.md`
- **エラーハンドリング**: `docs/architecture/03.03.02-error-handling.md`

### アーカイブドキュメント
完了したプロジェクトや古い情報は`docs/archive`に移動されています。

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

- [アーキテクチャドキュメント](../architecture/README.md)
- [アーカイブディレクトリ](../archive/)
- [ドキュメント全体のREADME](../README.md)

---

## 📞 サポート

ドキュメントに関する質問や更新が必要な場合は、開発チームにお問い合わせください。
