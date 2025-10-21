# Operations ドキュメント

**最終更新**: 2025年10月20日  
**現在のPhase**: Phase 5完了

Confluence Firebase RAGシステムの運用に関する**現行有効な**ドキュメントです。

---

## ✨ 最新情報（2025-10-20）

🎉 **Phase 5完了！** 並列検索実装とパフォーマンス最適化により、**検索発見率100%を維持しつつ高速化を達成**しました。

### 主な成果
- ✅ 並列検索実装（ベクトル検索 + BM25検索）
- ✅ ハイブリッド検索強化（RRF融合 + Composite Scoring）
- ✅ 検索重み配分最適化（BM25 50% + タイトル 25% + ラベル 15% + ベクトル 5%）
- ✅ LanceDB接続プーリング
- ✅ 検索キャッシュ拡大（TTL 15分、maxSize 5000）

### Knowledge Graph について
- **実装**: 完了（ノード679件、エッジ24,208件）
- **ステータス**: 🔴 **無効化済み**
- **理由**: パフォーマンス悪化（9.2秒オーバーヘッド）に対して品質向上なし
- **将来計画**: デュアルモード検索（高速モード/詳細分析モード）

詳細は以下をご覧ください：
- [Phase 5 Week 2完了レポート](../architecture/phase5-week2-completion-report.md)
- [Knowledge Graph README](../architecture/KNOWLEDGE_GRAPH_README.md)

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
| [deployment-guide.md](./deployment-guide.md) | **包括的デプロイガイド**<br>環境変数設定、データ準備、デプロイ手順、トラブルシューティング | ⭐⭐⭐ |
| [production-deployment-checklist.md](./production-deployment-checklist.md) | **本番デプロイチェックリスト**<br>デプロイ前の確認事項、本番環境設定 | ⭐⭐⭐ |
| [firebase-app-hosting-configuration.md](./firebase-app-hosting-configuration.md) | **Firebase App Hosting設定**<br>apphosting.yaml設定（動作確認済み）<br>環境変数の正しい設定方法 | ⭐⭐⭐ |
| [firebase-app-hosting-troubleshooting.md](./firebase-app-hosting-troubleshooting.md) | **トラブルシューティング**<br>よくあるエラーと解決方法、ビルド失敗の対応 | ⭐⭐ |
| [required-environment-variables.md](./required-environment-variables.md) | **必須環境変数一覧**<br>ビルド時/ランタイム別の環境変数 | ⭐⭐⭐ |
| [build-optimization-guide.md](./build-optimization-guide.md) | **ビルド最適化ガイド**<br>ビルド時間短縮、データダウンロード戦略 | ⭐⭐ |
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

### 🌐 開発環境・ブランチ戦略

| ドキュメント | 説明 | 重要度 |
|------------|------|--------|
| [branch-strategy-guide.md](./branch-strategy-guide.md) | **ブランチ戦略ガイド**<br>mainブランチ（本番）とphase-0aブランチ（開発）の運用<br>ポート分離（9003/9004） | ⭐⭐⭐ |
| [network-sharing-guide.md](./network-sharing-guide.md) | **ネットワーク共有ガイド**<br>ローカル開発環境の共有方法 | ⭐ |
| [migration-guide.md](./migration-guide.md) | **リポジトリ移管ガイド**<br>必要ファイルのチェックリスト | ⭐ |

---

### ☁️ Cloud Storage・リージョン

| ドキュメント | 説明 | 重要度 |
|------------|------|--------|
| [cloud-storage-region-analysis.md](./cloud-storage-region-analysis.md) | **リージョン分析レポート**<br>Cloud Storage: US-CENTRAL1<br>Firestore: asia-northeast1<br>リージョン不整合の影響分析 | ⭐⭐ |
| [latest-bucket-status.md](./latest-bucket-status.md) | **バケット状態の最新情報**<br>データ配布戦略 | ⭐⭐ |

**注意**: Cloud StorageとFirestoreのリージョン不整合により、潜在的なレイテンシ影響があります。

---

## 🚀 クイックスタート

### 🆕 新メンバー向け

1. **システム全体を理解する**
   - [アーキテクチャドキュメント](../architecture/data-flow-diagram-lancedb.md)
   - [システム設計図](../architecture/blueprint.md)

2. **開発環境をセットアップする**
   - [デプロイガイド](./deployment-guide.md)
   - [必須環境変数](./required-environment-variables.md)
   - [ブランチ戦略](./branch-strategy-guide.md)

3. **データ同期を設定する**
   - [データ同期戦略](./data-synchronization-strategy.md)
   - [自動同期セットアップ](./firebase-scheduled-sync-setup.md)

### 🔧 運用担当者向け

1. **本番デプロイ**
   - [本番デプロイチェックリスト](./production-deployment-checklist.md)
   - [Firebase App Hosting設定](./firebase-app-hosting-configuration.md)

2. **監視・メンテナンス**
   - [バックアップ管理](./backup-management-guide.md)
   - [トラブルシューティング](./firebase-app-hosting-troubleshooting.md)

3. **パフォーマンス最適化**
   - [ビルド最適化ガイド](./build-optimization-guide.md)
   - [リージョン分析](./cloud-storage-region-analysis.md)

### 🐛 トラブルシューティング

問題が発生した場合：

1. **[firebase-app-hosting-troubleshooting.md](./firebase-app-hosting-troubleshooting.md)** - よくあるエラーを確認
2. **ログを確認**
   - Firebase Console: ビルド・デプロイログ
   - Cloud Functions: 同期ログ
   - Cloud Logging: アプリケーションログ
3. **チェックリストを確認**
   - [本番デプロイチェックリスト](./production-deployment-checklist.md)
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

以下のドキュメントは完了したプロジェクトや古い情報のため、`docs/archive/` に移動されました：

### operations-legacy
- `phase-0a-4-96s-search-issue.md` - Phase 0A-4緊急対応（解決済み）
- `phase-0a-4-next-steps.md` - Phase 0A-4次のステップ（完了）
- `phase-0a-4-search-performance-emergency.md` - 緊急対応（解決済み）

### その他のアーカイブ
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
1. `docs/archive/operations-legacy/` に移動
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
