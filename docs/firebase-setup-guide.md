# Firebase環境構築・認証機能実装ガイド

## 1. Firebase環境構築

### 1.1 Firebaseプロジェクトの作成

1. [Firebase Console](https://console.firebase.google.com/)にアクセスします。
2. 「プロジェクトを追加」をクリックします。
3. プロジェクト名に「confluence-spec-chat」を入力します。
4. Google アナリティクスの設定を行います（オプション）。
5. 「プロジェクトを作成」をクリックします。

### 1.2 Webアプリの登録

1. プロジェクトのダッシュボードで「ウェブ」アイコン（`</>` マーク）をクリックします。
2. アプリのニックネームに「confluence-spec-chat-web」を入力します。
3. 「このアプリのFirebase Hostingも設定する」にチェックを入れます。
4. 「アプリを登録」をクリックします。
5. 表示されるFirebaseの設定情報をコピーします。

### 1.3 環境変数の設定

1. プロジェクトのルートディレクトリに `.env.local` ファイルを作成します。
2. 以下の内容を `.env.local` ファイルに追加します（値は先ほどコピーした設定情報に置き換えてください）：

```
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# 埋め込みモデル設定
EMBEDDINGS_PROVIDER=local
```

## 2. Firebase認証の設定

### 2.1 認証方法の有効化

1. Firebase Consoleで「Authentication」をクリックします。
2. 「Sign-in method」タブをクリックします。
3. 「Google」をクリックし、「有効にする」をオンにします。
4. プロジェクトのサポートメールを選択します。
5. 「保存」をクリックします。

### 2.2 承認済みドメインの追加

1. 「Authentication」の「Settings」タブをクリックします。
2. 「Authorized domains」セクションで「Add domain」をクリックします。
3. ローカル開発用に `localhost` を追加します。
4. 本番環境用のドメインがある場合は、それも追加します。
5. 「Add」をクリックします。

## 3. Firestore データベースの設定

### 3.1 Firestoreの作成

1. Firebase Consoleで「Firestore Database」をクリックします。
2. 「データベースの作成」をクリックします。
3. セキュリティルールのモードを選択します（開発中は「テストモード」でも構いません）。
4. データベースのロケーションを選択します（アプリのユーザーに最も近い場所を選択してください）。
5. 「次へ」をクリックし、「有効にする」をクリックします。

### 3.2 セキュリティルールの設定

1. 「Rules」タブをクリックします。
2. 以下のセキュリティルールを設定します：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ユーザーは自分のドキュメントとサブコレクションのみ読み書き可能
    match /users/{userId}/{documents=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // syncLogsはAdmin SDKからのみアクセス可能
    match /syncLogs/{logId} {
      allow read, write: if false;  // Cloud Functions経由でのみアクセス可能
    }
  }
}
```

3. 「公開」をクリックします。

## 4. アプリケーションの認証機能実装

### 4.1 既存のコードの確認

既に以下のファイルが実装されています：

- `src/lib/firebase.ts` - Firebaseの初期化
- `src/lib/firebase-config.js` - Firebase設定
- `src/hooks/use-auth.tsx` - 認証フックと認証コンテキスト
- `src/hooks/use-mock-auth.tsx` - モック認証（テスト用）
- `src/hooks/use-auth-wrapper.tsx` - 実際の認証とモック認証の切り替え

### 4.2 実際のFirebase認証の確認

1. 開発サーバーを起動します：

```bash
npm run dev
```

2. ブラウザで http://localhost:9002 にアクセスします。
3. ログイン画面が表示されることを確認します。
4. 「Sign in with Google」ボタンをクリックして、Googleアカウントでログインを試みます。
5. 正常にログインできることを確認します。

### 4.3 認証エラーのトラブルシューティング

ログイン時にエラーが発生した場合、以下を確認してください：

1. `.env.local` ファイルの設定値が正しいか確認します。
2. Firebase Consoleで「Authentication」の「Sign-in method」で「Google」が有効になっているか確認します。
3. Firebase Consoleで「Authentication」の「Settings」で「Authorized domains」に `localhost` が追加されているか確認します。
4. ブラウザのコンソールでエラーメッセージを確認します。

## 5. Firebase Emulatorの設定（オプション）

ローカル開発時に実際のFirebaseサービスではなくエミュレータを使用する場合：

### 5.1 Firebase CLIのインストール

```bash
npm install -g firebase-tools
```

### 5.2 Firebase Emulatorのセットアップ

1. プロジェクトのルートディレクトリで以下のコマンドを実行します：

```bash
firebase login
firebase init emulators
```

2. 必要なエミュレータ（Authentication, Firestore, Functions）を選択します。
3. `firebase.json` ファイルが生成されます。

### 5.3 エミュレータの起動

```bash
firebase emulators:start
```

### 5.4 アプリケーションの設定

`src/lib/firebase.ts` を修正して、開発環境ではエミュレータを使用するようにします：

```typescript
'use client';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { firebaseConfig } from './firebase-config';

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// エミュレータへの接続（開発環境のみ）
if (process.env.NODE_ENV === 'development') {
  const db = getFirestore(app);
  const auth = getAuth(app);
  
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectAuthEmulator(auth, 'http://localhost:9099');
    console.log('Using Firebase emulators');
  }
}

export { app };
```

## 6. 動作確認

1. 開発サーバーを再起動します：

```bash
npm run dev
```

2. ブラウザで http://localhost:9002 にアクセスします。
3. ログイン、チャット機能が正常に動作することを確認します。

## 7. 次のステップ

1. LanceDBの設定
2. Confluence APIの設定
3. データ同期バッチの実装
4. RAG Flowの実装