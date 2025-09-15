## ローカル検索基盤への移行方針（LanceDB + Firestore）

### 目的
- Vertex AI Vector Search の利用を停止し、無料/低コストかつ Windows でも動くローカル構成へ移行
- 社内メンバーのみ利用（Google アカウント・ドメイン制限）

### 全体構成
- Embedding 生成: `local`（@xenova/transformers）を基本。必要に応じて `vertex` に切替可能（env）
- ベクトル検索: LanceDB（ローカルFS 永続化: `.lancedb/`）
- メタデータ・権限: Firestore（`chunks/{id}` で本文/URLなど）
- フロント/API: Next.js（Route Handler）または Cloud Functions（社内公開時）

### ID・データスキーマ
- 主キー: `id = <pageId>-<chunkIndex>`（既存踏襲）
- LanceDB テーブル例 `confluence`:
  - `id: string`
  - `vector: number[768]`
  - `space_key: string`
  - `title: string`
  - `labels: string[]`
- Firestore: `chunks/{id}` に本文や URL、表示用情報を保持

### Firestore ルール（ドメイン制限の例）
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAllowedUser() {
      return request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.email.endsWith('@example.com');
    }
    match /{document=**} {
      allow read, write: if isAllowedUser();
    }
  }
}
```

### セットアップ手順（ローカル）
1) 依存導入
```
npm i @lancedb/lancedb @lancedb/lancedb-node
# ローカル埋め込みを使う場合
npm i @xenova/transformers
```
2) データ投入
- 新規スクリプト `src/scripts/lancedb-load.ts`（作成予定）で `data/embeddings-*.json` を LanceDB に投入
- 永続ディレクトリ: `.lancedb/`
3) 検索 API
- `src/app/api/search/route.ts`（作成予定）
  1. テキスト → 埋め込み生成
  2. LanceDB `.search(vector).limit(5).where("space_key = 'CLIENTTOMO'")`
  3. 取得した `id` で Firestore から本文/URL を取得

### env 切替例
```
EMBEDDINGS_PROVIDER=local  # local / vertex
```

### 性能目安（ローカル・SSD・1プロセス）
- 5k〜20k ベクトル、top_k=5: 10〜50ms 程度
- ボトルネックは埋め込み生成。開発時はローカルモデル、精度要件時のみ Vertex を使用

### 運用指針
- Hosting/Functions で社内公開する場合は、Functions 側から LanceDB を参照（同一マシン/永続ボリューム）
- 日常はローカルで開発 → `firebase hosting:channel:deploy` でレビューURL、`firebase deploy --only hosting` で本番

### 今後の実装タスク（抜粋）
1. LanceDB ローダー `src/scripts/lancedb-load.ts`
2. 検索 API `src/app/api/search/route.ts`（または `functions/src/search.ts`）
3. 埋め込み層の抽象化 `src/lib/embeddings.ts`（`local`/`vertex` 切替）
4. Firestore ルールのドメイン制限反映
5. README 更新（起動～公開～権限）


