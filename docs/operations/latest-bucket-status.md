# Cloud Storage 最新バケット状況レポート

**作成日**: 2025年10月19日  
**バケット名**: `gs://confluence-copilot-data`  
**リージョン**: US-CENTRAL1（米国アイオワ州）

---

## 📦 最新のバケット状態

### バケット情報

| 項目 | 値 |
|:---|:---|
| **バケット名** | `confluence-copilot-data` |
| **リージョン** | US-CENTRAL1 |
| **ストレージクラス** | STANDARD |
| **作成日** | 2025-10-09 |
| **総サイズ** | **226.58 MiB** |
| **総オブジェクト数** | **24,975 objects** |

---

## 🕐 最新の更新状況

### 主要ファイルの最終更新日時

| ファイル | サイズ | 最終更新日時 | 状態 |
|:---|:---|:---|:---|
| **`.cache/lunr-index.msgpack`** | 17.72 MiB | **2025-10-19 17:30:01 UTC** | ✅ 最新 |
| **`.cache/lunr-index.json`** | 17.98 MiB | **2025-10-19 17:30:00 UTC** | ✅ 最新 |
| **`domain-knowledge-v2/final-domain-knowledge-v2.json`** | 2.44 MiB | **2025-10-19 17:29:58 UTC** | ✅ 最新 |
| **`domain-knowledge-v2/keyword-lists-v2.json`** | 588.39 KiB | **2025-10-19 17:29:59 UTC** | ✅ 最新 |
| **`lancedb/confluence.lance/_versions/999.manifest`** | 98.27 KiB | **2025-10-19 17:26:19 UTC** | ✅ 最新 |
| **`lancedb/confluence.lance/_transactions/0-a8ba11cf...`** | 706 B | **2025-10-19 17:18:22 UTC** | ✅ 最新 |

**最新のアップロード時刻**: **2025年10月19日 17:30:00 UTC**（日本時間: 10月20日 2:30 AM）

---

## 🚀 デプロイとの連携状況

### 最新デプロイ

| リビジョン | デプロイ日時（UTC） | 日本時間 | ステータス |
|:---|:---|:---|:---|
| **confluence-chat-build-2025-10-19-008** | 2025-10-19 17:12:08 | 10/20 2:12 AM | ✅ ACTIVE |
| confluence-chat-build-2025-10-19-007 | 2025-10-19 13:29:52 | 10/19 10:29 PM | ✅ ACTIVE |
| confluence-chat-build-2025-10-19-006 | 2025-10-19 12:10:18 | 10/19 9:10 PM | ✅ ACTIVE |

### タイムライン比較

```
2025-10-19 17:12:08 UTC  ← 最新デプロイ (build-008)
2025-10-19 17:18:22 UTC  ← LanceDB トランザクション更新
2025-10-19 17:26:19 UTC  ← LanceDB バージョン更新
2025-10-19 17:29:58 UTC  ← ドメイン知識更新
2025-10-19 17:30:00 UTC  ← Lunrインデックス更新
```

**⚠️ 重要な発見**: 
- **最新デプロイ（17:12:08 UTC）の後にバケットが更新されています（17:30:00 UTC）**
- デプロイは**約18分前のデータ**を使用している可能性があります

---

## 📋 デプロイ時のデータ更新状況

### 想定されるフロー

#### 1. **GitHub Actions差分同期（毎日午前2時JST）**

```
毎日 午前2時（JST） = 17:00（前日UTC）
  ↓
Confluence API からデータ取得
  ↓
LanceDB生成
  ↓
Cloud Storageアップロード
```

**最新実行推定**: 2025-10-19 17:00 UTC（10/20 2:00 AM JST）

**確認できる証拠**:
- `.cache/lunr-index.msgpack`: 17:30:01 UTC
- `domain-knowledge-v2/final-domain-knowledge-v2.json`: 17:29:58 UTC
- LanceDB transactions: 17:18:22 UTC

**結論**: ✅ **GitHub Actions差分同期が正常に実行され、バケットが更新されました**

#### 2. **Firebase App Hostingのビルド**

```
最新デプロイ: 2025-10-19 17:12:08 UTC（10/20 2:12 AM JST）

ビルド時の動作（SKIP_DATA_DOWNLOAD=false）:
  1. ビルド開始（17:10頃）
  2. Cloud Storageからダウンロード
  3. next build実行
  4. デプロイ完了（17:12:08）
```

**使用されたデータ**: 
- 17:10頃にダウンロード
- その時点で利用可能だったデータ
- **GitHub Actions同期（17:00-17:30）の途中のデータ**

**結論**: ⚠️ **デプロイは完全に最新のデータではない可能性があります**

---

## 🔍 データ整合性の確認

### デプロイとバケットの時系列

| 時刻（UTC） | イベント | 詳細 |
|:---|:---|:---|
| **17:00** | GitHub Actions開始（推定） | 差分同期スタート |
| **17:12:08** | **デプロイ完了** | **build-2025-10-19-008** |
| **17:18:22** | LanceDB更新 | トランザクションファイル |
| **17:26:19** | LanceDB完了 | バージョンマニフェスト |
| **17:29:58** | ドメイン知識更新 | final-domain-knowledge-v2.json |
| **17:30:00** | Lunr更新完了 | lunr-index.msgpack |

### 問題点

1. **デプロイがGitHub Actions同期の途中で実行された**
   - GitHub Actions: 17:00 ~ 17:30（約30分）
   - デプロイ: 17:12:08（同期開始から12分後）
   
