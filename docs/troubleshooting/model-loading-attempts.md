# モデル読み込み問題の試行錯誤記録

## 問題の概要

Firebase App Hosting (Cloud Run) 環境で、Xenova Transformers.js を使用してローカルモデルを読み込む際、外部へのアクセスを試みたり、ファイルが見つからず失敗する。

エラーメッセージ：
- `Unexpected token 'T', "Temporary "... is not valid JSON`
- `file was not found locally at "/workspace/.next/standalone/workspace/.next/standalone/Xenova/..."`
- `file was not found locally at "/workspace/.next/standalone/node_modules/@xenova/transformers/models/workspace/.next/standalone/Xenova/..."`

## 試行履歴

### 試行 1: 基本的な設定
**日時**: 2025-10-25 初回  
**設定**:
```typescript
env.localModelPath = process.cwd();
env.allowRemoteModels = false;
pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-mpnet-base-v2', {
  local_files_only: true,
})
```
**結果**: パスが二重連結される問題が発生
- 実際のパス: `/workspace/.next/standalone/workspace/.next/standalone/Xenova/...`
- エラー: `file was not found locally at ".../workspace/.next/standalone/workspace/.next/standalone/Xenova/..."`

### 試行 2: env.localModelPath を空文字列に
**日時**: 2025-10-27  
**設定**:
```typescript
env.localModelPath = '';
env.allowRemoteModels = false;
const absoluteModelPath = path.resolve(cwd, 'Xenova', 'paraphrase-multilingual-mpnet-base-v2');
pipeline('feature-extraction', absoluteModelPath, {
  local_files_only: true,
})
```
**結果**: パスが二重連結される問題が再発
- 実際のパス: `/workspace/.next/standalone/workspace/.next/standalone/Xenova/...`
- エラー: 同じ二重パス問題

### 試行 3: env.localModelPath と cache_dir の両方を設定
**日時**: 2025-10-27  
**設定**:
```typescript
env.localModelPath = cwd;
env.allowRemoteModels = false;
env.cacheDir = path.join(cwd, 'Xenova');
pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-mpnet-base-v2', {
  local_files_only: true,
  cache_dir: path.join(cwd, 'Xenova'),
})
```
**結果**: 外部アクセスを試みる
- エラー: `Unexpected token 'T', "Temporary "... is not valid JSON`
- つまり、ライブラリがローカルファイルを無視して外部アクセスを試みている

### 試行 4: モデルIDからプレフィックス除去
**日時**: 2025-10-27  
**設定**:
```typescript
process.env.HF_HUB_OFFLINE = '1';
process.env.HF_HOME = cwd;
process.env.CACHE_DIR = path.join(cwd, 'Xenova');
pipeline('feature-extraction', 'paraphrase-multilingual-mpnet-base-v2', {
  local_files_only: true,
  cache_dir: path.join(cwd, 'Xenova'),
})
```
**結果**: 未確認（デプロイ待ち）

## 根本原因の仮説

1. **ライブラリのパス解決ロジックの問題**: `@xenova/transformers` が絶対パスを受け取っても、内部的に `env.localModelPath` と結合してしまう
2. **バージョン固有のバグ**: `@xenova/transformers@2.17.2` にバグがある可能性
3. **環境変数の解釈**: `local_files_only: true` と `env.allowRemoteModels = false` が無視されている

## 確認済み事項

- ✅ ファイルは正しく配置されている: `.next/standalone/Xenova/paraphrase-multilingual-mpnet-base-v2/`
- ✅ tokenizer.json は存在する（16.7MB）
- ✅ postbuildスクリプトは正常に動作している
- ❌ ライブラリがそのパスを正しく読み込めない

## 推奨される次のステップ

### オプション 1: ライブラリのバージョンを変更
```bash
npm uninstall @xenova/transformers
npm install @xenova/transformers@2.16.0  # 以前のバージョンに戻す
```

### オプション 2: 別のライブラリを使用
- `sentence-transformers` または
- `@tensorflow/tfjs-node` を使用してモデルを直接読み込む

### オプション 3: Dockerfileで環境変数を設定
`apphosting.yaml` の代わりに、ビルド時に環境変数を設定する

### オプション 4: パッチを作成
`patch-package` を使用して、`@xenova/transformers` のパス解決ロジックを修正

## 重要な学び

1. **同じアプローチを繰り返さない**: 試行1と2は本質的に同じ失敗を繰り返している
2. **根本原因を特定する**: 症状を観察するだけでなく、ライブラリの内部動作を理解する必要がある
3. **代替手段を検討する**: ライブラリに問題がある場合、代替手段を考えるべき
4. **ローカルテストを徹底する**: 本番環境で失敗する前に、ローカルで徹底的にテストすべき

## 参考資料

- [Xenova Transformers.js Documentation](https://huggingface.co/docs/transformers.js)
- [Firebase App Hosting Documentation](https://firebase.google.com/docs/app-hosting)
- [GitHub Issue: Local model loading](https://github.com/xenova/transformers.js/issues)

---

**作成日**: 2025-10-27  
**最終更新**: 2025-10-27  
**ステータス**: 未解決 - 試行中
