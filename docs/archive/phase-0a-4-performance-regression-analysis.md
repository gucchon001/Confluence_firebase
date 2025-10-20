# Phase 0A-4 パフォーマンス劣化の根本原因分析

**作成日**: 2025年10月19日  
**ステータス**: 🔍 根本原因特定済み

---

## 🚨 問題の概要

本番環境デプロイ後、以下のパフォーマンス劣化が発生：

| 環境 | 検索時間 | AI生成時間 | 総処理時間 |
|:---|:---|:---|:---|
| 開発環境 | 8秒 | 19秒 | 27秒 ✅ |
| 本番環境 | **145秒** | 35秒 | **180秒以上** ⚠️ |

---

## 🔍 根本原因

### 設定変更の履歴

```bash
# Git履歴から判明
git log --oneline -- apphosting.yaml

9046e0d2 Fix: Enable data download in production environment
bd7c89de perf: Optimize build time by making data download conditional
```

### 問題の設定変更（2025年10月13日）

| 設定項目 | 以前（高速） | 現在（遅い） | 変更コミット |
|:---|:---|:---|:---|
| `SKIP_DATA_DOWNLOAD` | `"true"` ✅ | `"false"` ⚠️ | `9046e0d2` |

---

## 📊 設定の動作解析

### SKIP_DATA_DOWNLOAD の動作

| 値 | ビルド時 | 実行時 | パフォーマンス |
|:---|:---|:---|:---|
| `"true"` | データDLしない | Cloud Storageから読み込み | ⚠️ 初回遅い（145秒） |
| `"false"` | データDLする | ビルドに含まれる | ✅ 高速（8秒） |

**重要**: `scripts/conditional-download.js` の実装：
```javascript
const skipDownload = process.env.SKIP_DATA_DOWNLOAD === 'true';

if (skipDownload) {
  console.log('⏩ Skipping data download (SKIP_DATA_DOWNLOAD=true)');
  console.log('ℹ️  Data will be loaded at runtime from Cloud Storage');
  process.exit(0);
}

// データをダウンロード
console.log('📥 Downloading production data...');
```

---

## 🎯 145秒遅延の内訳（推定）

### 以前の設定（`SKIP_DATA_DOWNLOAD=true`）時

```
1. 初回リクエスト受信
2. instrumentation.js でサーバー起動初期化
3. Cloud Storageから LanceDB データをダウンロード (50MB)     ← 145秒の主因 ⚠️
   - LanceDB本体: 7.63 MB
   - ドメイン知識: 4.16 MB
   - キャッシュ: 39.2 MB
   --------------------------------
   合計: 50.99 MB
   
4. LanceDB接続初期化                                          ← 5-10秒
5. Lunrインデックス構築                                       ← 10-20秒
6. Embeddingモデルロード                                      ← 10-20秒
   --------------------------------
   合計推定時間: 120-170秒 ⚠️
```

### 現在の設定（`SKIP_DATA_DOWNLOAD=false`）時

```
1. ビルド時にデータをダウンロード（50MB） ← ビルド時に完了 ✅
2. Next.jsビルドに含まれる
3. 実行時は既存データを使用
   - LanceDB接続初期化: 2-3秒
   - Lunrキャッシュ読み込み: 1-2秒
   - Embeddingモデルロード: 5-10秒
   --------------------------------
   合計推定時間: 8-15秒 ✅
```

---

## 🔄 変更履歴の詳細

### コミット `9046e0d2`（2025年10月13日）

**変更内容**:
```yaml
# 変更前（高速だった）
env:
  - variable: SKIP_DATA_DOWNLOAD
    value: "true"  # ビルド時にスキップ、実行時にCloud Storageから読み込み

# 変更後（遅くなった）
env:
  - variable: SKIP_DATA_DOWNLOAD
    value: "false"  # ビルド時にダウンロード
```

**変更理由**（コミットメッセージより）:
> Fix: Enable data download in production environment
> - Change SKIP_DATA_DOWNLOAD from true to false
> - Add RUNTIME availability to ensure data is loaded at runtime
> - This fixes the 'no information found' issue in production

