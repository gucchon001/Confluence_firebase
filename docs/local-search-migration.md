# ローカル検索基盤への移行方針（LanceDB）

## 目的
- コスト削減と効率化のため、外部APIに依存しないローカル構成へ移行
- 社内メンバーのみ利用（Google アカウント・ドメイン制限）

## 全体構成
- Embedding 生成: `@xenova/transformers`（ローカル実行）
- ベクトル検索: LanceDB（ローカルFS 永続化: `.lancedb/`）
- メタデータ: LanceDBに統合（メタデータも含めて一元管理）
- ユーザーデータ: Firestore（会話履歴、ユーザー情報、ログ）
- フロント/API: Next.js（Route Handler）または Cloud Functions（社内公開時）

## データスキーマ
- 主キー: `id = <pageId>-<chunkIndex>`
- LanceDB テーブル例 `confluence`:
  - `id: string`
  - `vector: number[768]`
  - `space_key: string`
  - `title: string`
  - `labels: string[]`
  - `content: string`
  - `pageId: string`
  - `chunkIndex: number`
  - `url: string`
  - `lastUpdated: string`

## Firestore ルール（ドメイン制限の例）
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAllowedUser() {
      return request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.email.endsWith('@example.com');
    }
    
    // ユーザーは自分のドキュメントとサブコレクションのみ読み書き可能
    match /users/{userId}/{documents=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId && isAllowedUser();
    }
    
    // syncLogsはAdmin SDKからのみアクセス可能
    match /syncLogs/{logId} {
      allow read, write: if false;  // Cloud Functions経由でのみアクセス可能
    }
    
    // errorLogsはAdmin SDKからのみアクセス可能
    match /errorLogs/{logId} {
      allow read, write: if false;  // Cloud Functions経由でのみアクセス可能
    }
  }
}
```

## セットアップ手順（ローカル）
1) 依存導入
```
npm i @lancedb/lancedb @xenova/transformers
```

2) データ同期
- `src/scripts/batch-sync-confluence.ts`でConfluenceからデータを取得し、LanceDBに保存
- 永続ディレクトリ: `.lancedb/`

3) 検索 API
- `src/app/api/search/route.ts`
  1. テキスト → 埋め込み生成
  2. LanceDB `.search(vector).limit(20).where("space_key = 'EXAMPLE'")`
  3. 検索結果（ベクトルとメタデータ）を直接クライアントに返す

## 環境変数設定
```
EMBEDDINGS_PROVIDER=local
CONFLUENCE_BASE_URL=https://example.atlassian.net
CONFLUENCE_USER_EMAIL=user@example.com
CONFLUENCE_API_TOKEN=your_api_token
CONFLUENCE_SPACE_KEY=EXAMPLE
GOOGLE_APPLICATION_CREDENTIALS=./keys/firebase-adminsdk-key.json
```

## 性能目安（ローカル・SSD・1プロセス）
- 5k〜20k ベクトル、top_k=20: 7〜23ms 程度
- メモリ効率: 低消費（100回の検索で約0.5MB増加）

## 運用指針
- Hosting/Functions で社内公開する場合は、Functions 側から LanceDB を参照（同一マシン/永続ボリューム）
- 日常はローカルで開発 → `firebase hosting:channel:deploy` でレビューURL、`firebase deploy --only hosting` で本番
- 差分更新機能により、更新されたページのみを効率的に同期

## 今後の実装タスク
1. LanceDBスキーマ問題の修正
2. プロンプトチューニング
3. システムテスト
4. パフォーマンス最適化
5. README 更新（起動～公開～権限）