2. **デプロイが使用したデータ**
   - ✅ 前日（10/18）のデータは確実に含まれる
   - ⚠️ 当日（10/19）の最新データは含まれない可能性
   - ❌ GitHub Actions実行中の部分的なデータを取得した可能性

---

## 🎯 推奨対応策

### 対策1: デプロイタイミングの調整【推奨】

**問題**: デプロイとGitHub Actions同期が重複している

**解決策**: デプロイを手動で実行する場合、GitHub Actions完了後に実行

```bash
# GitHub Actions完了確認（毎日2:30 AM JST以降）
# Cloud Storageの最新更新を確認
gcloud storage ls -L gs://confluence-copilot-data/.cache/lunr-index.msgpack

# 最新更新が確認できたらデプロイ
firebase apphosting:rollouts:create BACKEND_ID
```

### 対策2: GitHub Actionsの実行時刻を変更【推奨】

**現在**: 毎日午前2時（JST）= 17:00（前日UTC）

**変更案**: 毎日午前3時（JST）= 18:00（前日UTC）

**理由**:
- デプロイが自動的に17:12頃に実行される場合、その前にGitHub Actionsを完了させる
- または、GitHub Actionsを深夜に実行してデプロイとの重複を避ける

**`.github/workflows/sync-confluence.yml`**:
```yaml
on:
  schedule:
    - cron: '0 18 * * *'  # UTC 18:00 = JST 3:00（翌日）
```

### 対策3: ビルド前にデータ同期完了を確認【理想】

**`scripts/conditional-download.ts`に追加**:

```typescript
// Cloud Storageの最新更新時刻を確認
const lastModified = await checkLastModified('gs://confluence-copilot-data/.cache/lunr-index.msgpack');
const timeSinceUpdate = Date.now() - lastModified.getTime();

// 5分以内に更新されていない場合のみダウンロード
if (timeSinceUpdate > 5 * 60 * 1000) {
  console.log('✅ Data is stable, proceeding with download...');
  await downloadProductionData();
} else {
  console.warn('⚠️  Data is still being updated, waiting...');
  await sleep(5 * 60 * 1000); // 5分待機
  await downloadProductionData();
}
```

---

## 📊 バケット内容の詳細

### ディレクトリ構造

```
gs://confluence-copilot-data/
├── .cache/
│   ├── embedding-cache.json (179 B) - 2025-10-13
│   ├── keyword-cache.json (2.12 KiB) - 2025-10-19 09:37
│   ├── lunr-index.json (17.98 MiB) - 2025-10-19 17:30 ✅
│   ├── lunr-index.msgpack (17.72 MiB) - 2025-10-19 17:30 ✅
│   ├── startup-state.json (166 B) - 2025-10-19 09:37
│   └── tokenizer-cache.json (119 B) - 2025-10-19 17:30 ✅
│
├── domain-knowledge-v2/
│   ├── final-domain-knowledge-v2.json (2.44 MiB) - 2025-10-19 17:29 ✅
│   ├── keyword-lists-v2-backup.json (588.39 KiB) - 2025-10-19 09:36
│   ├── keyword-lists-v2-cleaned.json (587.45 KiB) - 2025-10-19 09:36
│   └── keyword-lists-v2.json (588.39 KiB) - 2025-10-19 17:29 ✅
│
└── lancedb/
    └── confluence.lance/
        ├── _transactions/ (11,841 objects, 1.56 MiB)
        │   └── 最新: 2025-10-19 17:18:22 ✅
        ├── _versions/ (1,256 objects, 72.78 MiB)
        │   └── 999.manifest (98.27 KiB) - 2025-10-19 17:26:19 ✅
        └── data/ (多数のデータファイル)
```

### サイズ内訳

| カテゴリ | サイズ | オブジェクト数 | 備考 |
|:---|:---|:---|:---|
| **LanceDB data** | ~150 MiB | ~12,000+ | 主要データ |
| **LanceDB versions** | 72.78 MiB | 1,256 | バージョン管理 |
| **Lunr index** | 35.70 MiB | 2 | JSON + MessagePack |
| **Domain knowledge** | 3.66 MiB | 4 | ドメイン知識 |
| **Cache** | ~0.3 MiB | 6 | キャッシュファイル |
| **合計** | **226.58 MiB** | **24,975** | - |

---

## ✅ 結論

### 最新バケットの場所

**バケット**: `gs://confluence-copilot-data`  
**リージョン**: US-CENTRAL1（米国アイオワ州）  
**最終更新**: **2025-10-19 17:30:00 UTC**（日本時間: 10月20日 2:30 AM）

### デプロイ時の更新状況

| 項目 | 状態 | 評価 |
|:---|:---|:---|
| **バケットの更新** | 毎日午前2時（JST）に自動更新 | ✅ 正常 |
| **最新データの反映** | **デプロイが同期途中で実行** | ⚠️ 要改善 |
| **データの整合性** | 前日のデータは確実に含まれる | ✅ 安全 |
| **最新性** | 当日の最新データは含まれない可能性 | ⚠️ 要確認 |

### 推奨アクション

1. **即座**: 現状のまま運用継続（前日データは反映される） ✅
2. **短期**: GitHub Actionsの実行時刻を調整（3:00 AM JST） 🕐
3. **中期**: デプロイ前にデータ同期完了を確認する仕組み追加 🔧
4. **長期**: Cloud Storageを東京リージョンに移行検討 🌏

---

**作成日**: 2025年10月19日  
**最終更新**: 2025年10月19日  
**ステータス**: 分析完了、改善策提示済み

