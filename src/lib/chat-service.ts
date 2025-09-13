'use client';

import { 
  getFirestore, 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  addDoc,
  Timestamp,
  writeBatch,
  doc,
} from 'firebase/firestore';
import { app } from './firebase';
import type { Message, MessageCreate } from '@/types';
import { withRetry } from './retry-utils';

const db = getFirestore(app);

// 会話IDベースでメッセージを管理
const getMessagesCollection = (conversationId: string) => {
    return collection(db, 'conversations', conversationId, 'messages');
};

// 後方互換性のため、ユーザーIDベースのメッセージも取得可能に
const getUserMessagesCollection = (userId: string) => {
    return collection(db, 'chats', userId, 'messages');
};

// 会話IDベースでメッセージを取得（リトライ機能付き）
export async function getMessagesByConversationId(conversationId: string): Promise<Message[]> {
  return withRetry(
    async () => {
      const messagesCol = getMessagesCollection(conversationId);
      const q = query(messagesCol, orderBy('createdAt', 'asc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
        } as Message;
      });
    },
    {
      maxRetries: 2,
      onRetry: (error, retryCount, delay) => {
        console.log(`[Retry] Fetching messages (${retryCount}/2) after ${delay}ms due to: ${error.message}`);
      }
    }
  );
}

// 後方互換性のため残す（ユーザーIDベース）（リトライ機能付き）
export async function getMessages(userId: string): Promise<Message[]> {
  return withRetry(
    async () => {
      const messagesCol = getUserMessagesCollection(userId);
      const q = query(messagesCol, orderBy('createdAt', 'asc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
        } as Message;
      });
    },
    {
      maxRetries: 2,
      onRetry: (error, retryCount, delay) => {
        console.log(`[Retry] Fetching user messages (${retryCount}/2) after ${delay}ms due to: ${error.message}`);
      }
    }
  );
}

// 会話IDベースでメッセージを追加（リトライ機能付き）
export async function addMessageToConversation(conversationId: string, message: MessageCreate): Promise<void> {
  return withRetry(
    async () => {
      const messagesCol = getMessagesCollection(conversationId);
      await addDoc(messagesCol, {
        ...message,
        createdAt: Timestamp.now(),
      });
    },
    {
      maxRetries: 3,
      onRetry: (error, retryCount, delay) => {
        console.log(`[Retry] Adding message (${retryCount}/3) after ${delay}ms due to: ${error.message}`);
      }
    }
  );
}

// 会話IDベースでメッセージをバッチ追加（リトライ機能付き）
export async function addMessageBatchToConversation(conversationId: string, messages: MessageCreate[]): Promise<void> {
  return withRetry(
    async () => {
      const batch = writeBatch(db);
      const messagesColRef = getMessagesCollection(conversationId);

      messages.forEach(message => {
          const docRef = doc(messagesColRef);
          batch.set(docRef, {
              ...message,
              createdAt: Timestamp.now(),
          });
      });

      await batch.commit();
    },
    {
      maxRetries: 3,
      onRetry: (error, retryCount, delay) => {
        console.log(`[Retry] Adding message batch (${retryCount}/3) after ${delay}ms due to: ${error.message}`);
      }
    }
  );
}

// 後方互換性のため残す（リトライ機能付き）
export async function addMessage(userId: string, message: MessageCreate): Promise<void> {
  return withRetry(
    async () => {
      const messagesCol = getUserMessagesCollection(userId);
      await addDoc(messagesCol, {
        ...message,
        createdAt: Timestamp.now(),
      });
    },
    {
      maxRetries: 3,
      onRetry: (error, retryCount, delay) => {
        console.log(`[Retry] Adding user message (${retryCount}/3) after ${delay}ms due to: ${error.message}`);
      }
    }
  );
}

export async function addMessageBatch(userId: string, messages: MessageCreate[]): Promise<void> {
  return withRetry(
    async () => {
      const batch = writeBatch(db);
      const messagesColRef = getUserMessagesCollection(userId);

      messages.forEach(message => {
          const docRef = doc(messagesColRef);
          batch.set(docRef, {
              ...message,
              createdAt: Timestamp.now(),
          });
      });

      await batch.commit();
    },
    {
      maxRetries: 3,
      onRetry: (error, retryCount, delay) => {
        console.log(`[Retry] Adding user message batch (${retryCount}/3) after ${delay}ms due to: ${error.message}`);
      }
    }
  );
}
