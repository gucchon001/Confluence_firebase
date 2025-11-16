# 🚨 Hugging Face レートリミット緊急対応

**発生日時**: 2025年10月20日  
**エラーコード**: 429 Too Many Requests  
**影響**: 本番環境で埋め込みベクトル生成が完全に失敗

---

## 📊 問題の詳細

### エラーメッセージ

```
LanceDB search failed: Error (429) occurred while trying to load file:
"https://huggingface.co/Xenova/paraphrase-multilingual-mpnet-base-v2/resolve/main/tokenizer.json"
```

### 根本原因

1. **複数インスタンスの同時起動**
   - `minInstances: 2` により2つのインスタンスがほぼ同時に起動
   - 各インスタンスが独立してHugging Faceからモデルをダウンロード

2. **Hugging Faceのレートリミット**
   - 短時間に同じIPアドレス帯から複数アクセス
   - Hugging Faceが過剰アクセスと判断
   - 一時的にアクセスをブロック（HTTP 429）

3. **実行時ダウンロードの問題**
   - モデルファイルがコンテナに含まれていない
   - 実行時に毎回Hugging Faceからダウンロード
   - 外部サービスへの依存によるリスク

### なぜローカルでは発生しないか

- ローカル環境: 1インスタンスのみ、初回ダウンロード後はキャッシュ
- 本番環境: 複数インスタンス、各々がダウンロードを試行

---

## 🎯 実施した対策

### ✅ 対策A: モデルファイルをコンテナに含める（最優先）

#### 1. モデルダウンロードスクリプト作成

**ファイル**: `scripts/download-embedding-model.js`

**機能**:
- Hugging Faceから必要なモデルファイルをダウンロード
- ローカルの `models/` ディレクトリに保存
- レートリミット回避のため1秒間隔でダウンロード

**ダウンロードされるファイル**:
```
models/paraphrase-multilingual-mpnet-base-v2/
├── config.json
├── tokenizer.json
├── tokenizer_config.json
├── special_tokens_map.json
└── onnx/
    ├── model.onnx
    └── model_quantized.onnx
```

#### 2. 埋め込み生成コードの修正

**ファイル**: `src/lib/embeddings.ts`

**変更内容**:
```typescript
// Before: 常にHugging Faceから読み込み
extractor = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-mpnet-base-v2');

// After: ローカルモデルを優先
const localModelPath = path.join(process.cwd(), 'models', 'paraphrase-multilingual-mpnet-base-v2');

if (fs.existsSync(localModelPath)) {
  // ローカルモデルを使用（Hugging Faceへのアクセスなし）
  extractor = await pipeline('feature-extraction', localModelPath);
} else {
  // フォールバック: Hugging Faceから（警告を出力）
  extractor = await pipeline('feature-extraction', 'Xenova/...');
}
```

#### 3. ビルドプロセスに組み込み

**ファイル**: `package.json`

**変更内容**:
```json
{
  "scripts": {
    "model:download": "node scripts/download-embedding-model.js",
    "model:clean": "rm -rf models",
    "prebuild": "node scripts/download-embedding-model.js && node scripts/conditional-download.js"
  }
}
```

**効果**:
- ✅ ビルド時に自動的にモデルをダウンロード
- ✅ 実行時のHugging Faceへのアクセスがゼロ
- ✅ レートリミットの完全回避
- ✅ 起動時間の短縮（ダウンロード不要）

#### 4. .gitignoreに追加

**ファイル**: `.gitignore`

```
# Embedding models (downloaded at build time)
/models/
```

---

## 🚀 緊急デプロイ手順

### Step 1: ローカルでモデルをダウンロード

```bash
# モデルを手動ダウンロード（確認用）
npm run model:download

# 出力例:
# 🚀 埋め込みモデルのダウンロード開始...
# 📥 Downloading: https://huggingface.co/.../config.json
#    ✅ Downloaded: config.json
# ...
# ✅ モデルダウンロード完了！
```

### Step 2: ビルドテスト（ローカル）

```bash
# ビルドが正常に完了することを確認
npm run build

# 出力に以下が含まれることを確認:
# ✅ モデルファイルは既に存在します。ダウンロードをスキップします。
```

### Step 3: コミット＆プッシュ

```bash
git add scripts/download-embedding-model.js
git add src/lib/embeddings.ts
git add package.json
git add .gitignore
git add docs/operations/huggingface-rate-limit-emergency.md

git commit -m "hotfix: Hugging Faceレートリミット緊急対応（429エラー）

- 埋め込みモデルをビルド時にダウンロード
- ローカルモデルパスを優先使用
- 実行時のHugging Faceアクセスを完全回避

エラー: Error (429) Too Many Requests
原因: minInstances=2で複数インスタンスが同時アクセス
解決: モデルをコンテナに含めることで外部依存を削除"

git push origin main
```

### Step 4: デプロイ完了を監視

```bash
# Firebase Consoleでデプロイ状況を確認
https://console.firebase.google.com/project/confluence-copilot-ppjye/apphosting

# ビルドログで以下を確認:
# ✅ モデルダウンロード完了
# ✅ ビルド成功
```

### Step 5: デプロイ後の確認

#### 5-1. ログ確認

Cloud Loggingで以下を確認:

```
フィルター:
  resource.type="cloud_run_revision"
  textPayload:"[Embedding] Using local model"
  
期待される出力:
  ✅ [Embedding] Using local model from: /workspace/models/...
```

#### 5-2. パフォーマンステスト

本番環境で質問を送信:
```
質問: 「教室削除機能の仕様は？」
```

