# postbuildによるファイルコピー解決策

## 問題の概要

Firebase App Hosting環境でXenova Transformers.jsのモデルファイルとKuromoji辞書ファイルが本番環境で見つからず、アプリケーションが起動できなかった。

## 根本原因

### CopyPluginが機能しない理由

Firebase App Hostingは`apphosting-adapter-nextjs-build`という特殊なビルドプロセスを使用しており、このプロセスが`next.config.ts`のWebpack設定（CopyPlugin含む）を上書きまたは無視する。

### 試行した解決策と失敗理由

1. **CopyPlugin**: ビルドログに実行痕跡なし
2. **build script**: `"build": "next build && ..."` のような`&&`連結はビルドプロセスを干渉し、不安定になる
3. **env.localModelPath**: 相対パス`models`が期待パスと合わない

## 最終的な解決策

### 1. postbuildスクリプトの活用

`package.json`で`postbuild`を定義することで、Next.jsビルドが完全に終了した後にファイルコピーを実行する。

```json
{
  "scripts": {
    "prebuild": "node scripts/download-embedding-model.js && node scripts/conditional-download.js",
    "build": "next build",
    "postbuild": "node scripts/copy-model-files.js && node scripts/copy-kuromoji-dict.js"
  }
}
```

### 2. ファイルコピースクリプトの作成

#### scripts/copy-model-files.js

モデルファイルを`.next/standalone/models/Xenova/`にコピーする。

重要なポイント：
- ソース: `/workspace/models/paraphrase-multilingual-mpnet-base-v2`
- ディレクトリ: `/workspace/.next/standalone/models/Xenova/paraphrase-multilingual-mpnet-base-v2`
- `Xenova/`プレフィックスを明示的に含める

#### scripts/copy-kuromoji-dict.js

既存のスクリプトを再利用し、Kuromoji辞書ファイルをコピーする。

### 3. embeddings.tsのパス設定修正

```typescript
// 修正前（間違い）
env.localModelPath = path.join(process.cwd(), 'models');

// 修正後（正しい）
env.localModelPath = process.cwd();
```

**理由**：
- 実行時の`process.cwd()`は`/workspace/.next/standalone`
- ファイルは`/workspace/.next/standalone/models/Xenova/paraphrase-multilingual-mpnet-base-v2`に配置されている
- ライブラリは`basePath + /models/Xenova/paraphrase-multilingual-mpnet-base-v2`を検索する
- したがって、basePathは`process.cwd()`そのものでなければならない

## ビルドログでの確認

成功時のビルドログに以下の出力があることを確認：

```
> nextn@0.1.0 postbuild
> node scripts/copy-model-files.js && node scripts/copy-kuromoji-dict.js
📦 [PostBuild] モデルファイルをコピー中...
✅ [PostBuild] モデルファイルをコピー完了: 5ファイル
   Source: /workspace/models/paraphrase-multilingual-mpnet-base-v2
   Dest: /workspace/.next/standalone/models/Xenova/paraphrase-multilingual-mpnet-base-v2
   ✅ tokenizer.json: 16682.53 KB
   ✅ config.json: 存在確認
   ✅ onnx/: 2ファイル
📦 [PostBuild] Kuromoji辞書ファイルをコピー中...
✅ [PostBuild] Kuromoji辞書ファイルをコピー完了: 12ファイル
   Source: /workspace/node_modules/kuromoji/dict
   Dest: /workspace/.next/standalone/node_modules/kuromoji/dict
   ✅ base.dat.gz: 3.77 MB
```

## なぜこの方法が成功したか

1. **タイミング**: `next build`が完全に終了してから実行されるため、干渉しない
2. **確実性**: Node.jsのfs APIでファイルシステムに直接アクセスし、確実にコピーされる
3. **透明性**: ビルドログに明確に出力されるため、デバッグが容易

## Firebase App Hostingにおける教訓

- Next.jsの標準的なビルドツール（Webpack）は信頼できない場合がある
- 外部アダプター（`apphosting-adapter-nextjs-build`）がビルドプロセスを制御する場合、手動ファイルコピーが最も確実
- `postbuild`は`npm run build`コマンドが完全に終了した後に実行されるため、安定している

## 今後の改善案

1. **Dockerfileの使用**: Custom Buildpacksを活用してビルドプロセスを完全に制御
2. **Cloud Storageとの統合**: モデルファイルをCloud Storageから実行時にダウンロード
3. **モデルの軽量化**: より小さなモデルへの切り替えでコンテナイメージサイズを削減

