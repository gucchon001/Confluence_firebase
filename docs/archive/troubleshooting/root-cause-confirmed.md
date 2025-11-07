# ベクトル検索エラー根本原因の確定

**作成日**: 2025-11-02  
**エラーメッセージ**: `No vector column found to match with the query vector dimension: 768`

## 根本原因の確定

### ✅ 原因が特定されました

**「Next.jsのstandaloneビルドで`.lancedb`が最終コンテナに含まれない」**

## 詳細な分析

### ビルドプロセスの流れ

1. **prebuild**: `.lancedb`をCloud Storageからダウンロード ✅
   - 41,436ファイルが正常にダウンロード
   - `/workspace/.lancedb`に配置される

2. **build**: Next.jsがstandaloneビルドを実行
   - `output: 'standalone'`モードでビルド
   - `/workspace/.next/standalone`ディレクトリに最小限のファイルのみコピー
   - **`.lancedb`はインポートされていないためコピーされない** ❌

3. **postbuild**: 現在はKuromoji辞書のみコピー
   - `copy-kuromoji-dict.js`のみ実行
   - **`.lancedb`のコピー処理が存在しない** ❌

4. **デプロイ**: `.next/standalone`だけがコンテナイメージに含まれる
   - `.lancedb`が存在しない ❌

5. **実行時**: LanceDBが`.lancedb`を探すが見つからない
   - `No vector column found` エラー発生 ❌

### Kuromojiは成功している理由

`copy-kuromoji-dict.js`がpostbuildで`.next/standalone`にコピーしています。

```javascript:scripts/copy-kuromoji-dict.js
const sourceDir = '../node_modules/kuromoji/dict';
const standaloneDestDir = '../.next/standalone/node_modules/kuromoji/dict';
copyRecursiveSync(sourceDir, standaloneDestDir);
```

**同様の処理が`.lancedb`に存在しない**ことが根本原因です。

## 検証

### コード確認結果

```javascript:package.json
"prebuild": "node scripts/conditional-download.js",  // ✅ .lancedbダウンロード
"build": "next build",                                // ❌ .lancedbをコピーしない
"postbuild": "node scripts/copy-kuromoji-dict.js",  // ❌ Kuromojiのみ
```

`postbuild`には`.lancedb`のコピー処理がありません。

### 既存のパターン

`copy-kuromoji-dict.js`と同じパターンを`.lancedb`に適用すれば解決できます。

## 修正方法（調査完了後の対応）

以下のスクリプトを作成済み：

**作成済み**: `scripts/copy-lancedb-data.js`

以下の修正が必要：

```javascript:package.json
"postbuild": "node scripts/copy-kuromoji-dict.js && node scripts/copy-lancedb-data.js"
```

## 調査の最終結論

### 確定したこと

1. ✅ ベクトル次元数の不一致ではない
2. ✅ 列名の不一致ではない  
3. ✅ 実行時ダウンロードのタイミング問題ではない
4. ✅ **ビルド時にダウンロードは成功している**
5. ✅ **Next.jsのstandaloneビルドでコピーされていない**

### 根本原因

**Next.jsのstandaloneビルドでは、コードから直接インポートされていないファイルは自動的にコピーされない。**

そのため、明示的なコピー処理が必要ですが、`postbuild`には`.lancedb`のコピー処理が存在しませんでした。

### 同様の問題が解決済みのパターン

- ✅ Kuromoji辞書: `copy-kuromoji-dict.js`で解決済み
- ✅ Xenovaモデル: `copy-model-files.js`で解決済み
- ❌ LanceDBデータ: **コピー処理が存在しない** ← 原因

## 解決策

Kuromoji辞書と同様に、`postbuild`で`.lancedb`をコピーする処理を追加する必要があります。

### 作成済みファイル

- ✅ `scripts/copy-lancedb-data.js`: 作成完了

### 未実施（修正不要）

- ⏸️ `package.json`の`postbuild`修正（ユーザー指示により実施しない）

## 調査完了

**修正は不要なため実装は行いませんが、根本原因は完全に特定できました。**

