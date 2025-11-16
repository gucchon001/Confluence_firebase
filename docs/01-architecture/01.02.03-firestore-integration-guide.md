# Firestore統合ガイド

## 1. 概要

このドキュメントでは、Confluence仕様書要約チャットボットにおけるFirestoreの統合方法と使用方法について説明します。Firestoreは、ユーザー管理、会話履歴、ログ管理などの重要な機能を提供しています。

## 2. アーキテクチャ

### 2.1 Firestoreの役割

- **ユーザー管理**: Firebase Authenticationと連携したユーザー情報管理
- **会話履歴**: ユーザーとAIの会話履歴の保存・管理
- **ログ管理**: システムログと同期ログの保存
- **メタデータ**: 検索結果の補完情報（LanceDBと連携）

### 2.2 データフロー

```
ユーザー認証 → Firestore (ユーザー情報)
     ↓
チャット入力 → Firestore (会話履歴)
     ↓
検索処理 → LanceDB (ベクトル検索) + Firestore (メタデータ)
     ↓
AI回答 → Firestore (会話履歴更新)
```

## 3. データベース設計

### 3.1 コレクション構造

```
[Root]
├── users (Collection)
│   └── {userId} (Document)
│       ├── uid: string
│       ├── displayName: string
│       ├── email: string
│       ├── createdAt: Timestamp
│       └── conversations (Subcollection)
│           └── {conversationId} (Document)
│               ├── title: string
│               ├── createdAt: Timestamp
│               ├── updatedAt: Timestamp
│               └── messages: Array<Message>
│
└── syncLogs (Collection)
    └── {logId} (Document)
        ├── operation: string
        ├── status: string
        ├── timestamp: Timestamp
        └── details: object
```

### 3.2 スキーマ定義

#### ユーザードキュメント
```typescript
interface UserDocument {
  uid: string;                    // Firebase AuthenticationのユーザーID
  displayName: string;            // Googleアカウントの表示名
  email: string;                  // Googleアカウントのメールアドレス
  createdAt: Timestamp;           // ユーザーが初回ログインした日時
}
```

#### 会話ドキュメント
```typescript
interface ConversationDocument {
  title: string;                  // 会話のタイトル
  createdAt: Timestamp;           // 会話が開始された日時
  updatedAt: Timestamp;           // 最後のメッセージが追加された日時
  messages: Message[];            // 会話のメッセージ履歴
}

interface Message {
  role: 'user' | 'assistant';     // メッセージの送信者
  content: string;                 // メッセージのテキスト本文
  timestamp: Timestamp;            // メッセージが送信された日時
  sources?: Source[];              // AIメッセージの場合の参照元
}

interface Source {
  title: string;                   // 参照元Confluenceページのタイトル
  url: string;                     // 参照元ConfluenceページへのURL
  spaceName?: string;              // 参照元のConfluenceスペース名
  lastUpdated?: string;            // 参照元ページの最終更新日時
}
```

#### 同期ログドキュメント
```typescript
interface SyncLogDocument {
  operation: string;               // 操作名（'confluence_sync', 'data_import'など）
  status: 'started' | 'completed' | 'failed';
  timestamp: Timestamp;            // ログが作成された日時
  details: {
    pagesProcessed?: number;       // 処理されたページ数
    chunksCreated?: number;        // 作成されたチャンク数
    errors?: string[];             // エラーリスト
    duration?: number;             // 処理時間（秒）
  };
}
```

## 4. 実装

### 4.1 Firebase初期化

```typescript
// src/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
```

### 4.2 会話管理サービス

```typescript
// src/lib/conversation-service.ts
import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc,
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';

// 新しい会話を作成
export async function createConversation(userId: string, initialMessage: MessageCreate) {
  const conversationsRef = collection(db, 'users', userId, 'conversations');
  const newConversation = await addDoc(conversationsRef, {
    title: initialMessage.content.substring(0, 30) + '...',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    messages: [initialMessage]
  });
  return newConversation.id;
}

// 会話にメッセージを追加
export async function addMessageToConversation(userId: string, conversationId: string, message: MessageCreate) {
  const conversationRef = doc(db, 'users', userId, 'conversations', conversationId);
  await updateDoc(conversationRef, {
    messages: arrayUnion(message),
    updatedAt: Timestamp.now()
  });
}

// ユーザーの全会話を取得
export async function getConversations(userId: string, maxResults = 10) {
  const conversationsRef = collection(db, 'users', userId, 'conversations');
  const q = query(conversationsRef, orderBy('updatedAt', 'desc'), limit(maxResults));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}
```