**問題点**:
- 「no information found」問題を修正する目的だったが、実際には**新たな遅延問題を引き起こした**
- ビルド時にダウンロードしたデータが実行時に正しくロードされていない可能性

---

## 💡 解決策の選択肢

### 選択肢1: 設定を元に戻す（推奨）

```yaml:apphosting.yaml
env:
  - variable: SKIP_DATA_DOWNLOAD
    value: "true"  # ビルド時にダウンロード実行
    availability:
      - BUILD
      - RUNTIME
```

**メリット**:
- 145秒 → 8-15秒に改善 ✅
- ビルド時にデータを準備
- 実行時の初期化が高速

**デメリット**:
- 「no information found」問題が再発する可能性 ⚠️

**必須の追加対策**:
- データダウンロードスクリプトの修正
- Cloud Storage接続の確認
- ビルド後のデータ存在確認

---

### 選択肢2: 実行時ダウンロードの最適化（次善策）

`instrumentation.js` で事前ダウンロード・キャッシュを実装：

```typescript:instrumentation.js
export async function register() {
  console.log('🔧 Server initialization started...');
  
  if (process.env.SKIP_DATA_DOWNLOAD === 'false') {
    // Phase 0A-4 FIX: Cloud Storageから並列ダウンロード
    const startTime = Date.now();
    
    await Promise.all([
      downloadLanceDB(),        // 7.63 MB
      downloadDomainKnowledge(),// 4.16 MB
      downloadCaches()          // 39.2 MB
    ]);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Data downloaded in ${(duration / 1000).toFixed(2)}s`);
  }
  
  // ... 既存の初期化処理
}
```

**メリット**:
- 並列ダウンロードで50-70秒に短縮可能
- 「no information found」問題は発生しない

**デメリット**:
- 依然として遅い（50-70秒） ⚠️
- 実装の複雑さ

---

### 選択肢3: データをビルドイメージに含める（理想的）

```dockerfile
# Dockerfile に追加
COPY .lancedb /app/.lancedb
COPY data /app/data
```

**メリット**:
- 最速（データ読み込みなし） ✅
- 本番環境で安定

**デメリット**:
- Dockerイメージサイズ増加（+50MB）
- Firebase App Hostingで対応が必要

---

## 🚀 推奨アクション

### 即座に実施（緊急対応）

**ステップ1**: `SKIP_DATA_DOWNLOAD=false` に設定（現状維持）

**ステップ2**: ビルドスクリプトとデータパスの確認
```bash
# ビルド後のデータ存在確認
ls -lh .lancedb/
ls -lh data/
```

**ステップ3**: `instrumentation.js` でデータ存在確認ログ追加
```typescript
console.log('📦 Data paths:', {
  lancedb: fs.existsSync('.lancedb'),
  domainKnowledge: fs.existsSync('data/domain-knowledge-v2'),
  cache: fs.existsSync('.cache')
});
```

---

### 中期的対応（1-2日）

1. **データダウンロードスクリプトの修正**
   - `scripts/download-production-data.ts` の確認
   - ビルド時のデータ保存先が正しいか確認

2. **Next.js Standaloneビルドの検証**
   - `.next/standalone` にデータが含まれているか確認
   - パス解決の問題がないか確認

3. **Cloud Loggingでの検証**
   - 実際の遅延箇所を特定
   - データロード時間を計測

---

## 📝 関連ドキュメント

- [build-optimization-guide.md](./build-optimization-guide.md) - ビルド最適化ガイド
- [conditional-download.js](../../scripts/conditional-download.js) - 条件付きダウンロードスクリプト
- [download-production-data.ts](../../scripts/download-production-data.ts) - データダウンロード実装
- [phase-0a-4-production-issue-analysis.md](./phase-0a-4-production-issue-analysis.md) - 本番環境問題分析

---

**作成者**: AI Assistant  
**最終更新**: 2025年10月19日  
**ステータス**: ✅ 根本原因特定完了、対策検討中

