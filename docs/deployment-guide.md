# デプロイガイド

このドキュメントでは、Confluence仕様書要約チャットボットのデプロイ手順について説明します。

## 前提条件

- Node.js v20以上
- Firebase CLIがインストールされていること
- Firebase Projectが設定されていること

## ビルド手順

1. 依存関係をインストール
```bash
npm install
```

2. プロダクションビルドを実行
```bash
npm run build
```

## デプロイ手順

### Hostingのみをデプロイする場合

```bash
firebase deploy --only hosting
```

### Functions + Hostingをデプロイする場合

```bash
firebase deploy
```

**注意**: 現在、Firebase Functionsのデプロイには問題があります。`functions.region is not a function`というエラーが発生します。これはFirebase SDKのバージョンの問題である可能性があります。

## アクセスURL

デプロイ後、以下のURLでアプリケーションにアクセスできます：

- **本番環境**: https://confluence-copilot-ppjye.web.app

## トラブルシューティング

### Next.js 15の動的ルートパラメータの問題

Next.js 15では、動的ルートパラメータの扱い方が変更されました。ルートハンドラーでは、`params`が`Promise`型として扱われるようになり、`await`で非同期に取得する必要があります。

```typescript
// Before
export async function POST(
  req: NextRequest,
  { params }: { params: { flow: string } }
) {
  const flow = params.flow;
}

// After
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ flow: string }> }
) {
  const params = await context.params;
  const flow = params.flow;
}
```

### Firebase Functionsのデプロイエラー

Firebase Functionsのデプロイ時に`functions.region is not a function`というエラーが発生する場合は、以下の点を確認してください：

1. Firebase Admin SDKとFirebase Functionsのバージョンが互換性があるか
2. `functions/package.json`のFirebase Functionsのバージョンを確認
3. 必要に応じてFirebase Functionsのバージョンをアップデート

## 参考リンク

- [Next.js 15 アップグレードガイド](https://nextjs.org/docs/app/guides/upgrading/version-15)
- [Firebase Hosting ドキュメント](https://firebase.google.com/docs/hosting)
- [Firebase Functions ドキュメント](https://firebase.google.com/docs/functions)
