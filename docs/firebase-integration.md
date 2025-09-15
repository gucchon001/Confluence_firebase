# Firebase統合ガイド

## 1. 概要

このドキュメントでは、Firebase Admin SDKを使用してFirebaseサービス（特にFirestore）と統合する方法について説明します。Firebase Admin SDKは、サーバーサイドでFirebaseサービスにアクセスするための強力なツールです。

## 2. 前提条件

- Node.js環境
- Firebase Admin SDK（`firebase-admin`）がインストールされていること
- Firebaseサービスアカウントキー（`firebase-adminsdk-key.json`）

## 3. Firebase Admin SDKの初期化

### 3.1 基本的な初期化方法

Firebase Admin SDKを初期化するには、サービスアカウントキーを使用します。以下のコードを使用して初期化します：

```typescript
import * as admin from 'firebase-admin';
import * as path from 'path';

// サービスアカウントキーを使用して初期化
const serviceAccountPath = './keys/firebase-adminsdk-key.json';
const serviceAccount = require(path.resolve(serviceAccountPath));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Firestoreインスタンスを取得
const firestore = admin.firestore();
```

### 3.2 環境変数を使用した初期化

環境変数を使用して、サービスアカウントキーのパスを指定することもできます：

```typescript
import * as admin from 'firebase-admin';
import * as path from 'path';

// 環境変数からサービスアカウントキーのパスを取得
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
  try {
    const serviceAccount = require(path.resolve(serviceAccountPath));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin SDK initialized with service account');
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
  }
}
```

### 3.3 フォールバック初期化

サービスアカウントキーが利用できない場合、アプリケーションデフォルト認証情報を使用することもできます：

```typescript
import * as admin from 'firebase-admin';

try {
  // サービスアカウントキーを使用して初期化
  const serviceAccount = require('./keys/firebase-adminsdk-key.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin initialized with service account');
} catch (error) {
  console.error('Firebase admin initialization error:', error);
  // フォールバック: アプリケーションデフォルト認証情報を試す
  try {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
    console.log('Firebase Admin initialized with application default credentials');
  } catch (fallbackError) {
    console.error('Firebase admin fallback initialization error:', fallbackError);
  }
}
```

## 4. Firestoreの使用

### 4.1 ユーザーデータの保存

```typescript
// ユーザードキュメントを保存
await firestore.collection('users').doc(userId).set({
  displayName: 'ユーザー名',
  email: 'user@example.com',
  createdAt: admin.firestore.FieldValue.serverTimestamp()
});

// 会話履歴を保存
await firestore.collection('users').doc(userId).collection('conversations').doc(conversationId).set({
  title: '会話タイトル',
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  messages: [
    {
      role: 'user',
      content: 'ユーザーからのメッセージ',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    },
    {
      role: 'ai',
      content: 'AIからの返答',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      sources: [
        {
          title: '参照元ドキュメント',
          url: 'https://example.com/document'
        }
      ]
    }
  ]
});
```

### 4.2 ログデータの保存

```typescript
// 同期ログを保存
await firestore.collection('syncLogs').add({
  operation: 'confluence_sync',
  status: 'completed',
  timestamp: admin.firestore.FieldValue.serverTimestamp(),
  details: {
    pagesProcessed: 10,
    chunksCreated: 25,
    errors: []
  }
});
```

### 4.3 データの取得

```typescript
// ユーザーの会話一覧を取得
const conversationsSnapshot = await firestore
  .collection('users')
  .doc(userId)
  .collection('conversations')
  .orderBy('updatedAt', 'desc')
  .limit(10)
  .get();

const conversations = [];
conversationsSnapshot.forEach(doc => {
  conversations.push({
    id: doc.id,
    ...doc.data()
  });
});
```

## 5. エラーハンドリングとログ管理

### 5.1 エラーログの保存

```typescript
// エラーログを保存する関数
async function logError(operation: string, error: any, context: any = {}) {
  try {
    await firestore.collection('errorLogs').add({
      operation,
      message: error.message,
      stack: error.stack,
      context,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (logError) {
    console.error('Failed to save error log:', logError);
  }
}

// 使用例
try {
  // 何らかの処理
} catch (error) {
  await logError('data_sync', error, { userId, dataId });
}
```

### 5.2 処理状態の管理

```typescript
// 処理状態を管理する関数
async function trackProcessingState(operationId: string, status: 'started' | 'completed' | 'failed', details: any = {}) {
  const stateRef = firestore.collection('processingState').doc(operationId);
  
  if (status === 'started') {
    await stateRef.set({
      status,
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      details
    });
  } else if (status === 'completed') {
    await stateRef.update({
      status,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      details
    });
  } else if (status === 'failed') {
    await stateRef.update({
      status,
      failedAt: admin.firestore.FieldValue.serverTimestamp(),
      error: details.error || 'Unknown error',
      details
    });
  }
}
```

## 6. セキュリティとベストプラクティス

### 6.1 サービスアカウントキーの保護

- サービスアカウントキーは機密情報であり、Gitリポジトリにコミットしないでください
- `.gitignore`ファイルに`keys/*.json`を追加してください
- 環境変数を使用してサービスアカウントキーのパスを指定することを推奨します

### 6.2 初期化のベストプラクティス

- アプリケーションの起動時に一度だけFirebase Admin SDKを初期化してください
- 複数回の初期化を避けるために、初期化状態を確認してください：

```typescript
if (!admin.apps.length) {
  // Firebase Admin SDKを初期化
}
```

### 6.3 エラーハンドリング

Firebase操作は常にtry-catchブロックで囲み、エラーを適切に処理してください：

```typescript
try {
  await firestore.collection('users').doc(userId).set(data);
} catch (error) {
  console.error('Firestore operation failed:', error);
  // エラーに応じた適切な処理
}
```

## 7. 環境設定

### 7.1 .env設定

`.env`ファイルに以下の設定を追加してください：

```
GOOGLE_APPLICATION_CREDENTIALS=./keys/firebase-adminsdk-key.json
```

### 7.2 Next.jsでの設定

Next.jsでFirebase Admin SDKを使用する場合は、`next.config.js`に以下の設定を追加してください：

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        'firebase-admin': 'commonjs firebase-admin',
      });
    }
    return config;
  },
};

module.exports = nextConfig;
```

## 8. トラブルシューティング

### 8.1 初期化エラー

**問題**: `Error: The default Firebase app already exists.`

**解決策**: アプリケーション内で複数回初期化されていないか確認してください：

```typescript
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
```

### 8.2 認証エラー

**問題**: `FirebaseAppError: Failed to initialize app: invalid credential`

**解決策**: 
- サービスアカウントキーが正しいことを確認してください
- 環境変数`GOOGLE_APPLICATION_CREDENTIALS`が正しく設定されているか確認してください
- サービスアカウントキーのパスが正しいか確認してください

### 8.3 Firestoreアクセスエラー

**問題**: `FirebaseError: Missing or insufficient permissions`

**解決策**: Firebaseコンソールでセキュリティルールを確認し、適切なアクセス権限が設定されているか確認してください。

## 9. まとめ

Firebase Admin SDKを使用することで、サーバーサイドからFirebaseサービスに安全にアクセスできます。ユーザーデータの管理、会話履歴の保存、ログ記録などにFirestoreを活用することで、効率的なアプリケーション開発が可能になります。セキュリティとベストプラクティスに注意しながら、Firebase統合を実装してください。