**期待される結果**:
- ✅ 429エラーが発生しない
- ✅ 埋め込みベクトル生成が成功
- ✅ 検索が正常に完了

---

## 📊 予想される効果

### Before（現状）

```
❌ Error (429) Too Many Requests
→ 埋め込みベクトル生成失敗
→ 検索失敗
→ ユーザーに回答不可
```

### After（修正後）

```
✅ ローカルモデルを使用
→ Hugging Faceへのアクセスゼロ
→ レートリミットなし
→ 安定した高速動作
```

### 追加のメリット

| 項目 | Before | After |
|------|--------|-------|
| Hugging Faceへのアクセス | 毎回 | **ゼロ** |
| モデル読み込み時間 | 可変（ネットワーク依存） | **一定（ローカル）** |
| レートリミットリスク | あり | **なし** |
| 起動時間 | 長い | **短い** |
| 外部依存 | あり | **なし** |

---

## ⚠️ 重要な注意事項

### モデルファイルのサイズ

```
paraphrase-multilingual-mpnet-base-v2:
  - config.json: ~1KB
  - tokenizer.json: ~2MB
  - model.onnx: ~400MB
  
合計: ~400MB
```

**影響**:
- コンテナイメージサイズが約400MB増加
- ビルド時間が若干増加（初回のみ）
- デプロイ時間が若干増加（初回のみ）

**対策**:
- ✅ 許容範囲内（Firebase App Hostingの制限内）
- ✅ 2回目以降はキャッシュされる
- ✅ 実行時のパフォーマンス向上で相殺

### モデルのバージョン管理

**現在**:
- Hugging Faceから常に最新版をダウンロード
- バージョンが勝手に変わるリスク

**修正後**:
- ビルド時にダウンロードして固定
- バージョンが予期せず変わらない
- 再現性が向上

---

## 🔍 トラブルシューティング

### モデルダウンロードが失敗する

**エラー**: `Failed to download ...`

**原因**: ネットワークエラー、Hugging Faceダウン

**対応**:
```bash
# リトライ
npm run model:download

# 手動ダウンロード
curl -o models/paraphrase-multilingual-mpnet-base-v2/config.json \
  https://huggingface.co/Xenova/paraphrase-multilingual-mpnet-base-v2/resolve/main/config.json
```

### ビルドでモデルが見つからない

**エラー**: `Model not found`

**確認**:
```bash
# モデルディレクトリの確認
ls -lh models/paraphrase-multilingual-mpnet-base-v2/

# 再ダウンロード
npm run model:clean
npm run model:download
```

### デプロイ後も429エラーが出る

**原因**: 古いコードが動いている

**対応**:
```bash
# Firebase Consoleでロールアウト状況を確認
# 古いインスタンスが残っている場合は、
# 全インスタンスが新しいバージョンになるまで待機
```

---

## 📝 修正済みファイル一覧

1. ✅ `scripts/download-embedding-model.js` - モデルダウンロードスクリプト
2. ✅ `src/lib/embeddings.ts` - ローカルモデル優先ロジック
3. ✅ `package.json` - prebuildに追加
4. ✅ `.gitignore` - modelsフォルダを除外
5. ✅ `docs/operations/huggingface-rate-limit-emergency.md` - このドキュメント

---

## 🎯 期待される結果

### 修正前のログ

```
⚠️ [Embedding] Local model not found, downloading from Hugging Face...
❌ Error (429) Too Many Requests
```

### 修正後のログ

```
✅ [Embedding] Using local model from: /workspace/models/paraphrase-multilingual-mpnet-base-v2
✅ 埋め込みベクトル生成成功
```

---

## 📋 チェックリスト

### デプロイ前

- [x] モデルダウンロードスクリプト作成
- [x] embeddings.ts修正
- [x] package.json修正
- [x] .gitignore更新
- [x] ローカルでビルドテスト

### デプロイ中

- [ ] Firebase Consoleでビルド監視
- [ ] ビルドログでモデルダウンロード確認
- [ ] デプロイ完了を確認

### デプロイ後

- [ ] Cloud Loggingで確認
  - [ ] `[Embedding] Using local model` が出力
  - [ ] 429エラーが発生していない
- [ ] パフォーマンステスト実施
- [ ] 検索が正常に完了

---

## 🔗 関連ドキュメント

- [Phase 2パフォーマンス最適化ガイド](./phase2-performance-optimization-guide.md)
- [緊急対応ドキュメント](./production-performance-emergency-2025-10-20.md)
- [ビルド最適化ガイド](./build-optimization-guide.md)

---

## 💡 学んだ教訓

### 1. 外部サービスへの依存リスク

**問題**: 実行時に外部APIやファイルサーバーに依存
**影響**: レートリミット、ダウンタイム、パフォーマンス低下

**教訓**: 
- ✅ 可能な限りビルド時にダウンロード
- ✅ コンテナ内に含める
- ✅ 外部依存を最小化

### 2. スケールアウトと同時アクセス

**問題**: minInstancesを増やすと同時アクセスが発生
**影響**: レートリミット、リソース競合

**教訓**:
- ✅ 起動時の外部アクセスを避ける
- ✅ ファイルはコンテナに含める
- ✅ 初期化処理を最適化

### 3. ローカルと本番の環境差異

**問題**: ローカルでは問題なくても本番で問題
**影響**: 予期せぬエラー、ダウンタイム

**教訓**:
- ✅ 本番相当の環境でテスト
- ✅ 複数インスタンスでの動作確認
- ✅ 負荷テストの実施

---

**最終更新**: 2025年10月20日  
**ステータス**: 🔴 緊急対応実施中

