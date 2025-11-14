# Firebase App Hosting 必須環境変数

> ⚠️ **統合済み（2025-11-13）:** このドキュメントの内容は `deployment-guide.md` に統合されました。  
> **最新の情報**: [deployment-guide.md](./deployment-guide.md) を参照してください。  
> このドキュメントは履歴目的で保持されています。

## ビルド時（BUILD）とランタイム（RUNTIME）の両方で必要

### Google Cloud
- `GOOGLE_CLOUD_PROJECT`: `confluence-copilot-ppjye`

## ビルド時（BUILD）のみ必要

### Next.js Public Variables
- `NEXT_PUBLIC_FIREBASE_API_KEY`: `AIzaSyAgaGihnyshajIN2YC7CdJR_H0bJMg_hkI`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`: `confluence-copilot-ppjye.firebaseapp.com`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`: `confluence-copilot-ppjye`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`: `confluence-copilot-ppjye.firebasestorage.app`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`: `122015916118`
- `NEXT_PUBLIC_FIREBASE_APP_ID`: `1:122015916118:web:50d117434b1318f173dbf7`
- `NEXT_PUBLIC_USE_MOCK_DATA`: `false`

## ランタイム（RUNTIME）のみ必要

### Confluence API
- `CONFLUENCE_BASE_URL`: `https://giginc.atlassian.net`
- `CONFLUENCE_USER_EMAIL`: `kanri@jukust.jp`
- `CONFLUENCE_SPACE_KEY`: `CLIENTTOMO`

### その他
- `USE_LLM_EXPANSION`: `true`

**注意**: `EMBEDDINGS_PROVIDER`は削除済み（2025-10-28移行）
- 現在はGemini Embeddings API (text-embedding-004) を直接使用
- 設定は `src/config/ai-models-config.ts` で一元管理（provider: 'api'）

## シークレット（Secret Manager）

### ビルド時とランタイムの両方
- `GEMINI_API_KEY` → Secret: `gemini_api_key`

### ランタイムのみ
- `CONFLUENCE_API_TOKEN` → Secret: `confluence_api_token`

---

## Firebase Consoleでの設定方法

1. https://console.firebase.google.com/project/confluence-copilot-ppjye/apphosting
2. `confluence-chat` バックエンドを開く
3. **「設定」タブ** → **「環境変数」セクション**
4. **「変数を追加」**をクリック
5. 上記の環境変数を1つずつ追加
   - **キー**: 変数名（例: `NEXT_PUBLIC_FIREBASE_API_KEY`）
   - **値**: 対応する値（例: `AIzaSyAgaGihnyshajIN2YC7CdJR_H0bJMg_hkI`）
   - **可用性**: `BUILD`、`RUNTIME`、または両方を選択

---

## 注意事項

1. **`NEXT_PUBLIC_*`環境変数はビルド時に必要**：
   - Next.jsはビルド時にこれらをバンドルに埋め込みます
   - `availability: BUILD`を必ず設定してください

2. **シークレットは別途Secret Managerで管理**：
   - `GEMINI_API_KEY`と`CONFLUENCE_API_TOKEN`はSecret Managerに保存済み
   - 環境変数でシークレット名を参照します

3. **`apphosting.yaml`は現在非推奨**：
   - Firebase App Hostingの最新仕様では、環境変数はConsoleで管理します
   - `apphosting.yaml`は主にインスタンス設定（メモリ、CPU）に使用されます

