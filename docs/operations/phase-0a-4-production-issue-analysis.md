# Phase 0A-4 本番環境パフォーマンス問題分析

**作成日**: 2025年10月19日  
**ステータス**: 🔍 調査中

---

## 📊 問題の概要

本番環境デプロイ後、以下のパフォーマンス問題が発生しました：

```
検索時間: 145秒
AI生成時間: 35秒
総処理時間: 180秒以上
```

これは開発環境の実測値（検索8秒、AI生成19秒、合計27秒）と大きく乖離しています。

---

## 🎯 推定される原因

### 1. **Cold Start問題（最有力）**
- Firebase App Hostingの初回リクエスト時、すべてのサービスが未初期化
- 特に以下の初期化に時間がかかる可能性：
  - Kuromoji辞書の読み込み（約2-3秒）
  - LunrインデックスのCloud Storageからの読み込み（約1-2秒）
  - Embedding モデル（Xenova Transformers）の初回ロード（約5-10秒）
  - LanceDBのCloud Storageからのダウンロード・接続（約3-5秒）

**Cold Startの合計推定時間**: 約10-20秒

しかし、**145秒は異常に長い**ため、他の問題も疑われます。

---

### 2. **Embedding生成のパフォーマンス低下**
- **原因候補**:
  - Cloud Runのメモリ/CPU制限（現在: 1CPU）
  - @xenova/transformers のモデル初回ロードが遅い
  - ネットワークレイテンシ（HuggingFace CDNからのモデルダウンロード）

**対策（実装済み）**:
- ✅ Embedding生成にタイムアウト追加（30秒）
- ✅ 詳細なパフォーマンスログ追加
- ✅ キャッシュ利用時の高速化確認

**対策（今後検討）**:
- Cloud Runのメモリ/CPU増強（1CPU → 2CPU）
- Embeddingモデルの事前読み込み（instrumentation.js）

---

### 3. **LanceDB接続の遅延**
- **原因候補**:
  - Cloud Storageからのダウンロードに時間がかかる（約50MB）
  - LanceDBのネイティブバイナリ初期化の遅延
  - ネットワークレイテンシ

**対策（実装済み）**:
- ✅ 最適化されたLanceDB接続（optimized-lancedb-client）
- ✅ 詳細なパフォーマンスログ追加

**対策（今後検討）**:
- LanceDBの事前ダウンロード・初期化（instrumentation.js）

---

### 4. **Keyword抽出の遅延**
- **原因候補**:
  - Kuromoji辞書の読み込みが遅い
  - 日本語トークナイズ処理の遅延

**対策（実装済み）**:
- ✅ Kuromoji辞書を本番ビルドに含める（copy-webpack-plugin）
- ✅ 詳細なパフォーマンスログ追加

---

## 🔍 Cloud Loggingでの確認方法

### ステップ1: Cloud Loggingにアクセス

```
https://console.cloud.google.com/logs/query?project=confluence-copilot-ppjye
```

### ステップ2: フィルタークエリ

```
resource.type="cloud_run_revision"
resource.labels.service_name="confluence-chat"
severity>=WARNING
```

または、詳細ログを見る場合：

```
resource.type="cloud_run_revision"
resource.labels.service_name="confluence-chat"
(textPayload=~"searchLanceDB" OR textPayload=~"Embedding" OR textPayload=~"Slow")
```

### ステップ3: 確認すべきログメッセージ

| ログメッセージ | 意味 | 期待値 | 異常値 |
|:---|:---|:---|:---|
| `⚠️ [searchLanceDB] Slow parallel initialization` | 並列初期化の遅延 | <5秒 | >5秒 |
| `⚠️ [searchLanceDB] Slow embedding generation` | Embedding生成の遅延 | <5秒 | >5秒 |
| `⚠️ [searchLanceDB] Slow keyword extraction` | キーワード抽出の遅延 | <2秒 | >2秒 |
| `⚠️ [searchLanceDB] Slow LanceDB connection` | LanceDB接続の遅延 | <2秒 | >2秒 |
| `⚠️ [Embedding] Slow generation` | Embedding生成の遅延 | <1秒 | >1秒 |
| `Embedding generation timeout` | Embeddingタイムアウト | なし | あり（致命的） |

---

## 📈 期待される改善効果

### Phase 0A-4で実装した対策の効果

| 対策 | 期待される改善 |
|:---|:---|
| Embedding タイムアウト追加 | タイムアウト時の早期エラー検知（30秒） |
| 詳細ログ追加 | ボトルネック特定の精度向上 |
| Kuromoji辞書の事前コピー | 初回起動時のKuromoji読み込み高速化（2-3秒削減） |

### 今後検討すべき対策

| 対策 | 期待される改善 | 優先度 |
|:---|:---|:---|
| Cloud Run CPU増強（1 → 2） | 並列処理の高速化（10-20秒削減） | 高 |
| Embeddingモデル事前ロード | Cold Start削減（5-10秒削減） | 高 |
| LanceDB事前ダウンロード | LanceDB接続の高速化（3-5秒削減） | 中 |
| Cloud Storage最適化 | ダウンロード時間削減（1-2秒削減） | 低 |

---

## 🚀 次のアクション

### 1. Cloud Loggingで実際の遅延箇所を特定
- 上記のフィルタークエリでログを確認
- 遅延が発生している具体的な処理を特定

### 2. ボトルネックに応じた対策実装
- **Embedding生成が遅い場合**:
  - Cloud RunのCPU増強を検討
  - Embeddingモデルの事前ロード実装
- **LanceDB接続が遅い場合**:
  - LanceDBの事前ダウンロード・初期化実装
- **Keyword抽出が遅い場合**:
  - Kuromoji辞書の事前ロード確認

### 3. 再デプロイとパフォーマンス検証
- 対策実装後、再度本番環境でテスト
- Cloud Loggingで改善効果を確認

---

## 📝 関連ドキュメント

- [production-deployment-checklist.md](./production-deployment-checklist.md) - 本番デプロイチェックリスト
- [phase-0a-4-completion-report.md](../implementation/phase-0a-4-completion-report.md) - Phase 0A-4完了レポート
- [firebase-app-hosting-troubleshooting.md](./firebase-app-hosting-troubleshooting.md) - Firebase App Hostingトラブルシューティング

---

**作成者**: AI Assistant  
**最終更新**: 2025年10月19日

