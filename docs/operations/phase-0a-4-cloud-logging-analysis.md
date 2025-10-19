# Phase 0A-4: Cloud Logging詳細分析レポート

**作成日**: 2025年10月19日  
**分析対象**: 本番環境の145秒遅延問題  
**データソース**: Cloud Logging出力

---

## 🔍 Cloud Logging分析結果

### 📊 検出された問題（優先度順）

#### 1. **Kuromoji辞書ファイルが見つからない** 🚨 【最重要】

**ログ出力**:
```
[JapaneseTokenizer] Failed to initialize kuromoji: 
[Error: ENOENT: no such file or directory, 
open '/workspace/.next/standalone/node_modules/kuromoji/dict/base.dat.gz']
```

**影響**:
- BM25（日本語全文検索）が機能しない
- ハイブリッド検索の品質低下
- ベクトル検索のみに依存（精度低下）

**原因**:
- `copy-webpack-plugin`の設定はあるが、Standaloneビルド環境でコピーが完了していない
- `/workspace/.next/standalone/node_modules/kuromoji/dict/`が存在しない

**対策**:
- `next.config.ts`でStandalone + Serverビルド両方にコピー設定追加 ✅
- `instrumentation.js`でKuromoji辞書の存在確認ログ追加 ✅

---

#### 2. **検索処理が120秒かかっている** ⏱️

**ログ出力**:
```
[searchLanceDB] Slow search: 119958ms (119.96s) for query: 
"ログイン時にロールオプションでログイン先アプリケーションを選べるか"
```

**内訳推測**:
- Embedding生成: 推定5-10秒
- LanceDB検索: 推定10-20秒
- チャンク取得: **30-60秒（ボトルネック）**
- その他処理: 推定10-20秒

**原因**:
- チャンク取得が異常に遅い（後述）
- Kuromoji初期化失敗によるLunrインデックス初期化失敗
- 初回リクエストでの遅延初期化

---

#### 3. **チャンク取得が異常に遅い** 🐢 【重大】

**ログ出力**:
```
[ChunkMerger] ⚠️ Slow chunk retrieval: 30581ms for pageId 656834764 (41 chunks)
```

**分析**:
- 41チャンクの取得に**30.6秒**かかっている
- 1チャンクあたり**約750ms**（異常に遅い）
- 通常は1チャンクあたり10-50ms程度が目標

**推測される原因**:
1. **LanceDBへの接続レイテンシが高い**
   - Cloud Storageからのデータ読み込みが遅延
   - インスタンスのディスクI/Oが遅い
2. **`getAllChunksByPageId`のクエリ効率が悪い**
   - Phase 0A-4で最適化済みだが、本番環境で効果が出ていない可能性
3. **メモリ不足によるスワップ**
   - `memoryMiB: 4096`で不足している可能性

---

#### 4. **データ存在確認ログが一切ない** 📦

**問題**:
- `instrumentation.js`がデータの存在を確認していない
- データがビルドに含まれているか不明
- 実行時にCloud Storageからダウンロードしている可能性

**対策**:
- `instrumentation.js`にデータ存在確認ログ追加 ✅

---

## 🎯 根本原因の仮説

### 仮説1: データがビルドに含まれていない（最有力）

**証拠**:
- Kuromoji辞書ファイルが見つからない（ENOENT）
- データ存在確認ログがない
- 初回リクエストで120秒かかる（遅延初期化の兆候）

**検証方法**:
1. Cloud Loggingで`[Instrumentation] データチェック結果`を確認
2. ビルドログで`📥 Downloading production data...`を確認
3. Firebase App Hosting環境で`ls -la .lancedb`を実行

---

### 仮説2: `SKIP_DATA_DOWNLOAD`の動作が想定と異なる

**設定**:
```yaml
- variable: SKIP_DATA_DOWNLOAD
  value: "false"  # ビルド時にダウンロード
```

**問題**:
- `"false"`に設定しているのに、実行時にダウンロードしている可能性
- ビルドスクリプト（`scripts/download-production-data.ts`）が実行されていない

**検証方法**:
- Firebase App Hostingのビルドログで`npm run build:production`の出力を確認

---

### 仮説3: Standaloneビルドのパス解決問題

**問題**:
- Next.js Standaloneビルドでは`.next/standalone`に全てが配置される
- しかし、Kuromojiは`/workspace/.next/standalone/node_modules/kuromoji/dict`を探している
- データは`/workspace/.lancedb`にあるかもしれないが、Standaloneでは`/workspace/.next/standalone/.lancedb`が正しい可能性

**対策**:
- `scripts/download-production-data.ts`でStandaloneパスにもコピー

---

## 📋 実施した対策

### 対策1: `instrumentation.js`にデータ存在確認追加 ✅