### 4.3 ユーザー管理サービス

```typescript
// src/lib/user-service.ts
import { doc, setDoc, getDoc } from 'firebase/firestore';

// ユーザー情報を作成または更新
export async function createOrUpdateUser(user: User) {
  const userRef = doc(db, 'users', user.uid);
  await setDoc(userRef, {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    createdAt: Timestamp.now()
  }, { merge: true });
}
```

## 5. セキュリティルール

### 5.1 Firestoreセキュリティルール

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ユーザーは自分のドキュメントとサブコレクションのみ読み書き可能
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // syncLogsはAdmin SDKからのみアクセス可能
    match /syncLogs/{logId} {
      allow read, write: if false;  // Cloud Functions経由でのみアクセス可能
    }
  }
}
```

### 5.2 認証設定

```typescript
// 認証状態の確認
import { onAuthStateChanged } from 'firebase/auth';

onAuthStateChanged(auth, (user) => {
  if (user) {
    // ユーザーがログインしている
    console.log('User is signed in:', user.uid);
  } else {
    // ユーザーがログアウトしている
    console.log('User is signed out');
  }
});
```

## 6. パフォーマンス最適化

### 6.1 インデックス設定

```json
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "conversations",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "updatedAt",
          "order": "DESCENDING"
        }
      ]
    }
  ]
}
```

### 6.2 クエリ最適化

```typescript
// 効率的なクエリの例
const q = query(
  collection(db, 'users', userId, 'conversations'),
  orderBy('updatedAt', 'desc'),
  limit(10)
);
```

## 7. エラーハンドリング

### 7.1 リトライ機能

```typescript
// src/lib/retry-utils.ts
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: { maxRetries: number; onRetry?: (error: any, retryCount: number, delay: number) => void }
): Promise<T> {
  let lastError: any;
  
  for (let i = 0; i <= options.maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (i < options.maxRetries) {
        const delay = Math.pow(2, i) * 1000; // 指数バックオフ
        await new Promise(resolve => setTimeout(resolve, delay));
        options.onRetry?.(error, i + 1, delay);
      }
    }
  }
  
  throw lastError;
}
```

### 7.2 エラーログ

```typescript
// エラーログの保存
export async function logError(operation: string, error: any, context: any = {}) {
  try {
    await addDoc(collection(db, 'errorLogs'), {
      operation,
      message: error.message,
      stack: error.stack,
      context,
      timestamp: Timestamp.now()
    });
  } catch (logError) {
    console.error('Failed to save error log:', logError);
  }
}
```

## 8. 使用方法

### 8.1 基本的な会話管理

```typescript
import { createConversation, addMessageToConversation, getConversations } from '@/lib/conversation-service';

// 新しい会話を作成
const conversationId = await createConversation(userId, {
  role: 'user',
  content: 'ログイン機能について教えて'
});

// メッセージを追加
await addMessageToConversation(userId, conversationId, {
  role: 'assistant',
  content: 'ログイン機能は以下の通りです...',
  sources: [{ title: 'ログイン仕様書', url: 'https://...' }]
});

// 会話一覧を取得
const conversations = await getConversations(userId, 10);
```

### 8.2 ユーザー管理

```typescript
import { createOrUpdateUser } from '@/lib/user-service';

// ユーザー情報を保存
await createOrUpdateUser(user);
```

## 9. 関連ファイル

- `src/lib/firebase.ts` - Firebase初期化
- `src/lib/conversation-service.ts` - 会話管理サービス
- `src/lib/chat-service.ts` - チャット機能
- `src/lib/user-service.ts` - ユーザー管理サービス
- `src/lib/retry-utils.ts` - リトライ機能
- `firestore.rules` - セキュリティルール
- `firestore.indexes.json` - インデックス設定
- `src/scripts/clear-firestore-collection.ts` - コレクションクリアスクリプト

## 10. トラブルシューティング

### 10.1 よくある問題

1. **認証エラー**: Firebase設定の確認
2. **権限エラー**: セキュリティルールの確認
3. **クエリエラー**: インデックスの確認
4. **接続エラー**: ネットワーク設定の確認

### 10.2 デバッグ方法

```typescript
// デバッグログの有効化
console.log('[Firestore] Operation:', operation);
console.log('[Firestore] Data:', data);
console.log('[Firestore] Error:', error);
```