**追加内容**:
```javascript
console.log('📦 [Instrumentation] データ存在確認中...');
const lancedbPath = path.resolve(process.cwd(), '.lancedb');
const dataPath = path.resolve(process.cwd(), 'data');
const kuromojiDictPath = path.resolve(process.cwd(), 'node_modules/kuromoji/dict');
const kuromojiStandalonePath = path.resolve(process.cwd(), '.next/standalone/node_modules/kuromoji/dict');

console.log(`📊 [Instrumentation] データチェック結果:`);
console.log(`   - LanceDB (.lancedb): ${lancedbExists ? '✅' : '❌'}`);
console.log(`   - Domain Knowledge (data/): ${dataExists ? '✅' : '❌'}`);
console.log(`   - Kuromoji Dict (node_modules): ${kuromojiDictExists ? '✅' : '❌'}`);
console.log(`   - Kuromoji Dict (standalone): ${kuromojiStandaloneExists ? '✅' : '❌'}`);
```

**期待される効果**:
- データの存在状況が明確になる
- 問題の切り分けが可能になる

---

### 対策2: `next.config.ts`のKuromojiコピー設定改善 ✅

**変更内容**:
```typescript
patterns: [
  // Standalone ビルド用
  {
    from: path.resolve(__dirname, 'node_modules/kuromoji/dict'),
    to: path.resolve(__dirname, '.next/standalone/node_modules/kuromoji/dict'),
    noErrorOnMissing: true,
  },
  // Server ビルド用（開発・本番両対応）
  {
    from: path.resolve(__dirname, 'node_modules/kuromoji/dict'),
    to: path.resolve(__dirname, '.next/server/node_modules/kuromoji/dict'),
    noErrorOnMissing: true,
  },
],
```

**期待される効果**:
- Standaloneビルド、Serverビルド両方でKuromoji辞書が利用可能になる
- BM25検索が正常に機能する

---

## 🚀 次のステップ（優先順位順）

### ステップ1: 再デプロイしてCloud Loggingを確認【即座】

1. コミット & プッシュ:
   ```bash
   git add instrumentation.js next.config.ts
   git commit -m "fix: Add data existence checks and improve Kuromoji dictionary copy for Standalone build"
   git push origin main
   ```

2. Firebase App Hostingでビルド開始

3. Cloud Loggingで以下を確認:
   ```
   フィルター: textPayload=~"データチェック結果"
   ```
   
   **期待される出力**:
   ```
   📦 [Instrumentation] データ存在確認中...
   📊 [Instrumentation] データチェック結果:
      - LanceDB (.lancedb): ✅
      - Domain Knowledge (data/): ✅
      - Kuromoji Dict (node_modules): ✅
      - Kuromoji Dict (standalone): ✅
   ```

---

### ステップ2: ビルドログの詳細確認【重要】

Firebase Console → App Hosting → ビルド履歴 → 最新ビルド → ログ

**確認項目**:
1. `📥 Downloading production data...`が表示されているか
2. `✅ LanceDB downloaded successfully`が表示されているか
3. Webpackの`copy-webpack-plugin`の実行ログ
4. エラーや警告が出ていないか

---

### ステップ3: パフォーマンス改善（データ確認後）

**もし上記の対策でデータが見つかった場合**:

1. **CPU/メモリを増強**:
   ```yaml
   runConfig:
     cpu: 4  # 2 → 4に増強
     memoryMiB: 8192  # 4096 → 8192に増強
   ```

2. **チャンク取得の並列化**:
   - `enrichWithAllChunks`で`Promise.all`の並列度を調整
   - 現在は全チャンクを並列取得しているが、バッチ処理に変更

3. **LanceDB接続の最適化**:
   - コネクションプーリングの導入
   - クエリキャッシュの強化

---

## 📈 期待される改善

### 現在の状況
```
TTFB: 8ms ⚡ 優秀
検索時間: 145秒 ❌ 異常
総処理時間: 153秒 ❌ 致命的
```

### 対策後の目標
```
TTFB: 8ms ⚡ 維持
検索時間: 8-10秒 ✅ 正常（開発環境並み）
総処理時間: 25-30秒 ✅ 許容範囲
```

### 改善の根拠
- Kuromoji初期化成功 → BM25検索有効化 → 検索品質向上
- データがビルドに含まれる → 遅延ロードなし → 初期化高速化
- 初回リクエストの遅延初期化削減 → 検索時間短縮

---

## 🔍 追加調査項目

### もしデータが見つからない場合

1. **`scripts/download-production-data.ts`の確認**:
   - Standaloneパスに対応しているか
   - `package.json`の`build:production`で実行されているか

2. **GitHub Actionsの確認**:
   - `.github/workflows/*.yml`でビルドスクリプトが実行されているか
   - 環境変数が正しく設定されているか

3. **Firebase App Hostingの設定確認**:
   - ビルドコマンドが`npm run build:production`になっているか
   - 環境変数が正しく注入されているか

---

## 📝 まとめ

### 判明した問題
1. ✅ Kuromoji辞書ファイルが見つからない（ENOENT）
2. ✅ 検索処理が120秒かかっている
3. ✅ チャンク取得が異常に遅い（30秒）
4. ✅ データ存在確認ログがない

### 実施した対策
1. ✅ `instrumentation.js`にデータ存在確認追加
2. ✅ `next.config.ts`のKuromojiコピー設定改善

### 次のアクション
1. **再デプロイ & Cloud Logging確認**（最優先）
2. ビルドログの詳細確認
3. データ確認後、CPU/メモリ増強を検討

---

**最終更新**: 2025年10月19日  
**ステータス**: 対策実装完了、再デプロイ待ち

